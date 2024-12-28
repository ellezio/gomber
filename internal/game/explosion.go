package game

import "github.com/ellezio/gomber/internal/math2"

type Explosion struct {
	Entity
	bombId int
}

func NewExplosion(x float32, y float32, max math2.Vector2, bombId int) *Explosion {
	return &Explosion{
		Entity: Entity{
			Id:       0,
			Tag:      "explosion",
			Pos:      *math2.NewVector2(x, y),
			Velocity: *math2.NewZeroVector2(),
			AABB:     *math2.NewBox2(math2.NewZeroVector2(), &max),
			Active:   true,
		},
		bombId: bombId,
	}
}

func (e *Explosion) Update() {
	e.game.Destruct(&e.Entity)
}
