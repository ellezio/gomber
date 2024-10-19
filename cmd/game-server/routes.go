package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	game "github.com/ellezio/gomber/internal"
	"github.com/gorilla/websocket"
)

func setupRoutes(eventCh chan<- any, log *log.Logger) {
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

		client := game.NewClient(conn, log)

		eventCh <- game.ClientConnected{Client: client}
		eventCh <- game.PlayerCreation{Client: client}

		client.ListenForInput()

		eventCh <- game.ClientDisconnected{Client: client}
	})

	http.HandleFunc("/board", func(w http.ResponseWriter, r *http.Request) {
		bText, _ := os.ReadFile("maps/map1.txt")
		board := game.ParseToBoard([]byte(bText))
		b, _ := json.Marshal(board)
		w.Write(b)
	})
}
