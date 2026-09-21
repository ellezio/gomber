package main

import (
	"bytes"
	"log"
	"net/http"

	"github.com/ellezio/gomber/internal/game"
	"github.com/gorilla/websocket"
)

var lobby *game.Lobby = game.NewLobby("unsafe test lobby")

func setupRoutes() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "web/static/index.html")
	})

	http.Handle("/dist/", http.StripPrefix("/dist/", http.FileServer(http.Dir("web/dist"))))

	http.HandleFunc("/connectplayer", func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		// TODO: Handle CheckOrigin - currently just omit
		upgrader.CheckOrigin = func(r *http.Request) bool { return true }
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println(err)
			return
		}

		var handler game.LobbyHandler

		client := game.NewClient()
		client.Serve(conn, func(p []byte) {
			if bytes.Equal(p, []byte("lobby:connect")) {
				handler = lobby.AddClient(client)
				handler.RequestState()
			} else if bytes.Equal(p, []byte("game:start")) {
				handler.RunGame()
			} else {
				handler.HandleInput(p)
			}
		})

		handler.Disconnect()
	})
}
