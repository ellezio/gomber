package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	game "github.com/ellezio/gomber/internal"
)

func main() {
	eventCh := make(chan any)
	log := log.New(os.Stdout, "", 0)

	setupRoutes(eventCh, log)
	go game.StartGameLoop(eventCh)

	fmt.Println("Listening on :3000")
	http.ListenAndServe(":3000", nil)
}
