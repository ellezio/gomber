package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	UpdatesPerSec int = 30
)

type player struct {
	id    string
	x     float64
	y     float64
	speed float64
	input []Input
	send  chan<- message
}

type Input struct {
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

type message = string

type CreatePlayerData struct {
	send chan<- message
	info chan<- string
}

type PlayerDisconnectedData struct {
	playerId string
}

type NewInputData struct {
	Input
	Id       int    `json:"id"`
	PlayerId string `json:"-"`
}

func main() {
	actionChan := make(chan action)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {

		http.ServeFile(w, r, "web/static/index.html")
	})

	http.Handle("/dist/", http.StripPrefix("/dist/", http.FileServer(http.Dir("web/dist"))))

	http.HandleFunc("/connectplayer", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("Conn")
		upgrader := websocket.Upgrader{}
		upgrader.CheckOrigin = func(r *http.Request) bool { return true }
		fmt.Println("Upgreading")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Println(err)
			return
		}
		fmt.Println("Upgreaded")

		writeChan := make(chan string)
		infoChan := make(chan string)
		done := make(chan bool)

		fmt.Println("request new player")
		actionChan <- action{
			Type: CreatePlayer,
			Data: CreatePlayerData{
				send: writeChan,
				info: infoChan,
			},
		}
		fmt.Println("player created")

		fmt.Println("request player id")
		playerId := <-infoChan
		fmt.Println("got id: " + playerId)

		go func() {
			for {
				select {
				case <-done:
					return
				case msg := <-writeChan:
					conn.WriteMessage(websocket.TextMessage, []byte(msg))
				}
			}
		}()

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
					id := fmt.Sprintf("player%d", playerCounter)
					player := &player{id, 30, 30, 200, []Input{}, data.send}
					players[id] = player
					playerCounter++
					data.info <- id
				case PlayerDisconnectedData:
					delete(players, data.playerId)
				case NewInputData:
					players[data.PlayerId].input = append(players[data.PlayerId].input, data.Input)
				}
			case <-ticker.C:
				msg := ""
				for _, player := range players {
					if len(player.input) > 0 {
						input := player.input[0]
						player.input = player.input[1:]
						distance := input.DeltaTime * player.speed

						for _, d := range input.Key {
							switch d {
							case 'w':
								player.y -= distance
							case 's':
								player.y += distance
							case 'a':
								player.x -= distance
							case 'd':
								player.x += distance
							}
						}

						if msg != "" {
							msg += "|"
						}
						msg += fmt.Sprintf("%s,%f,%f", player.id, player.x, player.y)
					}
				}

				if msg != "" {
					for _, player := range players {
						player.send <- msg
					}
				}
			}
		}
	}()

	fmt.Println("Listening on :3000")
	http.ListenAndServe(":3000", nil)
}
