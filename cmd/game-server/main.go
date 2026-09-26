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

	gameServer := game.NewServer()
	setupRoutes(gameServer)

	fmt.Printf("Listening on :%s\n", *port)
	http.ListenAndServe(fmt.Sprintf(":%s", *port), nil)
}
