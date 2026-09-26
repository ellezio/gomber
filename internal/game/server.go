package game

import (
	"github.com/gorilla/websocket"
)

func (cm *ClientManager) ServeClient(conn *websocket.Conn, lobbies *LobbyManager) {
	clientID := int(cm.nextID.Add(1))
	client := NewClient(clientID, lobbies)

	cm.mu.Lock()
	cm.clients[clientID] = client
	cm.mu.Unlock()

	client.Serve(conn)

	cm.mu.Lock()
	delete(cm.clients, clientID)
	cm.mu.Unlock()
}

type Server struct {
	lobbies *LobbyManager
	clients *ClientManager
}

func NewServer() *Server {
	lobbies := NewLobbyManager()
	clients := NewClientManager()

	return &Server{
		lobbies: lobbies,
		clients: clients,
	}
}

func (s *Server) ServeClient(conn *websocket.Conn) {
	s.clients.ServeClient(conn, s.lobbies)
}
