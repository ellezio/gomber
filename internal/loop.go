package game

import (
	"time"

	"github.com/ellezio/gomber/internal/entity"
	"github.com/ellezio/gomber/internal/input"
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
			inputHandler := input.InputHandler{}

			for client, player := range clients {
				if player == nil {
					continue
				}

				input, ok := client.PopUnprocessedInput()
				if !ok {
					continue
				}

				if command := inputHandler.HandleInput(&input); command != nil {
					command(player)
				}

				client.SetProcessedInput(&input)
			}

			for client, player := range clients {
				client.SendUpdate(player.Id, board)
			}
		}
	}
}
