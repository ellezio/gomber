import { boardUpdateMessage, Game } from "./game";
import { Action } from "./input";
import { Lobby, lobbyState } from "./lobby";
import { LobbyItem, LobbyList } from "./lobbyList";

const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const allViews = document.querySelectorAll(".view");

const snackbarElement = document.getElementById("snackbar-block");

type ServerMessage =
  | { type: "ok"; details: "name" }
  | { type: "lobbyList"; details: LobbyItem[] }
  | { type: "lobbyState"; details: lobbyState }
  | { type: "gameStarted"; details: never }
  | { type: "snapshot"; details: boardUpdateMessage }
  | { type: "gameResult"; details: { winnerId: number } }
  | { type: "error"; details: string };

type networkInput = {
  id: number;
  actions: Action[];
  dt: number;
};

enum ClientState {
  InLoginPage,
  InLobbyList,
  JoiningLobby,
  InLobby,
  InGame,
}

class Client {
  conn: WebSocket;
  game: Game;
  lobby: Lobby;
  lobbies: LobbyList;
  lobbyListInterval: number;
  state: ClientState;

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
      case "gameStarted":
        this.handleGameStarted();
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
    if (this.lobby) {
      this.lobby.update(state);

      if (this.state == ClientState.JoiningLobby) {
        this.showLobby();
      } else if (this.state == ClientState.InLobby) {
        this.lobby.render();
      }
    }

    if (this.game) {
      this.game.clients = state.clients;
    }
  }

  handleLobbyList(lobbies: LobbyItem[]) {
    if (this.lobbies) {
      this.lobbies.update(lobbies);
      if (this.state == ClientState.InLobbyList) this.lobbies.render();
    }
  }

  handleGameStarted() {
    if (this.state == ClientState.InLobby) {
      this.showGame();
      if (!this.game) {
        this.startGame(false);
      }
    }
  }

  handleGameResult(winnerID: number) {
    if (this.state == ClientState.InGame) {
      const client = this.lobby.state.clients.find((c) => c.id == winnerID);
      this.game.renderResult(client?.name);
      setTimeout(() => {
        if (this.state == ClientState.InGame) {
          this.game = null;
          this.showLobby();
        }
      }, 2000);
    }
  }

  handleNameAck() {
    if (this.state == ClientState.InLoginPage) {
      this.showLobbies();
    }
  }

  handleGameSnapshot(snapshot: boardUpdateMessage) {
    if (this.game && this.state == ClientState.InGame) {
      this.game.handleMessage(snapshot);
    }
  }

  handleErrorMessage(message: string) {
    const msg = document.createElement("div");
    msg.classList.add("error-message");
    msg.innerText = message;

    setTimeout(() => {
      msg.remove();
    }, 8000);

    snackbarElement.appendChild(msg);

    // TODO:
    // This has erroneous logic because when receiving error
    // which is not connected to joining lobby it will change
    // state and view so lobby will be not shown.
    // To solve this I have to add some request ID to know
    // which one rised error.
    if (this.state == ClientState.JoiningLobby) {
      this.showLobbies();
    }
  }

  createLobby(): Lobby {
    const lobby = new Lobby(mainView);
    lobby.onGameStart = () => this.startGame(true);
    lobby.onMapSelect = this.sendSetMap.bind(this);
    lobby.onLeave = this.leaveLobby.bind(this);
    return lobby;
  }

  createGame(): Game {
    const game = new Game();
    game.clients = this.lobby.state.clients;
    game.htmlElement = mainView;
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
    this.state = ClientState.JoiningLobby;
  }

  requstLobbies() {
    if (this.lobbies == undefined) {
      this.lobbies = new LobbyList(mainView);
      this.lobbies.onJoin = this.connectToLobby.bind(this);
      this.lobbies.onCreate = (name: string) => {
        this.stopLobbyListInterval();
        this.lobby = this.createLobby();
        this.sendLobbyCreate(name);
        this.state = ClientState.JoiningLobby;
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
    this.showLobbies();
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

  showLoginPage() {
    this.state = ClientState.InLoginPage;
    this.showView(loginView);

    const btn = loginView.querySelector("button");
    const inp = loginView.querySelector("input");
    btn.onclick = () => this.sendClientName(inp.value);
  }

  showLobbies() {
    this.state = ClientState.InLobbyList;
    this.showView(mainView);
    this.requstLobbies();
  }

  showLobby() {
    this.state = ClientState.InLobby;
    this.showView(mainView);
    this.lobby.render();
  }

  showGame() {
    this.state = ClientState.InGame;
    this.showView(mainView);
  }

  showView(elm: HTMLElement) {
    allViews.forEach((elm) => elm.setAttribute("hidden", "true"));
    elm.hidden = false;
  }
}

window.onload = async function () {
  const client = new Client();
  client.connect();
  client.showLoginPage();
};
