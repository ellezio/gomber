package game

import (
	"bytes"
	"strconv"
)

type EntityType = int

const (
	Ground EntityType = iota
	Wall
)

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Size struct {
	Width  int `json:"w"`
	Height int `json:"h"`
}

type Entity struct {
	Position
	Size
}

type Board struct {
	Size
	Entity []*Entity `json:"e"`
}

func ParseToBoard(b []byte) *Board {
	board := &Board{Size: Size{1000, 600}}
	var blockWidth, blockHeight int

	for i, parts := range bytes.Split(b, []byte(";")) {
		for j, part := range bytes.Split(parts, []byte(":")) {
			if i == 0 {
				if j == 0 {
					w, _ := strconv.Atoi(string(part))
					blockWidth = board.Width / w
				} else if j == 1 {
					h, _ := strconv.Atoi(string(part))
					blockHeight = board.Height / h
				}
			} else {
				eType, _ := strconv.Atoi(string(part))
				switch eType {
				case Wall:
					x := float64(j * blockWidth)
					y := float64((i - 1) * blockHeight)
					e := &Entity{Position: Position{x, y}, Size: Size{blockWidth, blockHeight}}
					board.Entity = append(board.Entity, e)
				}
			}

		}
	}

	return board
}
