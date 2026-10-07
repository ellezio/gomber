package game

import (
	"encoding/json"
	"log/slog"
	"maps"
	"os"
	"slices"
	"strings"

	"github.com/ellezio/gomber/internal/math2"
)

type GameMap struct {
	MapName      string          `json:"mapName"`
	Grid         [][]TileType    `json:"grid"`
	PlayerSpawns []math2.Vector2 `json:"playerSpawns"`
}

func (gm *GameMap) Clone() *GameMap {
	mapName := gm.MapName

	colCount := len(gm.Grid[0])
	gridSlice := make([]TileType, len(gm.Grid)*colCount)
	grid := make([][]TileType, len(gm.Grid))
	for row, cols := range gm.Grid {
		grid[row] = gridSlice[row*colCount : row*colCount+colCount]
		copy(grid[row], cols)
	}

	playersSpawns := make([]math2.Vector2, len(gm.PlayerSpawns))
	copy(playersSpawns, gm.PlayerSpawns)

	return &GameMap{
		MapName:      mapName,
		Grid:         grid,
		PlayerSpawns: playersSpawns,
	}
}

type GameMapManager struct {
	gameMaps map[string]*GameMap
}

func NewGameMapManager() *GameMapManager {
	return &GameMapManager{
		gameMaps: make(map[string]*GameMap),
	}
}

func (gmm *GameMapManager) LoadMaps() error {
	entries, err := os.ReadDir("boards")
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.Type().IsRegular() {
			content, err := os.ReadFile("boards/" + entry.Name())
			if err != nil {
				slog.Error("Failed to load game map", "GameMapFile", entry.Name(), "error", err.Error())
				continue
			}

			var gameMap GameMap
			err = json.Unmarshal(content, &gameMap)
			if err != nil {
				slog.Error("Failed to parse game map", "GameMapFile", entry.Name(), "error", err.Error())
				continue
			}

			gmm.gameMaps[gameMap.MapName] = &gameMap
		}
	}

	return nil
}

func (gmm *GameMapManager) Get(mapName string) (*GameMap, bool) {
	gameMap, ok := gmm.gameMaps[mapName]
	return gameMap.Clone(), ok
}

func (gmm *GameMapManager) GetMapsName() []string {
	return slices.SortedFunc(maps.Keys(gmm.gameMaps), func(s1, s2 string) int { return strings.Compare(s1, s2) })
}
