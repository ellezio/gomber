package main

import (
	"bytes"
	"log"
	"net/http"

	"github.com/ellezio/gomber/internal/game"
	"github.com/gorilla/websocket"
)

var lobby *game.Lobby = game.NewLobby("unsafe test lobby")
var eventCh = make(chan game.ClientEvent)

func setupRoutes() {
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

		var handler game.LobbyHandler

		// var g *game.Game
		// var id int
		client := game.NewClient()
		client.Serve(conn, func(p []byte) {
			if bytes.Equal(p, []byte("lobby:connect")) {
				handler = lobby.AddClient(client)
				handler.RequestState()
			} else if bytes.Equal(p, []byte("game:start")) {
				handler.RunGame()
				// g = game.NewGame(eventCh)
				// go g.Run("board1")
				// clientIdCh := make(chan int)
				// eventCh <- game.ClientConnectedEvent{IdCh: clientIdCh, ClientCh: clientCh}
				// id = <-clientIdCh
			} else {
				handler.HandleInput(p)
				// input := game.Input{}
				// err = json.Unmarshal(p, &input)
				// if err != nil {
				// 	log.Println(err)
				// 	return
				// }
				// eventCh <- game.ClientInputEvent{
				// 	Id:    id,
				// 	Input: input,
				// }
			}
		})

		// clientIdCh := make(chan int)
		// eventCh <- game.ClientConnectedEvent{IdCh: clientIdCh, ClientCh: clientCh}
		// id := <-clientIdCh

		// client.ListenForInput(func(input game.Input) {
		// eventCh <- game.ClientInputEvent{
		// 	Id:    id,
		// 	Input: input,
		// }
		// })

		// eventCh <- game.ClientLeftEvent{Id: id}
		handler.Disconnect()
	})
}
