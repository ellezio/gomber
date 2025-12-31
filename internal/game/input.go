package game

import (
	"math"
	"slices"

	"github.com/ellezio/gomber/internal/math2"
)

// NOTE:
// This input handler is only for controling playable entity
// not for interaction with other game elements.
// I'm planning to do chain-of-responsibility for that.
//
// And handling playable entity will be done in component
// prepared for that.

type action = string

const (
	Up       action = "up"
	Down     action = "down"
	Left     action = "left"
	Right    action = "right"
	DropBomb action = "dropBomb"
)

type InputList struct {
	head *Input
	tail *Input
}

func (i *InputList) Append(inp Input) {
	if i.head == nil {
		i.head = &inp
	} else {
		i.tail.next = &inp
	}

	i.tail = &inp
}

func (i *InputList) Pop() *Input {
	if i.head == nil {
		return nil
	}

	inp := i.head
	i.head = inp.next
	if inp.next == nil {
		i.tail = nil
	}
	inp.next = nil
	return inp
}

type Input struct {
	Id        int      `json:"id"`
	Actions   []action `json:"actions"`
	DeltaTime float32  `json:"dt"`
	next      *Input
}

func (i *Input) hasAction(action action) bool {
	index := slices.Index(i.Actions, action)
	return index != -1
}

type Command = func(player *Player, dt float32)

func NewInputHandler(g *Game) *InputHandler {
	return &InputHandler{g}
}

type InputHandler struct {
	game *Game
}

func (h *InputHandler) HandleInput(input *Input) []Command {
	// This is for queuing all action performed
	// by player to take place. It makes possible
	// to place bomb while still moving by adding
	// both commands.
	var commands []Command

	if input.hasAction(DropBomb) {
		commands = append(commands, dropBomb(h.game))
	}

	direction := math2.NewZeroVector2()

	if input.hasAction(Up) {
		direction.Y -= 1.0
	}

	if input.hasAction(Down) {
		direction.Y += 1.0
	}

	if input.hasAction(Left) {
		direction.X -= 1.0
	}

	if input.hasAction(Right) {
		direction.X += 1.0
	}

	if direction.X != 0.0 && direction.Y != 0.0 {
		c := float32(math.Sqrt(2) / 2)
		direction.Mul(c)
	}

	if !direction.IsZero() {
		commands = append(commands, move(*direction))
	}

	return commands
}

func move(direction math2.Vector2) Command {
	return func(p *Player, dt float32) {
		p.Velocity = *direction.Mul(p.Speed * dt)
	}
}

func dropBomb(g *Game) Command {
	return func(p *Player, dt float32) {
		if p.AvailableBombs == 0 {
			return
		}

		if p.freezeDropBomb {
			return
		}

		playerCenter := p.AABB.Max.Clone().Div(2)
		bombGridPos := p.Pos.
			Clone().
			AddVector2(playerCenter).
			Div(TileSize).
			Trunc().
			Mul(TileSize)

		bomb := NewBomb(
			bombGridPos.X,
			bombGridPos.Y,
			p.explosionRange,
		)
		bomb.spawnedBy = p
		created := g.Instantiate(bomb)
		if created {
			p.freezeDropBomb = true
			p.AvailableBombs -= 1
		}
	}
}
