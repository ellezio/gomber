package input

import "slices"

type action = string

const (
	Up    action = "up"
	Down  action = "down"
	Left  action = "left"
	Right action = "right"
)

type Input struct {
	Id        int      `json:"id"`
	Actions   []action `json:"actions"`
	DeltaTime float64  `json:"dt"`
}

func (i *Input) HasAction(action action) bool {
	index := slices.Index(i.Actions, action)
	return index != -1
}
