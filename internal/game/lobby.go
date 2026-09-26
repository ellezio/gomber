package game

import (
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"
)

type LobbyMessege interface {
	iLobbyMessege()
}

func (ConnectClientMessage) iLobbyMessege() {}

type ConnectClientMessage struct {
	info   ClientInfo
	sendFn SendClientMessage
}

type LobbyManager struct {
	lobbies map[int]*Lobby
}

func NewLobbyManager() *LobbyManager {
	lobbies := make(map[int]*Lobby)
	lobbies[1] = NewLobby("unsafe test lobby")
	return &LobbyManager{lobbies: lobbies}
}

func (ls *LobbyManager) Create() {}

func (ls *LobbyManager) Join(lobbyId int, info ClientInfo, sendFn SendClientMessage) *LobbyHandler {
	lobby, _ := ls.lobbies[lobbyId]
	return lobby.AddClient(ConnectClientMessage{
		info:   info,
		sendFn: sendFn,
	})
}

func (ls *LobbyManager) Leave() {}

func (ls *LobbyManager) HandleAction() {}

func (ls *LobbyManager) SendMessage(lobbyId int, message LobbyMessege) {}

type LobbyClient struct {
	// id int
	sendFn SendClientMessage

	// client   *ClientSession
	clientId int
	name     string
	latency  int

	Admin bool
}

func (lc *LobbyClient) OnNewGameState(state ClientGameState) {
	lc.sendFn(state)
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

func (l *Lobby) AddClient(connClientMsg ConnectClientMessage) *LobbyHandler {
	lc := LobbyClient{
		clientId: connClientMsg.info.Id,
		name:     connClientMsg.info.Name,
		latency:  connClientMsg.info.Latency,
		sendFn:   connClientMsg.sendFn,
	}

	if len(l.clients) == 0 {
		lc.Admin = true
	}

	l.mu.Lock()
	l.clients[lc.clientId] = lc
	l.mu.Unlock()

	lh := LobbyHandler{
		clientId: lc.clientId,
		lobby:    l,
	}

	ls := l.State()

	l.mu.Lock()
	for _, c := range l.clients {
		if c.clientId != lc.clientId {
			c.sendFn(ls)
		}
	}
	l.mu.Unlock()

	return &lh
}

func (l *Lobby) RemoveClient(clientId int) {
	l.mu.Lock()
	delete(l.clients, clientId)
	l.mu.Unlock()

	ls := l.State()

	l.mu.Lock()
	for _, c := range l.clients {
		c.sendFn(ls)
	}
	l.mu.Unlock()
}

func (l *Lobby) SetMap(mapName string) {}

func (l *Lobby) RunGame(clientId int) {
	for len(l.eventCh) > 0 {
		<-l.eventCh
	}

	l.game = NewGame(l.eventCh)
	go func() {
		gr := l.game.Run("board1")
		l.game = nil
		l.mu.Lock()
		for _, c := range l.clients {
			c.sendFn(gr)
		}
		l.mu.Unlock()
	}()

	l.mu.Lock()
	for _, c := range l.clients {
		l.eventCh <- ClientConnectedEvent{ClientId: c.clientId, Notifier: &c, Name: c.name}
	}
	l.mu.Unlock()
}

func (l *Lobby) ConnectToGame(clientId int) {
	l.mu.RLock()
	client := l.clients[clientId]
	l.mu.RUnlock()

	l.eventCh <- ClientConnectedEvent{ClientId: clientId, Notifier: &client, Name: client.name}
}

func (l *Lobby) RequestState(clientId int) {
	l.mu.RLock()
	client := l.clients[clientId]
	l.mu.RUnlock()

	ls := l.State()
	client.sendFn(ls)

	if l.game != nil {
		l.ConnectToGame(clientId)
	}
}

func (l *Lobby) State() LobbyState {
	l.mu.RLock()
	defer l.mu.RUnlock()

	ls := LobbyState{}
	ls.Name = l.name
	for _, c := range l.clients {
		ls.Clients = append(ls.Clients, ClientInfo{Id: c.clientId, Name: c.name, Latency: c.latency})
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
