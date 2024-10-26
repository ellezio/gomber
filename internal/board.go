package game

import (
	"bytes"
	"os"
	"strconv"

	"github.com/ellezio/gomber/internal/entity"
)

type MapEntityType = int

const (
	MapWall MapEntityType = iota + 1
)

type Board struct {
	Width  int
	Height int

	Players []*entity.Player `json:"players"`
	Walls   []*entity.Wall   `json:"walls"`

	entityIdLast int
}

func NewBoard() *Board {
	return &Board{
		Width:  1000,
		Height: 600,
	}
}

func (b *Board) LoadMap(mapName string) {
	mapBytes, _ := os.ReadFile("maps/" + mapName)
	var blockWidth, blockHeight int
	for i, parts := range bytes.Split(mapBytes, []byte(";")) {
		for j, part := range bytes.Split(parts, []byte(":")) {
			if i == 0 {
				if j == 0 {
					w, _ := strconv.Atoi(string(part))
					blockWidth = b.Width / w
				} else if j == 1 {
					h, _ := strconv.Atoi(string(part))
					blockHeight = b.Height / h
				}
			} else {
				eType, _ := strconv.Atoi(string(part))
				switch eType {
				case MapWall:
					x := float64(j * blockWidth)
					y := float64((i - 1) * blockHeight)
					wall := entity.NewWall(x, y, float64(blockWidth), float64(blockHeight))
					b.AddWall(wall)
				}
			}

		}
	}
}

func (b *Board) generateEntityId() int {
	b.entityIdLast++
	return b.entityIdLast
}

func (b *Board) AddPlayer(player *entity.Player) {
	player.Id = b.generateEntityId()
	b.Players = append(b.Players, player)
}

func (b *Board) AddWall(wall *entity.Wall) {
	wall.Id = b.generateEntityId()
	b.Walls = append(b.Walls, wall)
}
