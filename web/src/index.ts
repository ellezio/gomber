import { boardUpdateMessage, Game } from "./game";
import { Lobby, lobbyState } from "./lobby";

type ServerMessage =
  | boardUpdateMessage
  | {
      type: "lobbyState";
      details: lobbyState;
    }
  | {
      type: "ok";
      details: "name";
    };

class Client {
  conn: WebSocket;
  game: Game;
  lobby: Lobby;
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
          this.lobby?.handleMessage(data.details);
          break;
        case "ok":
          this.askNameResolve?.(null);
          break;
      }
    } else if ("board" in data) {
      if (this.game == null) {
        this.game = new Game();
        this.game.conn = this.conn;
        this.game.start();
      }
      this.game.handleMessage(data);
    }
  }

  connectToLobby() {
    this.lobby = new Lobby(document.body);
    this.lobby.ongamestart = () => {
      this.conn.send("game:start");
      this.game = new Game();
      this.game.conn = this.conn;
      this.game.start();
    };
    this.conn.send("lobby:connect");
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
  client.connectToLobby();
};
