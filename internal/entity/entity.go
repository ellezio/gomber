package entity

type Entity struct {
	Id     int     `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"w"`
	Height float64 `json:"h"`

	PrevX float64 `json:"-"`
	PrevY float64 `json:"-"`
}
