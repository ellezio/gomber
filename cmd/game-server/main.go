package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "web/static/index.html")
	})

	http.Handle("/js/", http.StripPrefix("/js/", http.FileServer(http.Dir("web/js"))))

	fmt.Println("Listening on :3000")
	http.ListenAndServe(":3000", nil)
}