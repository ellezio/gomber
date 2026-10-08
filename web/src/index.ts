import { boardUpdateMessage, Game } from "./game";
import { Action } from "./input";
import { Lobby, lobbyState } from "./lobby";
import { LobbyItem, LobbyList } from "./lobbyList";

const mainElement = document.getElementById("main");
const snackbarElement = document.getElementById("snackbar-block");

type ServerMessage =
  | { type: "snapshot"; details: boardUpdateMessage }
  | { type: "lobbyState"; details: lobbyState }
  | { type: "lobbyList"; details: LobbyItem[] }
  | { type: "gameResult"; details: { winnerId: number } }
  | { type: "ok"; details: "name" }
  | { type: "error"; details: string };

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

  sendSetMap(name: string) {
    this.conn.send(`lobby:setMap:${name}`);
  }

  sendLobbyLeave() {
    this.conn.send("lobby:leave");
  }

  handleMessage(evt: MessageEvent<any>) {
    const msg: ServerMessage = JSON.parse(evt.data);

    switch (msg.type) {
      case "lobbyState":
        this.stopLobbyListInterval();
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
        break;
      case "error":
        this.handleErrorMessage(msg.details);
        break;
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
      this.startGame(false);
    }
    this.game.handleMessage(snapshot);
  }

  handleErrorMessage(message: string) {
    const msg = document.createElement("div");
    msg.classList.add("error-message");
    msg.innerText = message;

    setTimeout(() => {
      msg.remove();
    }, 8000);

    snackbarElement.appendChild(msg);
  }

  createLobby(): Lobby {
    const lobby = new Lobby(mainElement);
    lobby.onGameStart = () => this.startGame(true);
    lobby.onMapSelect = this.sendSetMap.bind(this);
    lobby.onLeave = this.leaveLobby.bind(this);
    return lobby;
  }

  createGame(): Game {
    const game = new Game();
    game.clients = this.lobby.state.clients;
    game.htmlElement = mainElement;
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
    this.lobby = this.createLobby();
    this.sendLobbyConnect(lobbyID);
  }

  requstLobbies() {
    if (this.lobbies == undefined) {
      this.lobbies = new LobbyList(mainElement);
      this.lobbies.onJoin = this.connectToLobby.bind(this);
      this.lobbies.onCreate = (name: string) => {
        this.stopLobbyListInterval();
        this.lobby = this.createLobby();
        this.sendLobbyCreate(name);
      };
    }
    this.startLobbyListInterval();
  }

  startGame(sendMessage: boolean) {
    this.game = this.createGame();
    if (sendMessage) this.sendGameStart();
    this.game.start();
  }

  leaveLobby() {
    this.sendLobbyLeave();
    this.requstLobbies();
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
    if (this.lobbyListInterval === undefined) return;
    window.clearInterval(this.lobbyListInterval);
    this.lobbyListInterval = undefined;
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
      mainElement.replaceChildren(ask);
    });
  }
}

window.onload = async function () {
  const client = new Client();
  client.connect();
  await client.askName();
  client.requstLobbies();
};
