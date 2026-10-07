package game

import (
	"fmt"

	"github.com/gorilla/websocket"
)

type Server struct {
	lobbies  *LobbyManager
	clients  *ClientManager
	gameMaps *GameMapManager
}

func NewServer() *Server {
	gameMaps := NewGameMapManager()
	lobbies := NewLobbyManager(gameMaps)
	clients := NewClientManager()

	return &Server{
		lobbies:  lobbies,
		clients:  clients,
		gameMaps: gameMaps,
	}
}

func (s *Server) LoadMaps() error {
	err := s.gameMaps.LoadMaps()
	if err != nil {
		return fmt.Errorf("failed to load maps: %w", err)
	}
	return nil
}

func (s *Server) ServeClient(conn *websocket.Conn) {
	s.clients.ServeClient(conn, s.lobbies)
}
