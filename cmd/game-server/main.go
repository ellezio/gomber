package main

import (
	"flag"
	"fmt"
	"net/http"
)

func main() {
	port := flag.String("port", "3000", "port on which server listen at")
	flag.Parse()

	setupRoutes()

	fmt.Printf("Listening on :%s\n", *port)
	http.ListenAndServe(fmt.Sprintf(":%s", *port), nil)
}
