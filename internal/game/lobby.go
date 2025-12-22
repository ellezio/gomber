package game

import (
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"
)

type LobbyClient struct {
	id     int64
	ch     chan<- any
	client *Client

	Admin bool
}

type LobbyState struct {
	Name    string       `json:"name"`
	Clients []ClientInfo `json:"clients"`
}

type Lobby struct {
	name    string
	clients map[int64]LobbyClient
	lastId  atomic.Int64
	mu      sync.RWMutex

	// tmp game props
	eventCh chan ClientEvent
	game    *Game
}

func NewLobby(name string) *Lobby {
	return &Lobby{
		name:    name,
		clients: map[int64]LobbyClient{},
		eventCh: make(chan ClientEvent),
	}
}

func (l *Lobby) AddClient(clientCh chan<- any, client *Client) LobbyHandler {
	lc := LobbyClient{ch: clientCh, id: l.lastId.Add(1), client: client}
	if len(l.clients) == 0 {
		lc.Admin = true
	}

	l.mu.Lock()
	l.clients[lc.id] = lc
	l.mu.Unlock()

	lh := LobbyHandler{
		clientId: lc.id,
		lobby:    l,
	}

	if l.game == nil {
		ls := l.State()

		l.mu.Lock()
		for _, c := range l.clients {
			if c.id != lc.id {
				c.ch <- ls
			}
		}
		l.mu.Unlock()
	}

	return lh
}

func (l *Lobby) RemoveClient(clientId int64) {
	l.mu.Lock()
	delete(l.clients, clientId)
	l.mu.Unlock()

	if l.game == nil {
		ls := l.State()

		l.mu.Lock()
		for _, c := range l.clients {
			c.ch <- ls
		}
		l.mu.Unlock()
	}
}

func (l *Lobby) SetMap(mapName string) {}

func (l *Lobby) RunGame(clientId int64) int64 {
	l.game = NewGame(l.eventCh)
	go l.game.Run("board1")
	return l.ConnectToGame(clientId)
}

func (l *Lobby) ConnectToGame(clientId int64) int64 {
	l.mu.RLock()
	client := l.clients[clientId]
	l.mu.RUnlock()

	clientIdCh := make(chan int)
	l.eventCh <- ClientConnectedEvent{IdCh: clientIdCh, ClientCh: client.ch}
	id := <-clientIdCh
	return int64(id)
}

func (l *Lobby) RequestState(clientId int64) int64 {
	if l.game != nil {
		playerId := l.ConnectToGame(clientId)
		return playerId
	}

	l.mu.RLock()
	client := l.clients[clientId]
	l.mu.RUnlock()

	ls := l.State()
	client.ch <- ls
	return -1
}

func (l *Lobby) State() LobbyState {
	l.mu.RLock()
	defer l.mu.RUnlock()

	ls := LobbyState{}
	ls.Name = l.name
	for _, c := range l.clients {
		ls.Clients = append(ls.Clients, c.client.Info())
	}

	return ls
}

type LobbyHandler struct {
	clientId int64
	playerId int64
	lobby    *Lobby
}

func (lh *LobbyHandler) Disconnect() {
	if lh.lobby == nil {
		return
	}
	lh.lobby.RemoveClient(lh.clientId)
	lh.lobby.eventCh <- ClientLeftEvent{Id: int(lh.playerId)}
}

func (lh *LobbyHandler) RequestState() {
	if lh.lobby == nil {
		return
	}
	playerId := lh.lobby.RequestState(lh.clientId)
	if playerId > 0 {
		lh.playerId = playerId
	}
}

func (lh *LobbyHandler) RunGame() {
	if lh.lobby == nil {
		return
	}
	lh.playerId = lh.lobby.RunGame(lh.clientId)
}

func (lh *LobbyHandler) HandleInput(p []byte) {
	input := Input{}
	err := json.Unmarshal(p, &input)
	if err != nil {
		log.Println(err)
		return
	}
	lh.lobby.eventCh <- ClientInputEvent{
		Id:    int(lh.playerId),
		Input: input,
	}
}
