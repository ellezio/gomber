package game

import (
	"math"

	"github.com/ellezio/gomber/internal/math2"
)

func DynamicEntityVsEntity(source, target *Entity) (contactPoint *math2.Vector2, contactNormal *math2.Vector2, contactTime float32) {
	targetCollisionBorder := target.AABB.
		Clone().
		AddVector2(&target.Pos).
		ExpandByVector2(source.AABB.Max.Clone().Div(2))

	sourceStart := source.PrevPos.Clone().AddVector2(source.AABB.Max.Clone().Div(2))
	sourceEnd := source.Pos.Clone().AddVector2(source.AABB.Max.Clone().Div(2))
	direction := sourceEnd.Clone().SubVector2(sourceStart)
	ray := math2.NewRay(*sourceStart, *direction)

	return RayVsBox2(*ray, *targetCollisionBorder)
}

func RayVsBox2(ray math2.Ray, box math2.Box2) (contactPoint *math2.Vector2, contactNormal *math2.Vector2, contactTime float32) {
	near := box.Min.Clone().SubVector2(&ray.Origin).DivVector2(&ray.Direction)
	far := box.Max.Clone().SubVector2(&ray.Origin).DivVector2(&ray.Direction)

	if math.IsNaN(float64(near.X)) || math.IsNaN(float64(near.Y)) {
		return
	}

	if math.IsNaN(float64(far.X)) || math.IsNaN(float64(far.Y)) {
		return
	}

	if ray.Direction.X < 0 {
		near.X, far.X = far.X, near.X
	}

	if ray.Direction.Y < 0 {
		near.Y, far.Y = far.Y, near.Y
	}

	if near.X > far.Y || near.Y > far.X {
		return
	}

	contactTime = float32(math.Max(float64(near.X), float64(near.Y)))
	if contactTime >= 1 || contactTime <= 0 {
		return
	}

	contactPoint = ray.Origin.AddVector2(ray.Direction.Mul(contactTime))

	contactNormal = math2.NewZeroVector2()
	if near.X > near.Y {
		if ray.Direction.X < 0 {
			contactNormal.X = 1
		} else {
			contactNormal.X = -1
		}
	} else if near.Y > near.X {
		if ray.Direction.Y < 0 {
			contactNormal.Y = 1
		} else {
			contactNormal.Y = -1
		}
	}

	return
}

func EntityVsEntity(source, target *Entity) bool {
	sourceBox := source.AABB.Clone().AddVector2(&source.Pos)
	targetBox := target.AABB.Clone().AddVector2(&target.Pos)

	return sourceBox.Overlap(targetBox)
}
