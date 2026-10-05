import { boardUpdateMessage, Game } from "./game";
import { Action } from "./input";
import { Lobby, lobbyState } from "./lobby";
import { LobbyItem, LobbyList } from "./lobbyList";

type ServerMessage =
  | { type: "snapshot"; details: boardUpdateMessage }
  | { type: "lobbyState"; details: lobbyState }
  | { type: "lobbyList"; details: LobbyItem[] }
  | { type: "gameResult"; details: { winnerId: number } }
  | { type: "ok"; details: "name" };

type networkInput = {
  id: number;
  actions: Action[];
  dt: number;
};

class Client {
  conn: WebSocket;
  game: Game;
  lobby: Lobby;
  lobbies: LobbyList;
  askNameResolve: (v: unknown) => void;
  lobbyListInterval: number;

  connect() {
    this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    this.conn.onmessage = this.handleMessage.bind(this);
  }

  sendGameStart() {
    this.conn.send("game:start");
  }

  sendLobbyCreate(name: string) {
    this.conn.send(`lobby:create:${name}`);
  }

  sendLobbyConnect(id: number) {
    this.conn.send(`lobby:connect:${id}`);
  }

  sendLobbyList() {
    this.conn.send("lobby:list");
  }

  sendClientName(name: string) {
    this.conn.send(`name:${name}`);
  }

  sendClientInput(netInput: networkInput) {
    this.conn.send(JSON.stringify(netInput));
  }

  handleMessage(evt: MessageEvent<any>) {
    const msg: ServerMessage = JSON.parse(evt.data);

    switch (msg.type) {
      case "lobbyState":
        this.handleLobbyState(msg.details);
        break;
      case "lobbyList":
        this.handleLobbyList(msg.details);
        break;
      case "gameResult":
        this.handleGameResult(msg.details.winnerId);
        break;
      case "ok":
        this.handleNameAck();
        break;
      case "snapshot":
        this.handleGameSnapshot(msg.details);
    }
  }

  handleLobbyState(state: lobbyState) {
    this.lobby?.handleMessage(state, !this.game);
    if (this.game != null) {
      this.game.clients = state.clients;
    }
  }

  handleLobbyList(lobbies: LobbyItem[]) {
    this.lobbies?.handleMessage(lobbies);
  }

  handleGameResult(winnerID: number) {
    const client = this.lobby.state.clients.find((c) => c.id == winnerID);
    this.game.renderResult(client?.name);
    setTimeout(() => {
      this.game = null;
      this.lobby.render();
    }, 2000);
  }

  handleNameAck() {
    this.askNameResolve?.(null);
  }

  handleGameSnapshot(snapshot: boardUpdateMessage) {
    if (this.game == null) {
      this.startGame();
    }
    this.game.handleMessage(snapshot);
  }

  createLobby(): Lobby {
    const lobby = new Lobby(document.body);
    lobby.ongamestart = this.startGame.bind(this);
    return lobby;
  }

  createGame(): Game {
    const game = new Game();
    game.clients = this.lobby.state.clients;
    game.onInput = (inp) => {
      this.sendClientInput({
        id: inp.seq,
        actions: inp.input.actions,
        dt: inp.input.dt,
      });
    };
    return game;
  }

  connectToLobby(lobbyID: number) {
    this.stopLobbyListInterval();
    this.lobby = this.createLobby();
    this.sendLobbyConnect(lobbyID);
  }

  requstLobbies() {
    if (this.lobbies == undefined) {
      this.lobbies = new LobbyList(document.body);
      this.lobbies.onJoin = this.connectToLobby.bind(this);
      this.lobbies.onCreate = (name: string) => {
        this.stopLobbyListInterval();
        this.lobby = this.createLobby();
        this.sendLobbyCreate(name);
      };
    }
    this.startLobbyListInterval();
  }

  startGame() {
    this.game = this.createGame();
    this.sendGameStart();
    this.game.start();
  }

  startLobbyListInterval() {
    this.stopLobbyListInterval();
    this.sendLobbyList();
    this.lobbyListInterval = window.setInterval(
      this.sendLobbyList.bind(this),
      10000,
    );
  }

  stopLobbyListInterval() {
    window.clearInterval(this.lobbyListInterval);
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
        this.sendClientName(v);
      };
      ask.appendChild(inp);
      ask.appendChild(btn);
      document.body.replaceChildren(ask);
    });
  }
}

window.onload = async function () {
  const client = new Client();
  client.connect();
  await client.askName();
  client.requstLobbies();
};
