package game

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"
	"uuid"

	"github.com/gorilla/websocket"
)

const (
	maxMessageSize     = 4 << 10
	maxNameLength      = 32
	updateQueueSize    = 64
	writeTimeout       = 10 * time.Second
	readTimeout        = 60 * time.Second
	pingInterval       = readTimeout * 1 / 10
	reconnectionWindow = 60 * time.Second
)

type SendClientMessage func(ClientMessage)

type ClientMessage interface {
	iClientMessage()
}

func (GameStartedMessage) iClientMessage() {}
func (ClientGameState) iClientMessage()    {}
func (LobbyState) iClientMessage()         {}
func (GameResult) iClientMessage()         {}
func (NameMessage) iClientMessage()        {}
func (ErrorMessage) iClientMessage()       {}
func (LobbyClosed) iClientMessage()        {}
func (Lobbies) iClientMessage()            {}
func (SessionInfoMessage) iClientMessage() {}

type Lobbies []*LobbyInfo

type NameMessage struct {
	value string
}

type ErrorMessage struct {
	value string
}

type SessionInfoMessage struct {
	SessionID string             `json:"sid"`
	State     clientSessionState `json:"state"`
}

type LobbyClosed struct {
}

type ClientWrapper struct {
	session  *ClientSession
	reconnCh chan<- *websocket.Conn
	done     <-chan struct{}
}

type ClientManager struct {
	mu      sync.Mutex
	nextID  atomic.Int32
	clients map[uuid.UUID]*ClientWrapper
}

func NewClientManager() *ClientManager {
	return &ClientManager{
		clients: make(map[uuid.UUID]*ClientWrapper),
	}
}

func (cm *ClientManager) ConnectClient(conn *websocket.Conn, lobbies *LobbyManager) {
	if err := conn.SetReadDeadline(time.Now().Add(readTimeout)); err != nil {
		fmt.Println(err)
		conn.Close()
		return
	}

	msg, err := readTextMessage(conn)
	if err != nil {
		fmt.Println(err)
		conn.Close()
		return
	}

	if len(msg) > 0 {
		sessionID, _ := uuid.Parse(string(msg))

		cm.mu.Lock()
		clientWrp, ok := cm.clients[sessionID]
		cm.mu.Unlock()

		if ok {
			select {
			case clientWrp.reconnCh <- conn:
				return
			case <-clientWrp.done:
			}
		}

	}

	cm.ServeClient(conn, lobbies)
}

func (cm *ClientManager) ServeClient(conn *websocket.Conn, lobbies *LobbyManager) {
	clientID := int(cm.nextID.Add(1))
	sessionID := uuid.NewV4()
	client := NewClient(clientID, sessionID, lobbies)
	reconnCh := make(chan *websocket.Conn)
	done := make(chan struct{})
	clientWrp := &ClientWrapper{session: client, reconnCh: reconnCh, done: done}

	cm.mu.Lock()
	cm.clients[sessionID] = clientWrp
	cm.mu.Unlock()

	serverDone := make(chan error)

	reconnTimer := time.NewTimer(reconnectionWindow)
	reconnTimer.Stop()
	defer reconnTimer.Stop()

loop:
	for conn != nil {
		go func() {
			serverDone <- client.Serve(conn)
		}()

		select {
		case newconn := <-reconnCh:
			// This route is taken when client tries to reconnect but the server
			// was not notified yet about dropped connection because of some
			// network issues.
			// This route also may take place when someone uses the same session
			// token.
			// This will drop an existing connection so to not cause
			// constant reconnecting from client in case of using same
			// session ID on both connection. This may be sign of compromised
			// session ID which currently I don't know how to solve with maintaining
			// ability to reconnect from some network issues.

			conn.Close()
			<-serverDone
			conn = newconn

			cm.mu.Lock()
			cwrp := cm.clients[sessionID]
			delete(cm.clients, sessionID)

			sessionID = uuid.NewV4()
			cwrp.session.sessionID = sessionID
			cm.clients[sessionID] = cwrp
			cm.mu.Unlock()

		case err := <-serverDone:
			if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				break loop
			}

			reconnTimer.Reset(reconnectionWindow)
			select {
			case conn = <-reconnCh:
				reconnTimer.Stop()
			case <-reconnTimer.C:
				break loop
			}
		}
	}

	close(done)

	cm.mu.Lock()
	delete(cm.clients, sessionID)
	cm.mu.Unlock()

	client.Destroy()
}

type ClientInfo struct {
	Id      int    `json:"id"`
	Name    string `json:"name"`
	Latency int    `json:"latency"`
}

type clientSessionState int

const (
	state_Created clientSessionState = iota
	state_Logged
	state_InLobby
)

type ClientSession struct {
	info      ClientInfo
	sessionID uuid.UUID
	state     clientSessionState

	// Those channels cannot be closed because some part of system may still
	// use them to notify client until they got notified about client session
	// being closed then they should unregister client notification mechanism
	// after which the GC will clean the channels.
	update           chan ClientMessage
	updateBufferFull chan struct{}

	LobbyManager *LobbyManager
	lobbyHandler *LobbyHandler

	// TODO:
	// This currently also lock the lobbyHandler which I don't want to
	// I am leaving this for now but I have to think about some way to
	// synchronously update ClientSession to not get into some nasy locking
	// when it's not needed I might be easy deadlock by mistake
	mu             sync.Mutex
	latencyTracker map[int]time.Time
	nextPingID     int
}

func NewClient(id int, sessionID uuid.UUID, lm *LobbyManager) *ClientSession {
	return &ClientSession{
		info:             ClientInfo{Id: id},
		sessionID:        sessionID,
		state:            state_Created,
		update:           make(chan ClientMessage, updateQueueSize),
		updateBufferFull: make(chan struct{}, 1),
		LobbyManager:     lm,
		latencyTracker:   make(map[int]time.Time),
	}
}

func (c *ClientSession) Serve(conn *websocket.Conn) error {
	if conn == nil {
		slog.Error("cannot serve a nil websocket connection")
		return errors.New("conn cannot be nil")
	}
	defer conn.Close()

	for len(c.update) > 0 {
		<-c.update
	}

	if len(c.updateBufferFull) > 0 {
		<-c.updateBufferFull
	}

	conn.SetReadLimit(maxMessageSize)
	conn.SetPongHandler(func(pingID string) error {
		err := c.measurePingLatency(pingID)
		if err != nil {
			slog.Error("failed to measure pingID", "pingID", pingID, "error", err.Error())
			// Invalid pongs should not extend read deadline.
			return nil
		}

		return conn.SetReadDeadline(time.Now().Add(readTimeout))
	})

	if err := conn.SetReadDeadline(time.Now().Add(readTimeout)); err != nil {
		slog.Error("failed to set read deadline", "clientID", c.info.Id, "error", err.Error())
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())

	var wg sync.WaitGroup
	wg.Go(func() {
		if err := c.serveUpdates(ctx, conn); err != nil {
			// There is no point in connection that cannot sent updates and
			// closing the websocket also unblocks ReadMessage, allowing
			// the client session to shut down.
			_ = conn.Close()
		}
	})

	defer func() {
		cancel()
		_ = conn.Close()
		wg.Wait()
	}()

	c.mu.Lock()
	if c.lobbyHandler != nil {
		if err := c.joinToLobby(ctx, c.lobbyHandler.lobbyID); err != nil {
			c.state = state_Logged
			c.send(ctx, ErrorMessage{value: err.Error()})
		}
	}
	c.mu.Unlock()

	c.send(ctx, SessionInfoMessage{SessionID: c.sessionID.String(), State: c.state})

	if c.state == state_Created {
		for {
			p, err := readTextMessage(conn)
			if err != nil {
				return err
			}

			c.info.Name, err = parseNameMessage(p)
			if err == nil {
				break
			}
			c.send(ctx, ErrorMessage{value: err.Error()})
		}

		c.state = state_Logged
		c.send(ctx, NameMessage{value: "name"})
	}

	for {
		p, err := readTextMessage(conn)
		if err != nil {
			return err
		}

		if err := c.handleInput(ctx, p); err != nil {
			c.send(ctx, ErrorMessage{value: err.Error()})
		}
	}
}

// Destroy disconnects session from other parts of system hence making reconnecting imposible.
func (c *ClientSession) Destroy() {
	c.mu.Lock()
	if c.lobbyHandler != nil {
		c.lobbyHandler.Disconnect()
		c.lobbyHandler = nil
	}
	c.mu.Unlock()
}

// readTextMessage is helper for reading message from websocket.
// It handles invalid messages and closed connections.
// When error is returned connection is unusable and should be closed.
func readTextMessage(conn *websocket.Conn) ([]byte, error) {
	messageType, p, err := conn.ReadMessage()

	if err != nil {
		if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
			slog.Error("failed to read websocket's text message", "error", err.Error())
			return nil, fmt.Errorf("reading message: %v", err)
		}

		return nil, err
	}

	// Disconnecting here is valid because I strictly operate on one message type
	if messageType != websocket.TextMessage {
		closeWithPolicyViolation(conn, "only text messages are supported")
		return nil, fmt.Errorf("invalid message type, expected to be TextMessage")
	}

	return p, nil
}

func (c *ClientSession) serveUpdates(
	ctx context.Context,
	conn *websocket.Conn,
) error {
	ping := time.NewTicker(pingInterval)
	defer ping.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-c.updateBufferFull:
			// TODO: reconnecting client
			//
			// This message is sent if buffered channel for updates is full
			// which means that client is falling behind hence updates takes
			// up resources. It's better to diconnect client and wait for
			// eventual reconnection and send single new state update then
			// bombarding the client with state update after falling behind to much.
			return errors.New("update buffer is full")
		case update := <-c.update:
			// the clients updates should be chanded to client messages to be semantically corrent
			if _, ok := update.(LobbyClosed); ok {
				c.mu.Lock()
				c.lobbyHandler = nil
				c.mu.Unlock()
			}

			message, err := serializeMessage(update)
			if err != nil {
				return err
			}

			if err := conn.SetWriteDeadline(time.Now().Add(writeTimeout)); err != nil {
				return err
			}
			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return err
			}
		case <-ping.C:
			if err := conn.SetWriteDeadline(time.Now().Add(writeTimeout)); err != nil {
				return err
			}
			pingID := c.registerPing()
			if err := conn.WriteMessage(websocket.PingMessage, []byte(pingID)); err != nil {
				return err
			}
		}
	}
}

func (c *ClientSession) registerPing() string {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.latencyTracker[c.nextPingID] = time.Now()
	pingID := strconv.Itoa(c.nextPingID)
	c.nextPingID++

	return pingID
}

func (c *ClientSession) measurePingLatency(pingID string) error {
	id, err := strconv.ParseInt(pingID, 10, 64)

	c.mu.Lock()
	defer c.mu.Unlock()

	if err != nil {
		// This should not happen but if it does we have to some how clear stall
		// registered times, so the only thing is to clear the tracker.
		clear(c.latencyTracker)
		return fmt.Errorf("failed to parse pingID: %w", err)
	}

	if l, ok := c.latencyTracker[int(id)]; ok {
		delete(c.latencyTracker, int(id))
		latency := int(time.Since(l).Milliseconds())

		if c.lobbyHandler != nil {
			c.lobbyHandler.UpdateLatency(latency)
		}

		c.info.Latency = latency
		return nil
	}

	return errors.New("requested pingID not exists")
}

type ClientRequstMessage struct {
	raw []byte
	off int
}

// Next return slice up to next separator or what left from current offset if non was found.
//
// Operation advances the offset.
func (crm *ClientRequstMessage) Next() []byte {
	if crm.off >= len(crm.raw) {
		return nil
	}

	var result []byte
	idx := bytes.IndexByte(crm.raw[crm.off:], ':')
	if idx == -1 {
		result = crm.raw[crm.off:]
		crm.off = crm.off + len(crm.raw)
	} else {
		result = crm.raw[crm.off : crm.off+idx]
		crm.off = crm.off + idx + 1 // jump over separator
	}
	return result
}

// Rest return every thing from current offset to the and of slice.
//
// Operation advances the offset.
func (crm *ClientRequstMessage) Rest() []byte {
	if crm.off >= len(crm.raw) {
		return nil
	}

	result := crm.raw[crm.off:]
	crm.off = crm.off + len(crm.raw)
	return result
}

func (c *ClientSession) handleInput(ctx context.Context, p []byte) error {
	crm := &ClientRequstMessage{raw: p}
	scope := crm.Next()
	switch {
	case bytes.Equal(scope, []byte("lobby")):
		return c.handleLobbyMessage(ctx, crm)
	case bytes.Equal(scope, []byte("game")):
		return c.handleGameStartMessage()
	default:
		return c.handleGameInputMessage(p)
	}
}

func (c *ClientSession) handleLobbyMessage(ctx context.Context, crm *ClientRequstMessage) error {
	command := crm.Next()
	switch {
	case bytes.Equal(command, []byte("connect")):
		return c.handleLobbyConectMessage(ctx, crm)
	case bytes.Equal(command, []byte("list")):
		return c.handleGetLobbyList(ctx)
	case bytes.Equal(command, []byte("create")):
		return c.handleLobbyCreate(ctx, crm)
	case bytes.Equal(command, []byte("setMap")):
		return c.handleSetGameMap(crm)
	case bytes.Equal(command, []byte("leave")):
		return c.handleLobbyLeave()
	default:
		return errors.New("invalid lobby command")
	}
}

func (c *ClientSession) handleGetLobbyList(ctx context.Context) error {
	lobbies := c.LobbyManager.Lobbies()
	c.send(ctx, Lobbies(lobbies))
	return nil
}

func (c *ClientSession) handleLobbyCreate(ctx context.Context, crm *ClientRequstMessage) error {
	name := crm.Rest()
	if name == nil {
		return errors.New("name cannot be empty")
	}

	nameStr := string(name)

	lobbyID := c.LobbyManager.Create(nameStr)
	if err := c.joinToLobby(ctx, lobbyID); err != nil {
		slog.Error("failed to enter newly created lobby", "clientID", c.info.Id, "lobbyName", nameStr, "error", err)
		if err = c.LobbyManager.Close(lobbyID, c.info.Id); err != nil {
			slog.Error("failed to close lobby", "clientID", c.info.Id, "lobbyName", nameStr, "error", err)
		}
		return errors.New("failed to enter newly created lobby")
	}

	c.state = state_InLobby

	return nil
}

func (c *ClientSession) handleLobbyConectMessage(ctx context.Context, crm *ClientRequstMessage) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.lobbyHandler != nil {
		return errors.New("client is already connected to a lobby")
	}

	rawLobbyID := crm.Rest()
	if rawLobbyID == nil {
		return errors.New("lobby id cannot be empty")
	}

	lobbyID, err := strconv.Atoi(string(rawLobbyID))
	if err != nil {
		return errors.New("invalid lobby id")
	}

	if err := c.joinToLobby(ctx, lobbyID); err != nil {
		return err
	}

	c.state = state_InLobby

	return nil
}

func (c *ClientSession) handleSetGameMap(crm *ClientRequstMessage) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.lobbyHandler == nil {
		return errors.New("not in lobby")
	}

	mapName := string(crm.Rest())
	return c.lobbyHandler.SetMap(mapName)
}

func (c *ClientSession) handleLobbyLeave() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.lobbyHandler == nil {
		return errors.New("not in lobby")
	}

	c.lobbyHandler.Disconnect()
	c.lobbyHandler = nil

	c.state = state_Logged

	return nil
}

func (c *ClientSession) joinToLobby(ctx context.Context, lobbyID int) error {
	sendFn := c.createSendClientMessageFn(ctx)

	handler, err := c.LobbyManager.Join(lobbyID, c.info, sendFn)
	if err != nil {
		return err
	}

	c.lobbyHandler = handler
	return nil
}

func (c *ClientSession) handleGameStartMessage() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.lobbyHandler == nil {
		return fmt.Errorf("could not start game: not in lobby")
	}
	if err := c.lobbyHandler.RunGame(); err != nil {
		return fmt.Errorf("could not start game: %w", err)
	}
	return nil
}

func (c *ClientSession) handleGameInputMessage(p []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.lobbyHandler == nil {
		return fmt.Errorf("could not process game input: not in lobby")
	}
	c.lobbyHandler.HandleInput(p)
	return nil
}

// send sends message for client and handles events in message communication.
//
// The context should be of lifetime as main client session method.
func (c *ClientSession) send(ctx context.Context, cm ClientMessage) {
	select {
	case <-ctx.Done():
		return
	default:
	}

	select {
	case c.update <- cm:
		return
	default:
	}

	select {
	case c.updateBufferFull <- struct{}{}:
	default:
	}
}

// createSendClientMessageFn creates simplified version of sendClientMessage which
// is meant for other systems for communication with client.
//
// The context should be of lifetime as main client session method.
func (c *ClientSession) createSendClientMessageFn(ctx context.Context) SendClientMessage {
	return func(cm ClientMessage) { c.send(ctx, cm) }
}

func parseNameMessage(payload []byte) (string, error) {
	if !bytes.HasPrefix(payload, []byte("name:")) {
		return "", fmt.Errorf("expected message with client's name")
	}

	name := strings.TrimSpace(string(payload[len("name:"):]))
	if name == "" {
		return "", fmt.Errorf("name cannot be empty")
	}
	if !utf8.ValidString(name) {
		return "", fmt.Errorf("name must be valid UTF-8")
	}
	if utf8.RuneCountInString(name) > maxNameLength {
		return "", fmt.Errorf("name cannot exceed %d characters", maxNameLength)
	}

	return name, nil
}

func closeWithPolicyViolation(conn *websocket.Conn, reason string) {
	_ = conn.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.ClosePolicyViolation, reason),
		time.Now().Add(writeTimeout),
	)
}

func serializeMessage(clientMsg ClientMessage) ([]byte, error) {
	type Message struct {
		Type    string `json:"type"`
		Details any    `json:"details"`
	}

	var msg Message

	switch m := clientMsg.(type) {
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

	case NameMessage:
		msg = Message{
			Type:    "ok",
			Details: m.value,
		}

	case ErrorMessage:
		msg = Message{
			Type:    "error",
			Details: m.value,
		}

	case LobbyClosed:
		msg = Message{
			Type: "lobbyClosed",
		}

	case Lobbies:
		msg = Message{
			Type:    "lobbyList",
			Details: m,
		}

	case ClientGameState:
		msg = Message{
			Type:    "snapshot",
			Details: m,
		}

	case GameStartedMessage:
		msg = Message{
			Type: "gameStarted",
		}

	case SessionInfoMessage:
		msg = Message{
			Type:    "sessionInfo",
			Details: m,
		}

	default:
		return nil, fmt.Errorf("unsupported client message %T", clientMsg)
	}

	return json.Marshal(msg)
}
