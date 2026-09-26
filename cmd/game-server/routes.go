package main

import (
	"log"
	"net/http"

	"github.com/ellezio/gomber/internal/game"
	"github.com/gorilla/websocket"
)

func setupRoutes(gameServer *game.Server) {
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

		gameServer.ServeClient(conn)
	})
}
