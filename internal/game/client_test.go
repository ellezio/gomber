package game

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"testing/synctest"
	"time"
)

func TestParseNameMessage(t *testing.T) {
	tests := []struct {
		name      string
		payload   []byte
		want      string
		wantError bool
	}{
		{
			name:    "valid name",
			payload: []byte("name: Player One "),
			want:    "Player One",
		},
		{
			name:    "maximum length counts characters",
			payload: []byte("name:" + strings.Repeat("ą", maxNameLength)),
			want:    strings.Repeat("ą", maxNameLength),
		},
		{
			name:      "missing prefix",
			payload:   []byte("Player One"),
			wantError: true,
		},
		{
			name:      "empty name",
			payload:   []byte("name:   "),
			wantError: true,
		},
		{
			name:      "invalid UTF-8",
			payload:   []byte{'n', 'a', 'm', 'e', ':', 0xff},
			wantError: true,
		},
		{
			name:      "name too long",
			payload:   []byte("name:" + strings.Repeat("a", maxNameLength+1)),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseNameMessage(tt.payload)
			if tt.wantError {
				if err == nil {
					t.Fatal("parseNameMessage() expected an error")
				}
				return
			}

			if err != nil {
				t.Fatalf("parseNameMessage() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("parseNameMessage() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestClientHandleInputErrors(t *testing.T) {
	lm := NewLobbyManager()
	client := NewClient(7, lm)
	client.info.Name = "Jojo"

	tests := []struct {
		name    string
		payload string
	}{
		{"start before joining", "game:start"},
		{"input before joining", `{"id":1,"actions":["up"]}`},
		{"missing separator", "lobby:connect0"},
		{"wrong separator", "lobby:connectX0"},
		{"missing ID", "lobby:connect:"},
		{"nondecimal ID", "lobby:connect:nope"},
		{"unknown ID", "lobby:connect:99"},
		{"negative ID", "lobby:connect:-1"},
	}

	ctx := context.Background()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.handleInput(ctx, []byte(tt.payload))
			if err == nil {
				t.Fatalf("handleInput(%q): expected error.", tt.payload)
			}
			if client.lobbyHandler != nil {
				t.Fatal("client should not join a lobby")
			}
		})
	}
}

func TestClientSendBufferFullAndCancellation(t *testing.T) {
	client := NewClient(1, nil)
	ctx, cancel := context.WithCancel(context.Background())
	for range updateQueueSize {
		client.send(ctx, NameMessage{value: "Mr Big"})
	}
	// the client is not served so it doesn't consume messages
	// so it should be full if there is no bug
	if got := len(client.update); got != updateQueueSize {
		t.Fatalf("queued %d updates, want %d", got, updateQueueSize)
	}
	client.send(ctx, ErrorMessage{value: "overflow"})
	select {
	case <-client.updateBufferFull:
	default:
		t.Fatal("full update queue did not signal overflow")
	}
	cancel()
	client.send(ctx, ErrorMessage{value: "after cancellation"})
	if got := len(client.update); got != updateQueueSize {
		t.Fatalf("queued %d updates after cancellation", got)
	}
}

func TestClientPingLatency(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := NewClient(1, nil)
		id := client.registerPing()
		time.Sleep(100 * time.Millisecond)
		if err := client.measurePingLatency(id); err != nil {
			t.Fatalf("measure registered ping: %v", err)
		}
		if len(client.latencyTracker) != 0 || client.info.Latency != 100 {
			t.Fatalf("ping tracker = %v, latency = %d", client.latencyTracker, client.info.Latency)
		}
		if err := client.measurePingLatency(id); err == nil {
			t.Fatal("measuring a consumed ping should fail")
		}
		client.registerPing()
		if err := client.measurePingLatency("invalid"); err == nil || len(client.latencyTracker) != 0 {
			t.Fatalf("invalid pong: error = %v, tracker = %v", err, client.latencyTracker)
		}
	})
}

type theWorld struct{}

func (theWorld) iClientMessage() {}

func TestSerializeClientMessage(t *testing.T) {
	tests := []struct {
		name string
		msg  ClientMessage
		want string
	}{
		{
			"name approved",
			NameMessage{value: "name"},
			`{"type":"ok","details":"name"}`,
		},
		{
			"error",
			ErrorMessage{value: "invalid"},
			`{"type":"error","details":"invalid"}`,
		},
		{
			"lobby",
			LobbyState{Name: "test", Clients: []ClientInfo{{Id: 3, Name: "Ada", Latency: 12}}},
			`{"type":"lobbyState","details":{"name":"test","clients":[{"id":3,"name":"Ada","latency":12}]}}`,
		},
		{
			"result",
			GameResult{WinnerId: 3},
			`{"type":"gameResult","details":{"winnerId":3}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := serializeMessage(tt.msg)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != tt.want {
				t.Fatalf("serialized = %s, want %s", got, tt.want)
			}
		})
	}

	if _, err := serializeMessage(theWorld{}); err == nil {
		t.Fatal("unsupported message should return an error")
	}
}

func TestClientRequstMessageNext(t *testing.T) {
	tests := []struct {
		input    []byte
		expected [][]byte
	}{
		{
			input:    []byte("lobby:connect"),
			expected: [][]byte{[]byte("lobby"), []byte("connect")},
		},
		{
			input:    []byte("lobby:connect"),
			expected: [][]byte{[]byte("lobby"), []byte("connect"), nil},
		},
		{
			input:    []byte("lobby:connect:1"),
			expected: [][]byte{[]byte("lobby"), []byte("connect"), []byte("1")},
		},
	}

	for _, tt := range tests {
		crm := &ClientRequstMessage{raw: tt.input}
		for _, expected := range tt.expected {
			got := crm.Next()
			if !bytes.Equal(got, expected) {
				t.Errorf("wrong message part. got=%s want=%s", got, expected)
				break
			}
		}
	}
}

func TestClientRequstMessageRest(t *testing.T) {
	tests := []struct {
		input    []byte
		expected []byte
		withNext bool
	}{
		{
			input:    []byte("lobby:connect"),
			expected: []byte("lobby:connect"),
			withNext: false,
		},
		{
			input:    []byte("lobby:connect"),
			expected: []byte("connect"),
			withNext: true,
		},
		{
			input:    []byte("lobby:connect:1"),
			expected: []byte("connect:1"),
			withNext: true,
		},
		{
			input:    []byte("lobby:connect:1:1:1:1"),
			expected: []byte("connect:1:1:1:1"),
			withNext: true,
		},
	}

	for _, tt := range tests {
		crm := &ClientRequstMessage{raw: tt.input}
		if tt.withNext {
			crm.Next()
		}
		got := crm.Rest()
		if !bytes.Equal(got, tt.expected) {
			t.Errorf("wrong message part. got=%s want=%s", got, tt.expected)
			break
		}
	}
}
