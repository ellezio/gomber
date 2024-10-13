package main

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	UpdatesPerSec int = 60
)

type Player struct {
	Id    string  `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Speed float64 `json:"speed"`
}

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

type GameState struct {
	Players        []*Player `json:"players"`
	ProcessedInput *Input    `json:"input"`
}

type ClientConnected struct {
	client *Client
}

type ClientDisconnected struct {
	client *Client
}

type PlayerCreation struct {
	client *Client
}

func main() {
	eventCh := make(chan any)
	log := log.New(os.Stdout, "", 0)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "web/static/index.html")
	})

	http.Handle("/dist/", http.StripPrefix("/dist/", http.FileServer(http.Dir("web/dist"))))

	http.HandleFunc("/connectplayer", func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		upgrader.CheckOrigin = func(r *http.Request) bool { return true }
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println(err)
			return
		}

		client := NewClient(conn, log)

		eventCh <- ClientConnected{client}
		eventCh <- PlayerCreation{client}

		client.ListenForInput()

		eventCh <- ClientDisconnected{client}
	})

	go func() {
		clients := make(map[*Client]*Player)
		clientsMu := sync.Mutex{}
		var playerCounter int

		ticker := time.NewTicker(time.Second / time.Duration(UpdatesPerSec))

		for {
			select {
			case event := <-eventCh:
				switch data := event.(type) {
				case ClientConnected:
					clientsMu.Lock()
					clients[data.client] = nil
					clientsMu.Unlock()

				case ClientDisconnected:
					delete(clients, data.client)

				case PlayerCreation:
					clientsMu.Lock()

					id := fmt.Sprintf("player%d", playerCounter)
					playerCounter++
					player := &Player{id, 30, 30, 200}
					clients[data.client] = player

					gameState := GameState{}
					gameState.Players = append(gameState.Players, player)

					data.client.SendPlayerInfo(*player)

					clientsMu.Unlock()
				}

			case <-ticker.C:
				clientsMu.Lock()
				gameState := GameState{}
				inputMap := make(map[*Client]*Input)

				for client, player := range clients {
					if player == nil {
						continue
					}

					input, ok := client.PopInput()
					if !ok {
						continue
					}

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
	}()

	fmt.Println("Listening on :3000")
	http.ListenAndServe(":3000", nil)
}

func toFixed(num float64, precision int) float64 {
	ratio := math.Pow10(precision)
	return math.Round(num*ratio) / ratio
}
