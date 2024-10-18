package game

import "math"

type Player struct {
	Id    string  `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Speed float64 `json:"speed"`
}

func NewPlayer(id string) *Player {
	return &Player{id, 0, 0, 200}
}

func (p *Player) HandleInput(input *Input) {
	distance := input.DeltaTime * p.Speed

	switch input.Action {
	case Up:
		p.Y = toFixed(p.Y-distance, 4)
	case UpLeft:
		p.Y = toFixed(p.Y-distance, 4)
		p.X = toFixed(p.X-distance, 4)
	case Left:
		p.X = toFixed(p.X-distance, 4)
	case DownLeft:
		p.X = toFixed(p.X-distance, 4)
		p.Y = toFixed(p.Y+distance, 4)
	case Down:
		p.Y = toFixed(p.Y+distance, 4)
	case DownRight:
		p.Y = toFixed(p.Y+distance, 4)
		p.X = toFixed(p.X+distance, 4)
	case Right:
		p.X = toFixed(p.X+distance, 4)
	case UpRight:
		p.X = toFixed(p.X+distance, 4)
		p.Y = toFixed(p.Y-distance, 4)
	}
}

func toFixed(num float64, precision int) float64 {
	ratio := math.Pow10(precision)
	return math.Round(num*ratio) / ratio
}
