package math2

func NewZeroBox2() *Box2 {
	return &Box2{}
}

func NewBox2(vmin, vmax *Vector2) *Box2 {
	return &Box2{*vmin, *vmax}
}

type Box2 struct {
	Min Vector2 `json:"min"`
	Max Vector2 `json:"max"`
}

func (b *Box2) Clone() *Box2 {
	return NewBox2(b.Min.Clone(), b.Max.Clone())
}

func (b *Box2) Trunc() *Box2 {
	b.Min.Trunc()
	b.Max.Trunc()
	return b
}

func (b *Box2) AddVector2(vec2 *Vector2) *Box2 {
	b.Min.AddVector2(vec2)
	b.Max.AddVector2(vec2)
	return b
}

func (b *Box2) Div(val float32) *Box2 {
	b.Min.Div(val)
	b.Max.Div(val)
	return b
}

func (b *Box2) Sub(val float32) *Box2 {
	b.Min.Sub(val)
	b.Max.Sub(val)
	return b
}

func (a *Box2) OverlapX(target *Box2) bool {
	return a.Max.X > target.Min.X && a.Min.X < target.Max.X
}

func (a *Box2) OverlapY(target *Box2) bool {
	return a.Max.Y > target.Min.Y && a.Min.Y < target.Max.Y
}

func (a *Box2) Overlap(target *Box2) bool {
	return a.OverlapX(target) && a.OverlapY(target)
}

func (b *Box2) ExpandByVector2(vec2 *Vector2) *Box2 {
	b.Min.SubVector2(vec2)
	b.Max.AddVector2(vec2)
	return b
}
