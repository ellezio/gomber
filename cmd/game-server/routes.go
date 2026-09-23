package main

import (
	"log"
	"net/http"
	"sync/atomic"

	"github.com/ellezio/gomber/internal/game"
	"github.com/gorilla/websocket"
)

var lobbyService = game.NewLobbyService()
var nextId atomic.Int32

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

		client := game.NewClient(int(nextId.Add(1)), lobbyService)
		client.Serve(conn)
	})
}
