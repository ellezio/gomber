package game

import (
	"math"
	"time"

	"github.com/ellezio/gomber/internal/entity"
)

const (
	updatesPerSec int = 60
)

type ClientConnected struct {
	Client *Client
}

type ClientDisconnected struct {
	Client *Client
}

type PlayerCreation struct {
	Client *Client
}

func StartGameLoop(eventCh <-chan any) {
	clients := make(map[*Client]*entity.Player)
	board := NewBoard()
	board.LoadMap("map1.txt")

	ticker := time.NewTicker(time.Second / time.Duration(updatesPerSec))

	for {
		select {
		case event := <-eventCh:
			switch data := event.(type) {
			case ClientConnected:
				clients[data.Client] = nil

			case ClientDisconnected:
				delete(clients, data.Client)

			case PlayerCreation:
				player := entity.NewPlayer()
				board.AddPlayer(player)
				clients[data.Client] = player
			}

		case <-ticker.C:
			for client, player := range clients {
				if player == nil {
					continue
				}

				input, ok := client.PopUnprocessedInput()
				if !ok {
					continue
				}

				HandleInput(player, &input)
				client.SetProcessedInput(&input)
			}

			for client, player := range clients {
				client.SendUpdate(player.Id, board)
			}
		}
	}
}

func HandleInput(player *entity.Player, input *Input) {
	distance := input.DeltaTime * player.Speed

	switch input.Action {
	case Up:
		player.Y = toFixed(player.Y-distance, 4)
	case UpLeft:
		player.Y = toFixed(player.Y-distance, 4)
		player.X = toFixed(player.X-distance, 4)
	case Left:
		player.X = toFixed(player.X-distance, 4)
	case DownLeft:
		player.X = toFixed(player.X-distance, 4)
		player.Y = toFixed(player.Y+distance, 4)
	case Down:
		player.Y = toFixed(player.Y+distance, 4)
	case DownRight:
		player.Y = toFixed(player.Y+distance, 4)
		player.X = toFixed(player.X+distance, 4)
	case Right:
		player.X = toFixed(player.X+distance, 4)
	case UpRight:
		player.X = toFixed(player.X+distance, 4)
		player.Y = toFixed(player.Y-distance, 4)
	}
}

func toFixed(num float64, precision int) float64 {
	ratio := math.Pow10(precision)
	return math.Round(num*ratio) / ratio
}
