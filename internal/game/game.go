package game

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"slices"
	"time"

	"github.com/ellezio/gomber/internal/math2"
)

const (
	updatesRate int = 40

	TileSize = 50
)

// TODO:
// to place where all game objects will be
type TileType int

const (
	Tile_Empty TileType = iota
	Tile_Wall
	Tile_DestructibleWall
)

type GameClient struct {
	isDisconnected bool
	// I thinking about giving a player ability to
	// swap in game controlle over entity
	controlledEntity *Player
	clientCh         chan<- any

	// queue for input yet to be processed
	inputs []Input
	// input that was just processed which will be sent to client
	// in order to inform about which input was involved into generating new state of game
	processedInput *Input
}

// TODO:
// think about something more self describing
// type then just `any`
type ClientEvent any
type ClientConnectedEvent struct {
	IdCh     chan<- int
	ClientCh chan<- any
}
type ClientDisconnectedEvent struct {
	Id int
}
type ClientLeftEvent struct {
	Id int
}
type ClientInputEvent struct {
	Id    int
	Input Input
}

type GameState struct {
	BoardGrid [][]TileType `json:"grid"`

	Players    []*Player    `json:"players"`
	Bombs      []*Bomb      `json:"bombs"`
	Explosions []*Explosion `json:"explosions"`
	PowerUps   []*PowerUp   `json:"powerups"`

	bombGrid [][]int
}

type SpawnPoint struct {
	math2.Vector2
	player *Player
}

type Game struct {
	GameState

	playerSpawns []SpawnPoint

	clients         map[int]*GameClient
	clientsEventsCh <-chan ClientEvent
	inputHandler    *InputHandler
	lastId          int
	toRemove        []*Entity
}

func NewGame(clientsEventsCh <-chan ClientEvent) *Game {
	game := &Game{
		clients:         make(map[int]*GameClient),
		clientsEventsCh: clientsEventsCh,
	}

	inputHandler := NewInputHandler(game)

	game.inputHandler = inputHandler
	return game
}

func (g *Game) Run(mapName string) {
	g.LoadMap(mapName)

	ticker := time.NewTicker(time.Second / time.Duration(updatesRate))
	lastTs := time.Now()
	for {
		select {
		case event := <-g.clientsEventsCh:
			g.handleClientEvent(event)
		case <-ticker.C:
			nowTs := time.Now()
			tempTs := lastTs
			lastTs = nowTs
			dt := nowTs.Sub(tempTs).Seconds()

			g.handleInput(float32(dt))
			g.removeEntities()
			g.checkCollision()
			g.update(float32(dt))

			for _, client := range g.clients {
				client.clientCh <- struct {
					ControlledEntityId int       `json:"controlledEntityId"`
					GameState          GameState `json:"board"`
					ProcessedInput     *Input    `json:"processedInput"`
				}{
					ControlledEntityId: client.controlledEntity.Id,
					GameState:          g.GameState,
					ProcessedInput:     client.processedInput,
				}

				client.processedInput = nil
			}
		}
	}
}

func (g *Game) handleInput(dt float32) {
	for _, client := range g.clients {
		if len(client.inputs) == 0 {
			continue
		}

		input := &client.inputs[0]
		client.inputs = client.inputs[1:]

		if commands := g.inputHandler.HandleInput(input); commands != nil {
			for _, command := range commands {
				command(client.controlledEntity, dt)
			}
		}

		client.processedInput = input
	}
}

func (g *Game) update(dt float32) {
	for _, player := range g.Players {
		if player.Active {
			player.Update(dt)
		}
	}

	for _, explosion := range g.Explosions {
		if explosion.Active {
			explosion.Update()
		}
	}

	for _, bomb := range g.Bombs {
		if bomb.Active {
			bomb.Update(dt)
		}
	}
}

func (g *Game) checkCollision() {
	for _, player := range g.Players {
		if player.Active {
			playerVelocity := player.Velocity
			g.playerVsObstacles(player)

			// NOTE:
			// after resolving the collision it happens to jump to an another collision when on high speed
			// so there is a need to detect and resolve the new collision
			//
			// TODO (I don't think this is needed now):
			// find another approach to reslove this case
			if playerVelocity.X != player.Velocity.X || playerVelocity.Y != player.Velocity.Y {
				g.playerVsObstacles(player)
			}

			g.playerVsCollectable(player)
		}
	}

	g.checkExplosionsCollision()
}

func BroadphaseBox(player *Player) *math2.Box2 {
	newPos := player.Pos.Clone().AddVector2(&player.Velocity)

	ppBox2 := player.AABB.Clone().AddVector2(&player.Pos)
	box2 := player.AABB.Clone().AddVector2(newPos)

	if newPos.X > player.Pos.X {
		box2.Min.X = ppBox2.Min.X
	} else if newPos.X < player.Pos.X {
		box2.Max.X = ppBox2.Max.X
	}

	if newPos.Y > player.Pos.Y {
		box2.Min.Y = ppBox2.Min.Y
	} else if newPos.Y < player.Pos.Y {
		box2.Max.Y = ppBox2.Max.Y
	}

	return box2
}

func (g *Game) checkIfTileOutsideMap(tilePos math2.Vector2) bool {
	return tilePos.X < 0 ||
		tilePos.Y < 0 ||
		int(tilePos.Y) >= len(g.BoardGrid) ||
		int(tilePos.X) >= len(g.BoardGrid[0])
}

func (g *Game) playerVsObstacles(player *Player) {
	tilesRange := BroadphaseBox(player).Div(TileSize).Trunc()

	type pair struct {
		key   float32
		value *Entity
	}
	collisions := make([]pair, 0)

	for row := tilesRange.Min.Y; row <= tilesRange.Max.Y; row++ {
		for col := tilesRange.Min.X; col <= tilesRange.Max.X; col++ {
			if g.checkIfTileOutsideMap(*math2.NewVector2(col, row)) {
				continue
			}

			var collider *Entity = nil

			if tile := g.BoardGrid[int(row)][int(col)]; tile != Tile_Empty {
				collider = &Entity{
					Id:   int(tile),
					Tag:  "wall",
					Pos:  *math2.NewVector2(col, row).Mul(TileSize),
					AABB: *math2.NewBox2(math2.NewZeroVector2(), math2.NewVector2(TileSize, TileSize)),
				}
			} else if bombId := g.bombGrid[int(row)][int(col)]; bombId > 0 {
				bombIndex := slices.IndexFunc(g.Bombs, func(bomb *Bomb) bool { return bomb.Id == bombId })
				collider = &g.Bombs[bombIndex].Entity
			}

			if collider == nil {
				continue
			}

			cp, _, ct := DynamicEntityVsEntity(&player.Entity, collider)

			if cp == nil {
				continue
			}

			collisions = append(collisions, pair{ct, collider})
		}
	}

	slices.SortFunc(collisions, func(a, b pair) int {
		if a.key < b.key {
			return -1
		} else if a.key == b.key {
			return 0
		} else {
			return 1
		}
	})

	for _, c := range collisions {
		cp, cn, ct := DynamicEntityVsEntity(&player.Entity, c.value)

		if cp == nil {
			continue
		}

		cn.Mul(0.1)

		if cn.X != 0 {
			player.Velocity.X *= ct
			player.Velocity.X += cn.X
		}

		if cn.Y != 0 {
			player.Velocity.Y *= ct
			player.Velocity.Y += cn.Y
		}
	}
}

func (g *Game) checkExplosionsCollision() {
	hitTrack := make(map[int]bool, len(g.Explosions)/2)

	for _, player := range g.Players {
		for k := range hitTrack {
			delete(hitTrack, k)
		}

		for _, explosion := range g.Explosions {
			if !hitTrack[explosion.bombId] && EntityVsEntity(&player.Entity, &explosion.Entity) {
				hitTrack[explosion.bombId] = true
				player.OnCollision(&explosion.Entity)
			}
		}
	}

	for _, bomb := range g.Bombs {
		for k := range hitTrack {
			delete(hitTrack, k)
		}

		for _, explosion := range g.Explosions {
			if !hitTrack[explosion.bombId] && EntityVsEntity(&bomb.Entity, &explosion.Entity) {
				hitTrack[explosion.bombId] = true
				bomb.OnCollision(&explosion.Entity)
			}
		}
	}

	for _, explosion := range g.Explosions {
		explosionAABB := explosion.AABB.
			Clone().
			AddVector2(&explosion.Pos).
			Div(TileSize).
			Trunc()
		explosionAABB.Max.Sub(1)

		tileVecs := [2]math2.Vector2{
			explosionAABB.Min,
			explosionAABB.Max,
		}

		for _, tileVec := range tileVecs {
			tile := g.BoardGrid[int(tileVec.Y)][int(tileVec.X)]
			if tile == Tile_DestructibleWall {
				g.BoardGrid[int(tileVec.Y)][int(tileVec.X)] = Tile_Empty

				var pu *PowerUp
				puPos := math2.NewVector2(TileSize, TileSize).MulVector2(&tileVec)

				r := rand.Intn(2)
				switch r {
				case 0:
					pu = NewSpeedPowerUp(*puPos)
				case 1:
					pu = NewBombCapPowerUp(*puPos)
				case 3:
					pu = NewExplosionRangePowerUp(*puPos)
				case 4:
					pu = NewHpPowerUp(*puPos)
				}

				pu.Pos.Add(TileSize / 2).SubVector2(pu.AABB.Max.Clone().Div(2))
				g.Instantiate(pu)
			}
		}
	}
}

func (g *Game) playerVsCollectable(player *Player) {
	playerAABB := player.AABB.Clone().AddVector2(&player.Pos)

	for _, powerUp := range g.PowerUps {
		puAABB := powerUp.AABB.Clone().AddVector2(&powerUp.Pos)

		if playerAABB.Overlap(puAABB) {
			powerUp.OnCollision(player)
		}
	}
}

func (g *Game) handleClientEvent(event ClientEvent) {
	switch data := event.(type) {
	case ClientConnectedEvent:
		id := g.addClient(data.ClientCh)
		data.IdCh <- id

	case ClientDisconnectedEvent:
		g.clientDisconnected(data.Id)

	case ClientLeftEvent:
		g.removeClient(data.Id)

	case ClientInputEvent:
		g.clients[data.Id].inputs = append(g.clients[data.Id].inputs, data.Input)
	}
}

// handles client's id generation and instantiate player's entity
func (g *Game) addClient(clientCh chan<- any) int {
	id := g.generateId()

	player := NewPlayer()
	g.Instantiate(player)

	// Pick empty spown point and place player in center of it
	for i, spawn := range g.playerSpawns {
		if spawn.player != nil {
			continue
		}

		spawn.player = player
		player.Pos = *spawn.
			Clone().
			Mul(TileSize).
			Add(TileSize / 2).
			SubVector2(player.AABB.Max.Clone().Div(2))

		g.playerSpawns[i] = spawn
		break
	}

	g.clients[id] = &GameClient{
		isDisconnected:   false,
		clientCh:         clientCh,
		controlledEntity: player,
	}

	return id
}

// TODO: reconnecting
func (g *Game) clientDisconnected(id int) {
	g.clients[id].isDisconnected = true
}

func (g *Game) removeClient(id int) {
	clientPlayer := g.clients[id]

	for i, spwan := range g.playerSpawns {
		if spwan.player == clientPlayer.controlledEntity {
			g.playerSpawns[i].player = nil
			break
		}
	}

	g.Players = slices.DeleteFunc(
		g.Players,
		func(p *Player) bool { return p == clientPlayer.controlledEntity },
	)

	delete(g.clients, id)
}

func (g *Game) Instantiate(entity any) bool {
	switch e := entity.(type) {
	case *Player:
		e.Id = g.generateId()
		e.game = g
		g.Players = append(g.Players, e)
	case *Bomb:
		if g.bombGrid[int(e.Pos.Y/TileSize)][int(e.Pos.X/TileSize)] > 0 {
			return false
		}
		e.Id = g.generateId()
		e.game = g
		g.bombGrid[int(e.Pos.Y/TileSize)][int(e.Pos.X/TileSize)] = e.Id
		g.Bombs = append(g.Bombs, e)
	case *Explosion:
		e.Id = g.generateId()
		e.game = g
		g.Explosions = append(g.Explosions, e)
	case *PowerUp:
		e.Id = g.generateId()
		e.game = g
		g.PowerUps = append(g.PowerUps, e)

	default:
		fmt.Println("Unknown entity", e)
	}

	return true
}

func (g *Game) Destruct(entity *Entity) {
	entity.Active = false
	g.toRemove = append(g.toRemove, entity)
}

func (g *Game) removeEntities() {
	for _, e := range g.toRemove {
		switch e.Tag {
		case "player":
			g.Players = slices.DeleteFunc(g.Players, func(p *Player) bool { return p.Id == e.Id })
		case "bomb":
			g.Bombs = slices.DeleteFunc(g.Bombs, func(b *Bomb) bool { return b.Id == e.Id })
		case "explosion":
			g.Explosions = slices.DeleteFunc(g.Explosions, func(ex *Explosion) bool { return ex.Id == e.Id })
		case "powerup":
			g.PowerUps = slices.DeleteFunc(g.PowerUps, func(pu *PowerUp) bool { return pu.Id == e.Id })
		}
	}
}

func (g *Game) generateId() int {
	id := g.lastId
	g.lastId++
	return id
}

func (g *Game) LoadMap(mapName string) {
	var data struct {
		Grid         [][]TileType    `json:"grid"`
		PlayerSpawns []math2.Vector2 `json:"playerSpawns"`
	}

	boardRaw, _ := os.ReadFile("boards/" + mapName + ".json")

	err := json.Unmarshal(boardRaw, &data)
	if err != nil {
		fmt.Println(err)
	}

	g.BoardGrid = data.Grid

	g.bombGrid = make([][]int, len(g.BoardGrid))
	l := len(g.BoardGrid[0])
	for i := range len(g.bombGrid) {
		g.bombGrid[i] = make([]int, l)
	}

	for _, spawn := range data.PlayerSpawns {
		spawnPoint := SpawnPoint{spawn, nil}
		g.playerSpawns = append(g.playerSpawns, spawnPoint)
	}
}
