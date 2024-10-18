package game

import (
	"fmt"
	"sync"
	"time"
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
	clients := make(map[*Client]*Player)
	clientsMu := sync.Mutex{}
	var playerCounter int

	ticker := time.NewTicker(time.Second / time.Duration(updatesPerSec))

	for {
		select {
		case event := <-eventCh:
			switch data := event.(type) {
			case ClientConnected:
				clientsMu.Lock()
				clients[data.Client] = nil
				clientsMu.Unlock()

			case ClientDisconnected:
				delete(clients, data.Client)

			case PlayerCreation:
				clientsMu.Lock()

				id := fmt.Sprintf("player%d", playerCounter)
				playerCounter++
				player := NewPlayer(id)
				clients[data.Client] = player

				gameState := State{}
				gameState.Players = append(gameState.Players, player)

				data.Client.SendPlayerInfo(*player)

				clientsMu.Unlock()
			}

		case <-ticker.C:
			clientsMu.Lock()
			gameState := State{}
			inputMap := make(map[*Client]*Input)

			for client, player := range clients {
				if player == nil {
					continue
				}

				input, ok := client.PopInput()
				if !ok {
					continue
				}

				player.HandleInput(&input)
				inputMap[client] = &input
			}

			for client, player := range clients {
				var ok bool
				if gameState.ProcessedInput, ok = inputMap[client]; !ok {
					gameState.ProcessedInput = nil
				}

				gameState.Players = append(gameState.Players, player)

				client.SendGameState(gameState)
			}

			clientsMu.Unlock()
		}
	}
}
