package game

import (
	"strings"
	"testing"
	"testing/synctest"
)

// only run this within synctest.Test
func receiveLobbyState(t *testing.T, updates <-chan ClientMessage) LobbyState {
	t.Helper()
	synctest.Wait()
	select {
	case msg := <-updates:
		state, ok := msg.(LobbyState)
		if !ok {
			t.Fatalf("received %T, want LobbyState", msg)
		}
		return state
	default:
		t.Fatal("no lobby state update")
		return LobbyState{}
	}
}

func TestLobbyLifetime(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		gmaps := NewGameMapManager()
		lm := NewLobbyManager(gmaps)
		lobbyID := lm.Create("hybydyż")
		firstUpdates := make(chan ClientMessage, 8)
		secondUpdates := make(chan ClientMessage, 8)

		if _, err := lm.Join(lobbyID+1, ClientInfo{Id: 1}, func(ClientMessage) {}); err == nil {
			t.Fatal("joining a nonexistent lobby should fail")
		}
		firstHandler, err := lm.Join(lobbyID, ClientInfo{Id: 1, Name: "Stone"}, func(msg ClientMessage) { firstUpdates <- msg })
		if err != nil {
			t.Fatal(err)
		}
		firstConnected := true
		t.Cleanup(func() {
			if firstConnected {
				firstHandler.Disconnect()
			}
		})

		state := receiveLobbyState(t, firstUpdates)
		if state.Name != "hybydyż" || len(state.Clients) != 1 || state.Clients[0].Name != "Stone" {
			t.Fatalf("first join state = %+v", state)
		}

		secondHandler, err := lm.Join(lobbyID, ClientInfo{Id: 2, Name: "Bob"}, func(msg ClientMessage) { secondUpdates <- msg })
		if err != nil {
			t.Fatal(err)
		}
		secondConnected := true
		t.Cleanup(func() {
			if secondConnected {
				secondHandler.Disconnect()
			}
		})

		state = receiveLobbyState(t, firstUpdates)
		if len(state.Clients) != 2 {
			t.Fatalf("first client received state = %+v", state)
		}
		state = receiveLobbyState(t, secondUpdates)
		if len(state.Clients) != 2 {
			t.Fatalf("second client received state = %+v", state)
		}

		secondHandler.UpdateLatency(42)
		for _, updates := range []<-chan ClientMessage{firstUpdates, secondUpdates} {
			state = receiveLobbyState(t, updates)
			clients := make(map[string]ClientInfo)
			for _, info := range state.Clients {
				clients[info.Name] = info
			}
			if len(clients) != 2 || clients["Bob"].Latency != 42 {
				t.Fatalf("latency broadcast = %+v", state)
			}
		}

		secondHandler.Disconnect()
		secondConnected = false
		state = receiveLobbyState(t, firstUpdates)
		if len(state.Clients) != 1 || state.Clients[0].Id != 1 {
			t.Fatalf("disconnect broadcast = %+v", state)
		}

		firstHandler.Disconnect()
		firstConnected = false

		if _, err := lm.Join(lobbyID, ClientInfo{Id: 3}, func(ClientMessage) {}); err == nil {
			t.Fatal("joining a closed lobby should fail")
		}
	})
}

func TestLobbyAdminTransferAndStartRejections(t *testing.T) {
	gmaps := NewGameMapManager()
	lobby := NewLobby("test", gmaps)
	join := func(id int) {
		t.Helper()
		msg := ConnectClientMessage{info: ClientInfo{Id: id}, sendFn: func(ClientMessage) {}}
		if err := lobby.connectClient(msg); err != nil {
			t.Fatal(err)
		}
	}
	join(1)
	join(2)
	join(3)
	if !lobby.clients[1].Admin || lobby.clients[2].Admin || lobby.clients[3].Admin {
		t.Fatal("first member should be the only admin")
	}
	if err := lobby.runGame(2); err == nil || !strings.Contains(err.Error(), "only admin") {
		t.Fatalf("non-admin start, error = %v", err)
	}
	if err := lobby.runGame(99); err == nil || !strings.Contains(err.Error(), "not in lobby") {
		t.Fatalf("non-member start, error = %v", err)
	}

	lobby.removeClient(1)
	admins := 0
	for _, member := range lobby.clients {
		if member.Admin {
			admins++
		}
	}
	if admins != 1 {
		t.Fatalf("after admin leaves, got %d admins, want 1", admins)
	}

	lobby.state.Store(state_inGame)
	if err := lobby.connectClient(ConnectClientMessage{info: ClientInfo{Id: 4}}); err == nil {
		t.Fatal("joining during a game should fail")
	}
	if err := lobby.runGame(2); err == nil || !strings.Contains(err.Error(), "already running") {
		t.Fatalf("start during game error = %v", err)
	}
	lobby.state.Store(state_closing)
	if err := lobby.connectClient(ConnectClientMessage{info: ClientInfo{Id: 4}}); err == nil {
		t.Fatal("joining a closing lobby should fail")
	}
}

func TestLobbyHandlerInput(t *testing.T) {
	messages := make(chan LobbyMessege, 1)
	handler := &LobbyHandler{clientID: 12, lobbyCh: messages}
	handler.HandleInput([]byte(`{"id":8,"actions":["up"],"dt":0.1}`))
	select {
	case msg := <-messages:
		_, ok := msg.(ClientInpuMessage)
		if !ok {
			t.Fatalf("message not ClientInpuMessage. got=%T", msg)
		}
	default:
		t.Fatal("expected input message")
	}
	handler.HandleInput([]byte(`not JSON`))
	select {
	case msg := <-messages:
		t.Fatalf("invalid input was forwarded: %#v", msg)
	default:
	}
}

func TestLobbyForwardsInputOnlyDuringGame(t *testing.T) {
	gmaps := NewGameMapManager()
	lobby := NewLobby("test", gmaps)
	gameCh := make(chan GameMessage, 1)
	lobby.gameCh = gameCh
	input := ClientInputEvent{Id: 12, Input: Input{Id: 8, Actions: []action{Up}}}
	lobby.handleClientInput(input)
	if len(lobby.gameCh) != 0 {
		t.Fatal("input before game was forwarded")
	}
	lobby.state.Store(state_inGame)
	lobby.handleClientInput(input)
	select {
	case event := <-gameCh:
		_, ok := event.(ClientInputEvent)
		if !ok {
			t.Fatalf("event is not ClientInputEvent. got=%T", event)
		}
	default:
		t.Fatal("input during game was not forwarded")
	}
}

func TestGetLobbyList(t *testing.T) {
	names := []string{"a", "few", "lobbies", "created"}
	ids := make([]int, len(names))

	gmaps := NewGameMapManager()
	lm := NewLobbyManager(gmaps)
	for i, name := range names {
		ids[i] = lm.Create(name)
	}

	lobbies := lm.Lobbies()

	if len(lobbies) != len(names) {
		t.Fatalf("wrong number of lobbies. got=%d, want=%d", len(lobbies), len(names))
	}

	for i, lobby := range lobbies {
		if lobby.Name != names[i] {
			t.Fatalf("wrong lobby. got=%q, want=%q", lobby.Name, names[i])
		}
	}

	for _, id := range ids {
		err := lm.Close(id, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
}
