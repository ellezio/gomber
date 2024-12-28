package game

import (
	"math"
	"slices"

	"github.com/ellezio/gomber/internal/math2"
)

type action = string

const (
	Up       action = "up"
	Down     action = "down"
	Left     action = "left"
	Right    action = "right"
	DropBomb action = "dropBomb"
)

type Input struct {
	Id        int      `json:"id"`
	Actions   []action `json:"actions"`
	DeltaTime float32  `json:"dt"`
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
