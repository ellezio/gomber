package main

import (
	"flag"
	"fmt"
	"net/http"

	"github.com/ellezio/gomber/internal/game"
)

func main() {
	port := flag.String("port", "3000", "port on which server listen at")
	flag.Parse()

	// through this channel client send events to game server
	eventCh := make(chan game.ClientEvent)

	game := game.NewGame(eventCh)

	// Currently when server starts
	// the game start with board loaded
	// and ready to play.
	// In futre there will be menu to create
	// game with choosen board.
	go game.Run("board1")

	setupRoutes(eventCh)

	fmt.Printf("Listening on :%s\n", *port)
	http.ListenAndServe(fmt.Sprintf(":%s", *port), nil)
}
