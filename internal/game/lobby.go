package game

import (
	"encoding/json"
	"errors"
	"log"
	"log/slog"
	"sync"
	"sync/atomic"
)

type LobbyMessege interface {
	iLobbyMessege()
}

func (ConnectClientMessage) iLobbyMessege()    {}
func (DisconnectClientMessage) iLobbyMessege() {}
func (RunGameMessage) iLobbyMessege()          {}
func (SetMapMessage) iLobbyMessege()           {}
func (GameFinishedMessage) iLobbyMessege()     {}
func (ClientInpuMessage) iLobbyMessege()       {}
func (UpdateClientMessage) iLobbyMessege()     {}

type ConnectClientMessage struct {
	info     ClientInfo
	sendFn   SendClientMessage
	response chan<- LobbyResponse
}

type DisconnectClientMessage struct {
	clientID int
}

type RunGameMessage struct {
	clientID int
	response chan<- LobbyResponse
}

type SetMapMessage struct {
	clientID int
	mapName  string
}

type GameFinishedMessage struct {
	gameResult GameResult
}

type UpdateClientMessage struct {
	clientID int
	latency  int
}

type LobbyResponse struct {
	err error
}

type ClientInpuMessage struct {
	ClientInputEvent
}

type LobbyManager struct {
	mu      sync.RWMutex
	lobbies map[int]*Lobby
	nextID  int
}

func NewLobbyManager() *LobbyManager {
	lm := &LobbyManager{lobbies: make(map[int]*Lobby)}
	// lm.Create("lobby name")
	return lm
}

func (ls *LobbyManager) Create(name string) int {
	lobby := NewLobby(name)

	ls.mu.Lock()
	lobbyID := ls.nextID
	ls.lobbies[lobbyID] = lobby
	ls.nextID++
	ls.mu.Unlock()

	go func() {
		lobby.Start()

		ls.mu.Lock()
		delete(ls.lobbies, lobbyID)
		ls.mu.Unlock()
	}()

	return lobbyID
}

func (ls *LobbyManager) Join(lobbyId int, info ClientInfo, sendFn SendClientMessage) (*LobbyHandler, error) {
	ls.mu.Lock()
	lobby, ok := ls.lobbies[lobbyId]
	ls.mu.Unlock()

	if !ok || lobby.state.Load() == state_closing {
		return nil, errors.New("Lobby not exists")
	}

	responseCh := make(chan LobbyResponse)
	msg := ConnectClientMessage{
		info:     info,
		sendFn:   sendFn,
		response: responseCh,
	}

	select {
	case <-lobby.done:
		return nil, errors.New("Lobby not exists")
	case lobby.ch <- msg:
	}

	select {
	case <-lobby.done:
		return nil, errors.New("Lobby not exists")
	case response := <-responseCh:
		if response.err != nil {
			return nil, response.err
		}
	}

	lobbyHandler := &LobbyHandler{
		clientID: info.Id,
		lobbyCh:  lobby.ch,
	}

	return lobbyHandler, nil
}

type LobbyClient struct {
	sendFn SendClientMessage

	clientID int
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

const (
	messageQueueSize = 64
)

const (
	state_inLobby int32 = iota
	state_inGame
	state_closing
)

type Lobby struct {
	name    string
	clients map[int]*LobbyClient

	// tmp game props
	eventCh chan ClientEvent
	state   atomic.Int32

	ch      chan LobbyMessege
	gameMap string
	done    chan struct{}
}

func NewLobby(name string) *Lobby {
	return &Lobby{
		name:    name,
		clients: map[int]*LobbyClient{},
		eventCh: make(chan ClientEvent),
		ch:      make(chan LobbyMessege, messageQueueSize),
		done:    make(chan struct{}),

		// TODO: remove when added map picker
		gameMap: "board1",
	}
}

func (l *Lobby) Start() {
	defer close(l.done)

	for msg := range l.ch {
		stop := l.handleMessage(msg)
		if stop {
			break
		}
	}

	for {
		select {
		case msg := <-l.ch:
			l.handleMessage(msg)
		default:
			return
		}
	}
}

func (l *Lobby) handleMessage(message LobbyMessege) bool {
	switch msg := message.(type) {
	case ConnectClientMessage:
		err := l.connectClient(msg)
		msg.response <- LobbyResponse{err: err}

	case DisconnectClientMessage:
		l.removeClient(msg.clientID)
		if len(l.clients) == 0 {
			l.state.Store(state_closing)
			return true
		}

	case RunGameMessage:
		err := l.runGame(msg.clientID)
		msg.response <- LobbyResponse{err: err}

	case SetMapMessage:
		l.setMap(msg.mapName)

	case GameFinishedMessage:
		l.broadcaseClientMessage(msg.gameResult)

	case ClientInpuMessage:
		l.handleClientInput(msg.ClientInputEvent)

	case UpdateClientMessage:
		l.updateClient(msg)

	default:
		slog.Error("unexpected game.LobbyMessege", "message", msg)
	}

	return false
}

func (l *Lobby) updateClient(msg UpdateClientMessage) {
	// Just ignore if client is not found because client has to
	// join to lobby to be able to send this message.
	if client, ok := l.clients[msg.clientID]; ok {
		client.latency = msg.latency
	}

	ls := l.State()
	l.broadcaseClientMessage(ls)
}

func (l *Lobby) connectClient(connClientMsg ConnectClientMessage) error {
	switch l.state.Load() {
	case state_inGame:
		return errors.New("cannot join, game is running")
	case state_closing:
		return errors.New("cannot join, lobby just closed")
	}

	lc := LobbyClient{
		clientID: connClientMsg.info.Id,
		name:     connClientMsg.info.Name,
		latency:  connClientMsg.info.Latency,
		sendFn:   connClientMsg.sendFn,
	}

	if len(l.clients) == 0 {
		lc.Admin = true
	}

	l.clients[lc.clientID] = &lc

	ls := l.State()

	l.broadcaseClientMessage(ls)

	return nil
}

func (l *Lobby) removeClient(clientID int) {
	chooseAdmin := l.clients[clientID].Admin

	delete(l.clients, clientID)

	ls := l.State()

	for _, c := range l.clients {
		if chooseAdmin {
			c.Admin = true
			chooseAdmin = false
		}

		c.sendFn(ls)
	}

	if l.state.Load() == state_inGame {
		l.eventCh <- ClientLeftEvent{Id: clientID}
	}
}

func (l *Lobby) setMap(mapName string) {
	l.gameMap = mapName
}

func (l *Lobby) runGame(clientId int) error {
	switch l.state.Load() {
	case state_inGame:
		return errors.New("game is already running")
	case state_closing:
		return errors.New("lobby just closed")
	}

	client, ok := l.clients[clientId]
	if !ok {
		return errors.New("not in lobby")
	}

	if !client.Admin {
		return errors.New("only admin can start game")
	}

	for len(l.eventCh) > 0 {
		<-l.eventCh
	}

	gameMap := l.gameMap

	go func() {
		game := NewGame(l.eventCh)
		l.state.Store(state_inGame)
		gr := game.Run(gameMap)

		if l.state.Load() == state_closing {
			return
		}

		l.state.Store(state_inLobby)
		l.ch <- GameFinishedMessage{gameResult: gr}
	}()

	for _, c := range l.clients {
		l.eventCh <- ClientConnectedEvent{ClientId: c.clientID, Notifier: c, Name: c.name}
	}

	return nil
}

func (l *Lobby) State() LobbyState {
	ls := LobbyState{}
	ls.Name = l.name
	for _, c := range l.clients {
		ls.Clients = append(ls.Clients, ClientInfo{Id: c.clientID, Name: c.name, Latency: c.latency})
	}

	return ls
}

func (l *Lobby) broadcaseClientMessage(msg ClientMessage) {
	for _, c := range l.clients {
		c.sendFn(msg)
	}
}

func (l *Lobby) handleClientInput(inp ClientInputEvent) {
	if l.eventCh != nil && l.state.Load() == state_inGame {
		l.eventCh <- inp
	}
}

type LobbyHandler struct {
	clientID int
	lobbyCh  chan<- LobbyMessege
}

func (lh *LobbyHandler) Disconnect() {
	lh.lobbyCh <- DisconnectClientMessage{
		clientID: lh.clientID,
	}
}

func (lh *LobbyHandler) RunGame() error {
	responseCh := make(chan LobbyResponse)
	lh.lobbyCh <- RunGameMessage{
		clientID: lh.clientID,
		response: responseCh,
	}
	response := <-responseCh
	return response.err
}

func (lh *LobbyHandler) UpdateLatency(latency int) {
	msg := UpdateClientMessage{
		clientID: lh.clientID,
		latency:  latency,
	}

	// there is no need to block client when channel is blocked
	// as this information is not critical for lobby to know
	select {
	case lh.lobbyCh <- msg:
	default:
	}
}

func (lh *LobbyHandler) HandleInput(p []byte) {
	input := Input{}
	err := json.Unmarshal(p, &input)
	if err != nil {
		log.Println(err)
		return
	}

	lh.lobbyCh <- ClientInpuMessage{
		ClientInputEvent: ClientInputEvent{
			Id:    lh.clientID,
			Input: input,
		},
	}
}
