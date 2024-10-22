package entity

type Wall struct {
	Entity
}

func NewWall(x float64, y float64, width int, height int) *Wall {
	return &Wall{Entity{0, x, y, width, height}}
}
