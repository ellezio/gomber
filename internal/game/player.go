package game

import (
	"github.com/ellezio/gomber/internal/math2"
)

type Player struct {
	Entity
	Speed float32 `json:"speed"`

	freezeDropBomb bool
	freezeDtSum    float32

	MaxBombs       int `json:"maxBombs"`
	AvailableBombs int `json:"availableBombs"`
	explosionRange int

	HP int `json:"hp"`
}

func NewPlayer() *Player {
	return &Player{
		Entity: Entity{
			Id:      0,
			Tag:     "player",
			Pos:     *math2.NewVector2(60, 60),
			PrevPos: *math2.NewVector2(60, 60),
			AABB:    *math2.NewBox2(math2.NewZeroVector2(), math2.NewVector2(30, 30)),
			Active:  true,
		},
		Speed: 120,

		MaxBombs:       3,
		AvailableBombs: 3,
		explosionRange: 3,

		HP: 3,
	}
}

func (p *Player) Update(dt float32) {
	if p.freezeDropBomb {
		p.freezeDtSum += dt
		if p.freezeDtSum >= 0.2 {
			p.freezeDtSum = 0.0
			p.freezeDropBomb = false
		}
	}
}

func (p *Player) OnCollision(entity *Entity) {
	if entity.Tag == "explosion" {
		p.HP -= 1
	}
}
