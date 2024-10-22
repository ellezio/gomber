package game

import (
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

type updateMessage struct {
	ControlledEntityId int    `json:"controlledEntityId"`
	ProcessedInput     *Input `json:"processedInput"`
	Board              *Board `json:"board"`
}

type Client struct {
	mu   sync.Mutex
	log  *log.Logger
	conn *websocket.Conn

	unprocessedInputs   []Input
	processedInput      *Input
	hasUnprocessedInput atomic.Bool
}

func NewClient(conn *websocket.Conn, log *log.Logger) *Client {
	return &Client{
		mu:                sync.Mutex{},
		unprocessedInputs: []Input{},
		processedInput:    nil,
		conn:              conn,
		log:               log,
	}
}

func (c *Client) SetProcessedInput(input *Input) {
	c.mu.Lock()
	c.processedInput = input
	c.mu.Unlock()
}

func (c *Client) getAndDeleteProcessedInput() *Input {
	c.mu.Lock()
	defer c.mu.Unlock()

	i := c.processedInput
	c.processedInput = nil
	return i
}

func (c *Client) PopUnprocessedInput() (Input, bool) {
	if !c.HasInput() {
		return Input{}, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	input := c.unprocessedInputs[0]
	c.unprocessedInputs = c.unprocessedInputs[1:]

	if len(c.unprocessedInputs) == 0 {
		c.hasUnprocessedInput.Store(false)
	}

	return input, true
}

func (c *Client) HasInput() bool {
	return c.hasUnprocessedInput.Load()
}

func (c *Client) SendUpdate(controlledEntityId int, board *Board) {
	msg := updateMessage{
		ControlledEntityId: controlledEntityId,
		ProcessedInput:     c.getAndDeleteProcessedInput(),
		Board:              board,
	}

	if err := c.sendMessage(msg); err != nil {
		c.log.Println(err)
	}
}

func (c *Client) sendMessage(msg any) error {
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
		c.unprocessedInputs = append(c.unprocessedInputs, input)
		c.hasUnprocessedInput.Store(true)
		c.mu.Unlock()
	}
}
