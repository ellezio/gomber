package game

import (
	"encoding/json"
	"errors"
	"log"
	"sync"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

type Client struct {
	mu   sync.Mutex
	log  *log.Logger
	conn *websocket.Conn

	inputs              []Input
	hasUnprocessedInput atomic.Bool
}

type messageKind = string

const (
	PlayerInit messageKind = "PlayerInit"
	GameState  messageKind = "GameState"
)

type message struct {
	Kind messageKind `json:"type"`
	Data any         `json:"data"`
}

func NewClient(conn *websocket.Conn, log *log.Logger) *Client {
	return &Client{
		mu:     sync.Mutex{},
		inputs: []Input{},
		conn:   conn,
		log:    log,
	}
}

func (c *Client) PopInput() (Input, bool) {
	if !c.HasInput() {
		return Input{}, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	input := c.inputs[0]
	c.inputs = c.inputs[1:]

	if len(c.inputs) == 0 {
		c.hasUnprocessedInput.Store(false)
	}

	return input, true
}

func (c *Client) HasInput() bool {
	return c.hasUnprocessedInput.Load()
}

func (c *Client) SendGameState(gameState State) {
	msg := message{GameState, gameState}
	c.sendMessage(msg)
}

func (c *Client) SendPlayerInfo(player Player) {
	msg := message{PlayerInit, player}
	c.sendMessage(msg)
}

func (c *Client) sendMessage(msg message) error {
	if msg, err := c.serializeMessage(msg); err != nil {
		return err
	} else {
		c.mu.Lock()
		c.conn.WriteMessage(websocket.TextMessage, msg)
		c.mu.Unlock()
	}

	return nil
}

func (c *Client) serializeMessage(msg message) ([]byte, error) {
	if msg, err := json.Marshal(msg); err == nil {
		return msg, nil
	} else {
		return nil, errors.New("")
	}
}

func (c *Client) ListenForInput() {
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

		c.mu.Lock()
		c.inputs = append(c.inputs, input)
		c.hasUnprocessedInput.Store(true)
		c.mu.Unlock()
	}
}
