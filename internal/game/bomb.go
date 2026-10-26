package game

import (
	"github.com/ellezio/gomber/internal/math2"
)

type Bomb struct {
	Entity
	CountDown int `json:"cd"`

	dtSum     float32
	toExpload bool

	ExplosionRange int `json:"er"`
	spawnedBy      *Player
}

func NewBomb(x float32, y float32, explosionRange int) *Bomb {
	return &Bomb{
		// Entity
		Id:       0,
		Tag:      "bomb",
		Pos:      *math2.NewVector2(x, y),
		Velocity: *math2.NewZeroVector2(),
		AABB:     *math2.NewBox2(math2.NewZeroVector2(), math2.NewVector2(TileSize, TileSize)),
		Active:   true,

		CountDown:      3,
		ExplosionRange: explosionRange,
	}
}

func (b *Bomb) Update(dt float32) {
	b.dtSum += dt
	if b.dtSum >= 1.0 {
		b.CountDown -= int(b.dtSum)
		b.dtSum = b.dtSum - float32(int(b.dtSum))
	}

	if b.CountDown <= 0 || b.toExpload {
		b.explode()
	}
}

func (b *Bomb) explode() {
	if b.spawnedBy != nil {
		b.spawnedBy.AvailableBombs += 1
	}

	x, y := int(b.Pos.X/TileSize), int(b.Pos.Y/TileSize)
	explosion := NewExplosion(
		b.Pos.X,
		b.Pos.Y,
		*math2.NewVector2(TileSize, float32(b.ExplosionRange*2+1)*TileSize),
		b.Id,
	)

	for i := 1; i <= b.ExplosionRange; i++ {
		if b.ExplosionRange == i || y-i <= 0 || b.game.BoardGrid[y-i][x] == Tile_Wall || b.game.BoardGrid[y-i][x] == Tile_DestructibleWall || b.game.bombGrid[y-i][x] != 0 {
			explosion.Pos.SubVector2(math2.NewVector2(0, float32(i*TileSize)))
			explosion.AABB.Max.Y -= float32(TileSize * (b.ExplosionRange - i))
			break
		}
	}
	for i := 1; i <= b.ExplosionRange; i++ {
		if y+i >= len(b.game.BoardGrid)-1 || b.game.BoardGrid[y+i][x] == Tile_Wall || b.game.BoardGrid[y+i][x] == Tile_DestructibleWall || b.game.bombGrid[y+i][x] != 0 {
			explosion.AABB.Max.Y -= float32(TileSize * (b.ExplosionRange - i))
			break
		}
	}

	b.game.Instantiate(explosion)

	explosion = NewExplosion(
		b.Pos.X,
		b.Pos.Y,
		*math2.NewVector2(float32((b.ExplosionRange*2+1)*TileSize), TileSize),
		b.Id,
	)

	for i := 1; i <= b.ExplosionRange; i++ {
		if b.ExplosionRange == i || x-i <= 0 || b.game.BoardGrid[y][x-i] == Tile_Wall || b.game.BoardGrid[y][x-i] == Tile_DestructibleWall || b.game.bombGrid[y][x-i] != 0 {
			explosion.Pos.SubVector2(math2.NewVector2(float32(i*TileSize), 0))
			explosion.AABB.Max.X -= float32(TileSize * (b.ExplosionRange - i))
			break
		}
	}
	for i := 1; i <= b.ExplosionRange; i++ {
		if x+i >= len(b.game.BoardGrid[y])-1 || b.game.BoardGrid[y][x+i] == Tile_Wall || b.game.BoardGrid[y][x+i] == Tile_DestructibleWall || b.game.bombGrid[y][x+i] != 0 {
			explosion.AABB.Max.X -= float32(TileSize * (b.ExplosionRange - i))
			break
		}
	}

	b.game.Instantiate(explosion)

	b.game.bombGrid[int(b.Pos.Y/TileSize)][int(b.Pos.X/TileSize)] = 0
	b.game.Destruct(&b.Entity)
}

func (b *Bomb) OnCollision(entity *Entity) {
	if entity.Tag == "explosion" {
		b.toExpload = true
	}
}
