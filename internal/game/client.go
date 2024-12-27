package game

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	mu   sync.Mutex
	log  *log.Logger
	conn *websocket.Conn
}

func NewClient(conn *websocket.Conn, log *log.Logger) *Client {
	return &Client{
		mu:   sync.Mutex{},
		conn: conn,
		log:  log,
	}
}

func (c *Client) SendMessage(msg any) error {
	if msg, err := c.serializeMessage(msg); err != nil {
		return err
	} else {
		c.mu.Lock()
		c.conn.WriteMessage(websocket.TextMessage, msg)
		c.mu.Unlock()
	}

	return nil
}

func (c *Client) serializeMessage(msg any) ([]byte, error) {
	if msg, err := json.Marshal(msg); err == nil {
		return msg, nil
	} else {
		return nil, err
	}
}

func (c *Client) ListenForInput(onInput func(input Input)) {
	for {
		_, p, err := c.conn.ReadMessage()
		if err != nil {
			c.log.Println(err)
			break
		}

		input := Input{}
		err = json.Unmarshal(p, &input)
		if err != nil {
			c.log.Println(err)
			continue
		}

		onInput(input)
	}
}
