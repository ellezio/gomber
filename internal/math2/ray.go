package math2

func NewRay(origin, direction Vector2) *Ray {
	return &Ray{origin, direction}
}

type Ray struct {
	Origin    Vector2
	Direction Vector2
}
