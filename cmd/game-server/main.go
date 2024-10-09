package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	UpdatesPerSec int = 30
)

type player struct {
	X     float64        `json:"x"`
	Y     float64        `json:"y"`
	Speed float64        `json:"speed"`
	input []Input        `json:"-"`
	send  chan<- message `json:"-"`
}

type Input struct {
	Id        int     `json:"id"`
	Key       string  `json:"k"`
	DeltaTime float64 `json:"dt"`
}

type actionType = int

const (
	CreatePlayer actionType = iota
	PlayerDisconnected
	NewInput
)

type action struct {
	Type actionType
	Data any
}

type message = []byte

type CreatePlayerData struct {
	send   chan<- message
	sendId chan<- string
}

type PlayerDisconnectedData struct {
	playerId string
}

type NewInputData struct {
	Input
	PlayerId string `json:"-"`
}

func main() {
	actionChan := make(chan action)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {

		http.ServeFile(w, r, "web/static/index.html")
	})

	http.Handle("/dist/", http.StripPrefix("/dist/", http.FileServer(http.Dir("web/dist"))))

	http.HandleFunc("/connectplayer", func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		upgrader.CheckOrigin = func(r *http.Request) bool { return true }
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Println(err)
			return
		}

		writeChan := make(chan message)
		idChan := make(chan string)
		done := make(chan bool)

		go func() {
			for {
				select {
				case <-done:
					return
				case data := <-writeChan:
					conn.WriteMessage(websocket.TextMessage, data)
				}
			}
		}()

		actionChan <- action{
			Type: CreatePlayer,
			Data: CreatePlayerData{
				send:   writeChan,
				sendId: idChan,
			},
		}
		playerId := <-idChan

		for {
			_, p, err := conn.ReadMessage()
			if err != nil {
				fmt.Println(err)
				break
			}

			input := NewInputData{}
			err = json.Unmarshal(p, &input)
			if err != nil {
				fmt.Println(err)
				continue
			}
			input.PlayerId = playerId

			actionChan <- action{
				Type: NewInput, Data: input,
			}
		}

		actionChan <- action{
			Type: PlayerDisconnected,
			Data: PlayerDisconnectedData{
				playerId: playerId,
			},
		}

		done <- true

	})

	go func() {
		players := make(map[string]*player)
		var playerCounter int

		ticker := time.NewTicker(time.Second / time.Duration(UpdatesPerSec))

		for {
			select {
			case action := <-actionChan:
				switch data := action.Data.(type) {
				case CreatePlayerData:
					type initData struct {
						*player
						Kind string `json:"type"`
					}
					id := fmt.Sprintf("player%d", playerCounter)
					player := &player{30, 30, 200, []Input{}, data.send}
					players[id] = player
					playerCounter++
					data.sendId <- id

					tmpMap := make(map[string]*initData)
					tmpMap[id] = &initData{player, "init"}
					jsonPlayer, err := json.Marshal(tmpMap)
					if err != nil {
						fmt.Println(err)
						continue
					}

					data.send <- jsonPlayer
				case PlayerDisconnectedData:
					delete(players, data.playerId)
				case NewInputData:
					players[data.PlayerId].input = append(players[data.PlayerId].input, data.Input)
				}
			case <-ticker.C:
				update := false
				for _, player := range players {
					if len(player.input) > 0 {
						update = true
						input := player.input[0]
						player.input = player.input[1:]
						distance := input.DeltaTime * player.Speed

						for _, d := range input.Key {
							switch d {
							case 'w':
								player.Y = toFixed(player.Y-distance, 4)
							case 's':
								player.Y = toFixed(player.Y+distance, 4)
							case 'a':
								player.X = toFixed(player.X-distance, 4)
							case 'd':
								player.X = toFixed(player.X+distance, 4)
							}
						}
					}
				}

				if update {
					if playersData, err := json.Marshal(players); err == nil {
						for _, player := range players {
							player.send <- playersData
						}
					} else {
						fmt.Println(err)
					}
				}
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
