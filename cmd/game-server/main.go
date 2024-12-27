package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/ellezio/gomber/internal/game"
)

func main() {
	eventCh := make(chan game.ClientEvent)
	log := log.New(os.Stdout, "", 0)

	game := game.NewGame(eventCh)
	go game.Run("board1")

	setupRoutes(eventCh, log)

	fmt.Println("Listening on :3000")
	http.ListenAndServe(":3000", nil)
}
