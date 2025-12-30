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
	conn *websocket.Conn
	info ClientInfo
}

func NewClient(conn *websocket.Conn) *Client {
	return &Client{
		mu:   sync.Mutex{},
		conn: conn,
	}
}

func (c *Client) SendMessage(msg any) error {
	if msg, err := c.serializeMessage(msg); err != nil {
		return err
	} else {
		c.WriteMessage(msg)
	}

	return nil
}

func (c *Client) WriteMessage(msg []byte) {
	c.mu.Lock()
	c.conn.WriteMessage(websocket.TextMessage, msg)
	c.mu.Unlock()
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

func (c *Client) Serve(fn func(p []byte)) {
	for {
		_, p, err := c.conn.ReadMessage()
		if err != nil {
			log.Println(err)
			break
		}

		if bytes.HasPrefix(p, []byte("name:")) {
			c.info.Name = string(p[5:])
			c.SendMessage("name")
			continue
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

func (c *Client) Info() ClientInfo {
	c.mu.Lock()
	info := c.info
	c.mu.Unlock()
	return info
}
