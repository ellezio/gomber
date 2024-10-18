package game

type inputAction = string

const (
	Up        inputAction = "Up"
	Down      inputAction = "Down"
	Left      inputAction = "Left"
	Right     inputAction = "Right"
	UpLeft    inputAction = "UpLeft"
	UpRight   inputAction = "UpRight"
	DownLeft  inputAction = "DownLeft"
	DownRight inputAction = "DownRight"
)

type Input struct {
	Index     int         `json:"i"`
	Action    inputAction `json:"a"`
	DeltaTime float64     `json:"dt"`
}
