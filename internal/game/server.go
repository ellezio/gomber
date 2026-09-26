package game

import (
	"github.com/gorilla/websocket"
)

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
