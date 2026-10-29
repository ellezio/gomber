package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/synctest"
	"uuid"

	"github.com/gorilla/websocket"
)

func dialTestClient(t *testing.T, server *Server) *websocket.Conn {
	t.Helper()
	upgrader := websocket.Upgrader{}
	testServer := httptest.NewTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		server.ServeClienth(conn)
	}))
	t.Cleanup(testServer.Close)

	transport, _ := testServer.Client().Transport.(*http.Transport)
	dialer := websocket.Dialer{NetDialContext: transport.DialContext}
	conn, _, err := dialer.Dial("ws://example.com", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })

	return conn
}

func readServerMessage(t *testing.T, conn *websocket.Conn) (string, json.RawMessage) {
	t.Helper()
	var msg struct {
		Type    string          `json:"type"`
		Details json.RawMessage `json:"details"`
	}
	if err := conn.ReadJSON(&msg); err != nil {
		t.Fatal(err)
	}
	return msg.Type, msg.Details
}

func TestWebSocketNameHandshakeAndLobbyJoin(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		server := NewServer()
		conn := dialTestClient(t, server)

		msgType, details := readServerMessage(t, conn)
		if msgType != "sessionInfo" {
			t.Fatalf("invalid first message type from server. got=%q want=%q", msgType, "sessioinInfo")
		}

		if err := conn.WriteMessage(websocket.TextMessage, []byte("name:Jev")); err != nil {
			t.Fatal(err)
		}

		lobbyID := server.lobbies.Create("test")
		lobby := server.lobbies.lobbies[lobbyID].lobby

		msgType, details = readServerMessage(t, conn)
		if msgType != "ok" || string(details) != `"name"` {
			t.Fatalf("name response = %s %s", msgType, details)
		}
		if err := conn.WriteMessage(websocket.TextMessage, fmt.Appendf(nil, "lobby:connect:%d", lobbyID)); err != nil {
			t.Fatal(err)
		}
		msgType, details = readServerMessage(t, conn)
		var state LobbyState
		if err := json.Unmarshal(details, &state); err != nil {
			t.Fatalf("failed to unmarshal LobbyState. raw=%q, err=%v", details, err)
		}
		if msgType != "lobbyState" || state.Name != "test" || len(state.Clients) != 1 || state.Clients[0].Name != "Jev" || state.Clients[0].Id != 1 {
			t.Fatalf("lobby response = %s %+v", msgType, state)
		}

		if err := conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "")); err != nil {
			t.Fatal(err)
		}

		synctest.Wait()

		select {
		case <-lobby.done:
		default:
			t.Fatal("lobby did not close after client disconnected")
		}

		server.clients.mu.Lock()
		remaining := len(server.clients.clients)
		server.clients.mu.Unlock()
		if remaining != 0 {
			t.Fatal("client manager did not remove the disconnected session")
		}
	})
}

func TestWebSocketLimitsMessageSize(t *testing.T) {
	conn := dialTestClient(t, NewServer())

	// first messsage is client session info
	readServerMessage(t, conn)

	if err := conn.WriteMessage(websocket.TextMessage, []byte("name:"+strings.Repeat("a", maxMessageSize))); err != nil {
		t.Fatal(err)
	}
	_, _, err := conn.ReadMessage()
	var closeErr *websocket.CloseError
	if !errors.As(err, &closeErr) || closeErr.Code != websocket.CloseMessageTooBig {
		t.Fatalf("read error = %v, want message-too-big close", err)
	}
}

func TestGetLobbies(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		server := NewServer()
		conn := dialTestClient(t, server)

		// first messsage is client session info
		readServerMessage(t, conn)

		names := []string{"one", "two", "three"}
		ids := make([]int, len(names))
		for idx, name := range names {
			ids[idx] = server.lobbies.Create(name)
		}
		t.Cleanup(func() {
			for _, id := range ids {
				_ = server.lobbies.Close(id, 0)
			}
		})

		if err := conn.WriteMessage(websocket.TextMessage, []byte("name:Jev")); err != nil {
			t.Fatal(err)
		}
		readServerMessage(t, conn)

		if err := conn.WriteMessage(websocket.TextMessage, []byte("lobby:list")); err != nil {
			t.Fatal(err)
		}
		msgType, msgDetails := readServerMessage(t, conn)

		if err := conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "")); err != nil {
			t.Fatal(err)
		}

		if msgType != "lobbyList" {
			t.Fatalf("wrong server message. got=%q, want=%q", msgType, "lobbyList")
		}

		var lobbies Lobbies
		if err := json.Unmarshal(msgDetails, &lobbies); err != nil {
			t.Fatal(err)
		}

		if len(lobbies) != len(names) {
			t.Fatalf("wrong number of lobbies returned. got=%d, want=%d", len(lobbies), len(names))
		}

		for idx, lobby := range lobbies {
			if lobby.ID != ids[idx] {
				t.Errorf("(idx:%d) wrong lobby id. got=%d, want=%d", idx, lobby.ID, ids[idx])
			}
			if lobby.Name != names[idx] {
				t.Errorf("(idx:%d) wrong lobby name. got=%s, want=%s", idx, lobby.Name, names[idx])
			}
		}
	})
}

func TestClientStateFlow(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		server := NewServer()
		conn := dialTestClient(t, server)

		// first messsage is client session info
		msgType, rawJson := readServerMessage(t, conn)
		if msgType != "sessionInfo" {
			t.Fatalf("expected session info got=%q", msgType)
		}

		var sessionMsg SessionInfoMessage
		if err := json.Unmarshal(rawJson, &sessionMsg); err != nil {
			t.Fatal(err)
		}

		client, ok := server.clients.clients[uuid.MustParse(sessionMsg.SessionID)]
		if !ok {
			t.Fatal("expected to get client")
		}

		if client.session.state != state_Created {
			t.Fatalf("expected client state to be %d got %d", state_Created, client.session.state)
		}

		conn.WriteMessage(websocket.TextMessage, []byte("name:Jev"))
		readServerMessage(t, conn)

		synctest.Wait()

		if client.session.state != state_Logged {
			t.Fatalf("expected client state to be %d got %d", state_Created, client.session.state)
		}
	})
}
