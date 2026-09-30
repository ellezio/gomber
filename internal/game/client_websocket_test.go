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
		server.ServeClient(conn)
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
		if err := conn.WriteMessage(websocket.TextMessage, []byte("name:Jev")); err != nil {
			t.Fatal(err)
		}

		lobbyID := server.lobbies.Create("test")
		lobby := server.lobbies.lobbies[lobbyID].lobby

		msgType, details := readServerMessage(t, conn)
		if msgType != "ok" || string(details) != `"name"` {
			t.Fatalf("name response = %s %s", msgType, details)
		}
		if err := conn.WriteMessage(websocket.TextMessage, fmt.Appendf(nil, "lobby:connect:%d", lobbyID)); err != nil {
			t.Fatal(err)
		}
		msgType, details = readServerMessage(t, conn)
		var state LobbyState
		if err := json.Unmarshal(details, &state); err != nil {
			t.Fatal(err)
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

func TestWebSocketRejectsInvalidMessages(t *testing.T) {
	tests := []struct {
		name           string
		payload        string
		kind           int
		validNameFirst bool
	}{
		{name: "invalid name", payload: "name: ", kind: websocket.TextMessage},
		{name: "binary name", payload: "name:Jev", kind: websocket.BinaryMessage},
		{name: "binary input", payload: "game:start", kind: websocket.BinaryMessage, validNameFirst: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := dialTestClient(t, NewServer())

			if tt.validNameFirst {
				if err := conn.WriteMessage(websocket.TextMessage, []byte("name:Jev")); err != nil {
					t.Fatal(err)
				}
				readServerMessage(t, conn)
			}
			if err := conn.WriteMessage(tt.kind, []byte(tt.payload)); err != nil {
				t.Fatal(err)
			}
			_, _, err := conn.ReadMessage()
			var closeErr *websocket.CloseError
			if !errors.As(err, &closeErr) || closeErr.Code != websocket.ClosePolicyViolation {
				t.Fatalf("read error = %v, want policy violation close", err)
			}
		})
	}
}

func TestWebSocketLimitsMessageSize(t *testing.T) {
	conn := dialTestClient(t, NewServer())

	if err := conn.WriteMessage(websocket.TextMessage, []byte("name:"+strings.Repeat("a", maxMessageSize))); err != nil {
		t.Fatal(err)
	}
	_, _, err := conn.ReadMessage()
	var closeErr *websocket.CloseError
	if !errors.As(err, &closeErr) || closeErr.Code != websocket.CloseMessageTooBig {
		t.Fatalf("read error = %v, want message-too-big close", err)
	}
}
