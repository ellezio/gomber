package input

import (
	"math"
	"slices"

	"github.com/ellezio/gomber/internal/entity"
)

type action = string

const (
	Up    action = "up"
	Down  action = "down"
	Left  action = "left"
	Right action = "right"
)

type Input struct {
	Id        int      `json:"id"`
	Actions   []action `json:"actions"`
	DeltaTime float64  `json:"dt"`
}

func (i *Input) hasAction(action action) bool {
	index := slices.Index(i.Actions, action)
	return index != -1
}

type Command = func(player *entity.Player)

type InputHandler struct{}

func (h *InputHandler) HandleInput(input *Input) Command {
	dx, dy := 0.0, 0.0

	if input.hasAction(Up) {
		dy -= 1.0
	}

	if input.hasAction(Down) {
		dy += 1.0
	}

	if input.hasAction(Left) {
		dx -= 1.0
	}

	if input.hasAction(Right) {
		dx += 1.0
	}

	if dx != 0.0 && dy != 0.0 {
		c := math.Sqrt(2) / 2
		dx *= c
		dy *= c
	}

	if dx != 0.0 || dy != 0.0 {
		return move(input.DeltaTime, dx, dy)
	}

	return nil
}

func move(dt float64, dX float64, dY float64) Command {
	return func(p *entity.Player) {

		p.X += toFixed(dX*dt*p.Speed, 4)
		p.Y += toFixed(dY*dt*p.Speed, 4)
	}
}

func toFixed(num float64, precision int) float64 {
	ratio := math.Pow10(precision)
	return math.Round(num*ratio) / ratio
}
