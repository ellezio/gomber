import { boardUpdateMessage, Game } from "./game";
import { Lobby, lobbyState } from "./lobby";
import { LobbyItem, LobbyList } from "./lobbyList";

type ServerMessage =
  | boardUpdateMessage
  | { type: "lobbyState"; details: lobbyState }
  | { type: "lobbyList"; details: LobbyItem[] }
  | { type: "gameResult"; details: { winnerId: number } }
  | { type: "ok"; details: "name" };

class Client {
  conn: WebSocket;
  game: Game;
  lobby: Lobby;
  lobbies: LobbyList;
  askNameResolve: (v: unknown) => void;

  connect() {
    this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    this.conn.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(evt: MessageEvent<any>) {
    const data: ServerMessage = JSON.parse(evt.data);

    if ("type" in data) {
      switch (data.type) {
        case "lobbyState":
          this.lobby?.handleMessage(data.details, !this.game);
          if (this.game != null) {
            this.game.clients = data.details.clients;
          }
          break;
        case "lobbyList":
          this.lobbies?.handleMessage(data.details);
          break;
        case "gameResult":
          const client = this.lobby.state.clients.find(
            (c) => c.id == data.details.winnerId,
          );
          this.game.renderResult(client?.name);
          setTimeout(() => {
            this.game = null;
            this.lobby.render();
          }, 2000);
          break;
        case "ok":
          this.askNameResolve?.(null);
          break;
      }
    } else if ("board" in data) {
      if (this.game == null) {
        this.game = new Game();
        this.game.conn = this.conn;
        this.game.clients = this.lobby.state.clients;
        this.game.start();
      }
      this.game.handleMessage(data);
    }
  }

  connectToLobby(lobbyID: number) {
    this.lobby = new Lobby(document.body);
    this.lobby.ongamestart = () => {
      this.conn.send("game:start");
      this.game = new Game();
      this.game.conn = this.conn;
      this.game.clients = this.lobby.state.clients;
      this.game.start();
    };
    this.conn.send(`lobby:connect:${lobbyID}`);
  }

  requstLobbies() {
    if (this.lobbies == undefined) {
      this.lobbies = new LobbyList(document.body);
      this.lobbies.onJoin = this.connectToLobby.bind(this);
    }
    this.conn.send("lobby:list");
  }

  async askName() {
    return new Promise((res) => {
      const ask = document.createElement("div");
      const inp = document.createElement("input");
      const btn = document.createElement("button");
      btn.innerText = "Send";
      btn.onclick = () => {
        const v = inp.value;
        this.askNameResolve = res;
        this.conn.send(`name:${v}`);
      };
      ask.appendChild(inp);
      ask.appendChild(btn);
      document.body.replaceChildren(ask);
    });
  }
}

window.onload = async function () {
  // const game = new Game();
  // game.start();

  const client = new Client();
  client.connect();
  await client.askName();
  client.requstLobbies();
  // client.connectToLobby();
};
