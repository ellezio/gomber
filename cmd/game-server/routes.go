package main

import (
	"log"
	"net/http"

	"github.com/ellezio/gomber/internal/game"
	"github.com/gorilla/websocket"
)

func setupRoutes(eventCh chan<- game.ClientEvent) {
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

		client := game.NewClient(conn, log.Default())

		// channel for game to communicate with client
		clientCh := make(chan any)
		done := make(chan bool)

		// loop for reveiving message from game
		// and sending them to client
		go func() {
			for {
				select {
				case <-done:
					return
				case msg := <-clientCh:
					err := client.SendMessage(msg)
					if err != nil {
						log.Println(err)
					}
				}
			}
		}()

		clientIdCh := make(chan int)
		eventCh <- game.ClientConnectedEvent{IdCh: clientIdCh, ClientCh: clientCh}
		id := <-clientIdCh

		client.ListenForInput(func(input game.Input) {
			eventCh <- game.ClientInputEvent{
				Id:    id,
				Input: input,
			}
		})

		eventCh <- game.ClientLeftEvent{Id: id}
		done <- true
	})
}
