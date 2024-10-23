package entity

import (
	"math"

	"github.com/ellezio/gomber/internal/input"
)

type Player struct {
	Entity
	Speed float64 `json:"speed"`
}

func NewPlayer() *Player {
	return &Player{
		Entity{
			Id:     0,
			X:      200,
			Y:      200,
			Width:  30,
			Height: 30,
		},
		200,
	}
}

func (p *Player) Move(inp *input.Input) {
	directionX, directionY := 0.0, 0.0

	if inp.HasAction(input.Up) {
		directionY -= 1.0
	}

	if inp.HasAction(input.Down) {
		directionY += 1.0
	}

	if inp.HasAction(input.Left) {
		directionX -= 1.0
	}

	if inp.HasAction(input.Right) {
		directionX += 1.0
	}

	if directionX != 0.0 && directionY != 0.0 {
		c := math.Sqrt(2) / 2
		directionX *= c
		directionY *= c
	}

	p.X += toFixed(directionX*inp.DeltaTime*p.Speed, 4)
	p.Y += toFixed(directionY*inp.DeltaTime*p.Speed, 4)
}

func toFixed(num float64, precision int) float64 {
	ratio := math.Pow10(precision)
	return math.Round(num*ratio) / ratio
}
