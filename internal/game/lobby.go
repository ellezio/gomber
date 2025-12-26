package game

import (
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"
)

type LobbyClient struct {
	id     int
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
	clients map[int]LobbyClient
	lastId  atomic.Int64
	mu      sync.RWMutex

	// tmp game props
	eventCh chan ClientEvent
	game    *Game
}

func NewLobby(name string) *Lobby {
	return &Lobby{
		name:    name,
		clients: map[int]LobbyClient{},
		eventCh: make(chan ClientEvent),
	}
}

func (l *Lobby) AddClient(clientCh chan<- any, client *Client) LobbyHandler {
	lc := LobbyClient{ch: clientCh, id: int(l.lastId.Add(1)), client: client}
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

func (l *Lobby) RemoveClient(clientId int) {
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

func (l *Lobby) RunGame(clientId int) {
	for len(l.eventCh) > 0 {
		<-l.eventCh
	}

	l.game = NewGame(l.eventCh)
	go func() {
		gr := l.game.Run("board1")
		log.Println(gr)
		l.game = nil
		ls := l.State()
		l.mu.Lock()
		for _, c := range l.clients {
			c.ch <- ls
		}
		l.mu.Unlock()
	}()

	l.mu.Lock()
	for _, c := range l.clients {
		l.eventCh <- ClientConnectedEvent{ClientId: c.id, ClientCh: c.ch, Name: c.client.info.Name}
	}
	l.mu.Unlock()
}

func (l *Lobby) ConnectToGame(clientId int) {
	l.mu.RLock()
	client := l.clients[clientId]
	l.mu.RUnlock()

	l.eventCh <- ClientConnectedEvent{ClientId: clientId, ClientCh: client.ch, Name: client.client.info.Name}
}

func (l *Lobby) RequestState(clientId int) {
	if l.game != nil {
		l.ConnectToGame(clientId)
		return
	}

	l.mu.RLock()
	client := l.clients[clientId]
	l.mu.RUnlock()

	ls := l.State()
	client.ch <- ls
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
	clientId int
	lobby    *Lobby
}

func (lh *LobbyHandler) Disconnect() {
	if lh.lobby == nil {
		return
	}
	lh.lobby.RemoveClient(lh.clientId)
	if lh.lobby.game != nil {
		lh.lobby.eventCh <- ClientLeftEvent{Id: lh.clientId}
	}
}

func (lh *LobbyHandler) RequestState() {
	if lh.lobby == nil {
		return
	}
	lh.lobby.RequestState(lh.clientId)
}

func (lh *LobbyHandler) RunGame() {
	if lh.lobby == nil {
		return
	}
	lh.lobby.RunGame(lh.clientId)
}

func (lh *LobbyHandler) HandleInput(p []byte) {
	input := Input{}
	err := json.Unmarshal(p, &input)
	if err != nil {
		log.Println(err)
		return
	}
	lh.lobby.eventCh <- ClientInputEvent{
		Id:    lh.clientId,
		Input: input,
	}
}
