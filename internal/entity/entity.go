package entity

type Entity struct {
	Id     int     `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  int     `json:"w"`
	Height int     `json:"h"`
}
