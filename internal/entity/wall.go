package entity

type Wall struct {
	Entity
}

func NewWall(x float64, y float64, width float64, height float64) *Wall {
	return &Wall{Entity{
		Id:     0,
		X:      x,
		Y:      y,
		Width:  width,
		Height: height,
	}}
}
