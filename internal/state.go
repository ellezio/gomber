package game

type State struct {
	Players        []*Player `json:"players"`
	ProcessedInput *Input    `json:"input"`
}
