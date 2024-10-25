package entity

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
