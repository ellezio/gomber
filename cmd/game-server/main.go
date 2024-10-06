package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

type player struct {
	id    string
	x     int
	y     int
	speed int
	input string
	send  chan<- message
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
	playerId string
	input    string
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

			actionChan <- action{
				Type: NewInput, Data: NewInputData{
					playerId: playerId,
					input:    string(p),
				},
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

		ticker := time.NewTicker(20 * time.Millisecond)

		for {
			fmt.Println("Waiting")
			select {
			case action := <-actionChan:
				switch data := action.Data.(type) {
				case CreatePlayerData:
					fmt.Println("creating new player")
					id := fmt.Sprintf("player%d", playerCounter)
					player := &player{id, 30, 30, 10, "", data.send}
					players[id] = player
					playerCounter++

					fmt.Println("Sending info")
					data.info <- id

					fmt.Println("new player: " + id)
				case PlayerDisconnectedData:
					delete(players, data.playerId)
					fmt.Println("player left: " + data.playerId)
				case NewInputData:
					fmt.Println("new input")
					players[data.playerId].input = data.input
				}
			case <-ticker.C:
				fmt.Println("tick")
				msg := ""
				for _, player := range players {
					for _, d := range player.input {
						switch d {
						case 'w':
							player.y -= player.speed
						case 's':
							player.y += player.speed
						case 'a':
							player.x -= player.speed
						case 'd':
							player.x += player.speed
						}
					}

					if msg != "" {
						msg += "|"
					}
					msg += fmt.Sprintf("%s,%d,%d", player.id, player.x, player.y)
				}

				for _, player := range players {
					player.send <- msg
				}
			}
		}
	}()

	fmt.Println("Listening on :3000")
	http.ListenAndServe(":3000", nil)
}
