package math2

import "math"

func NewZeroVector2() *Vector2 {
	return &Vector2{}
}

func NewVector2(x float32, y float32) *Vector2 {
	return &Vector2{x, y}
}

type Vector2 struct {
	X float32 `json:"x"`
	Y float32 `json:"y"`
}

func (v2 *Vector2) Clone() *Vector2 {
	return NewVector2(v2.X, v2.Y)
}

func (v2 *Vector2) Trunc() *Vector2 {
	v2.X = float32(math.Trunc(float64(v2.X)))
	v2.Y = float32(math.Trunc(float64(v2.Y)))
	return v2
}
func (v2 *Vector2) AddVector2(other *Vector2) *Vector2 {
	v2.X += other.X
	v2.Y += other.Y
	return v2
}

func (v2 *Vector2) Div(val float32) *Vector2 {
	v2.X /= val
	v2.Y /= val
	return v2
}

func (v2 *Vector2) Mul(val float32) *Vector2 {
	v2.X *= val
	v2.Y *= val
	return v2
}

func (v2 *Vector2) SubVector2(other *Vector2) *Vector2 {
	v2.X -= other.X
	v2.Y -= other.Y
	return v2
}

func (v2 *Vector2) Add(val float32) *Vector2 {
	v2.X += val
	v2.Y += val
	return v2
}

func (v2 *Vector2) Sub(val float32) *Vector2 {
	v2.X -= val
	v2.Y -= val
	return v2
}

func (v2 *Vector2) MulVector2(other *Vector2) *Vector2 {
	v2.X *= other.X
	v2.Y *= other.Y
	return v2
}

func (v2 *Vector2) DivVector2(other *Vector2) *Vector2 {
	v2.X /= other.X
	v2.Y /= other.Y
	return v2
}

func (v *Vector2) IsZero() bool {
	return v.X == 0.0 && v.Y == 0.0
}
