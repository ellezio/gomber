package game

import "github.com/ellezio/gomber/internal/math2"

type Entity struct {
	Id       int           `json:"id"`
	Tag      string        `json:"tag"`
	Pos      math2.Vector2 `json:"pos"`
	Velocity math2.Vector2 `json:"-"`
	AABB     math2.Box2    `json:"aabb"`

	Active bool `json:"-"`

	game *Game
}

type Collider interface {
	OnCollision(entity *Entity)
}
