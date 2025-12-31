package game

import (
	"bytes"
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type ClientInfo struct {
	Id      int    `json:"id"`
	Name    string `json:"name"`
	Latency int    `json:"latency"`
}

type Client struct {
	mu   sync.Mutex
	info ClientInfo
	C    chan<- any
}

func NewClient() *Client {
	return &Client{
		mu: sync.Mutex{},
	}
}

func (c *Client) Serve(conn *websocket.Conn, fn func(p []byte)) {
	// channel for game to communicate with client
	ch := make(chan any)
	defer close(ch)
	c.C = ch

	// loop for reveiving message from game
	// and sending them to client
	go func() {
		for msg := range ch {
			msg, err := c.serializeMessage(msg)
			if err != nil {
				log.Println(err)
				continue
			}
			conn.WriteMessage(websocket.TextMessage, msg)
		}
	}()

	_, p, err := conn.ReadMessage()
	if err != nil {
		log.Println(err)
		return
	}

	if bytes.HasPrefix(p, []byte("name:")) {
		c.info.Name = string(p[5:])
		ch <- "name"
	}

	for {
		_, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			break
		}

		fn(p)

		// input := Input{}
		// err = json.Unmarshal(p, &input)
		// if err != nil {
		// 	log.Println(err)
		// 	continue
		// }
	}

}

func (c *Client) serializeMessage(msg any) ([]byte, error) {
	type Message struct {
		Type    string `json:"type"`
		Details any    `json:"details"`
	}

	switch m := msg.(type) {
	case LobbyState:
		msg = Message{
			Type:    "lobbyState",
			Details: m,
		}
	case GameResult:
		msg = Message{
			Type:    "gameResult",
			Details: m,
		}
	case string:
		msg = Message{
			Type:    "ok",
			Details: m,
		}
	}

	if msg, err := json.Marshal(msg); err == nil {
		return msg, nil
	} else {
		return nil, err
	}
}

func (c *Client) Info() ClientInfo {
	c.mu.Lock()
	info := c.info
	c.mu.Unlock()
	return info
}

func (c *Client) OnNewGameState(state ClientGameState) {
	c.C <- state
}
