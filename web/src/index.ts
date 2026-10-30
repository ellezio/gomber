import { gameUpdateMessage, Game } from "./game";
import { Action } from "./input";
import { Lobby, lobbyState, ServerLobbyState } from "./lobby";
import { LobbyItem, LobbyList } from "./lobbyList";

const loginView = document.getElementById("login-view");
const lobbyListView = document.getElementById("lobby-list-view");
const lobbyView = document.getElementById("lobby-view");
const gameView = document.getElementById("game-view");
const allViews = document.querySelectorAll(".view");

const snackbarElement = document.getElementById("snackbar-block");

type ServerMessage =
  | { type: "ok"; details: "name" }
  | { type: "lobbyList"; details: LobbyItem[] }
  | { type: "lobbyState"; details: lobbyState }
  | { type: "gameStarted"; details: never }
  | { type: "snapshot"; details: gameUpdateMessage }
  | { type: "gameResult"; details: { winnerId: number } }
  | { type: "sessionInfo"; details: { sid: string; state: number } }
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

  retryAttempt = 0;
  maxRetries = 23; // equivalent of 1 minute
  baseDelay = 200;
  maxDelay = 3000;

  connect() {
    this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    this.conn.onmessage = this.handleMessage.bind(this);
    this.conn.onopen = () => {
      this.retryAttempt = 0;
      const sid = sessionStorage.getItem("sid");
      this.send(sid ?? "");
    };

    this.conn.onclose = () => {
      this.scheduleReconnect();
    };
  }

  scheduleReconnect() {
    if (this.retryAttempt < this.maxRetries) {
      setTimeout(() => this.connect(), this.nextRetryDelay());
    }
  }

  nextRetryDelay() {
    const delay = Math.min(
      this.baseDelay * Math.pow(this.retryAttempt, 2),
      this.maxDelay,
    );
    this.retryAttempt++;
    return Math.floor(delay);
  }

  send(msg: string) {
    try {
      // There also could be mechansim for resending unaccepted messages
      // but for this simple game I don't care to do it. For now at least.
      if (this.conn.readyState === WebSocket.OPEN) {
        this.conn.send(msg);
      } else {
        console.error("sending on not opened websocket");
      }
    } catch (err) {
      console.error(err);

      // this will initiate reconnection as we want always have websocket connection available
      this.conn.close();
    }
  }

  sendGameStart() {
    this.send("game:start");
  }

  sendLobbyCreate(name: string) {
    this.send(`lobby:create:${name}`);
  }

  sendLobbyConnect(id: number) {
    this.send(`lobby:connect:${id}`);
  }

  sendLobbyList() {
    this.send("lobby:list");
  }

  sendClientName(name: string) {
    this.send(`name:${name}`);
  }

  sendClientInput(netInput: networkInput) {
    this.send(JSON.stringify(netInput));
  }

  sendSetMap(name: string) {
    this.send(`lobby:setMap:${name}`);
  }

  sendLobbyLeave() {
    this.send("lobby:leave");
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
      case "sessionInfo":
        sessionStorage.setItem("sid", msg.details.sid);
        // InLobby
        if (msg.details.state == 2) {
          // The lobbyState message may arriave before session info when reconnecting
          if (this.lobby) {
            if (this.lobby.state.state == ServerLobbyState.inLobby) {
              this.showLobby();
            } else if (this.lobby.state.state == ServerLobbyState.inGame) {
              this.showGame();
              this.startGame(false);
            }
          } else {
            this.lobby ??= this.createLobby();
            this.state = ClientState.InLobby;
          }
        }
        break;
      case "error":
        this.handleErrorMessage(msg.details);
        break;
    }
  }

  handleLobbyState(state: lobbyState) {
    this.lobby ??= this.createLobby();
    this.lobby.update(state);

    if (this.state == ClientState.JoiningLobby) {
      this.showLobby();
    } else if (this.state == ClientState.InLobby) {
      if (this.lobby.state.state == ServerLobbyState.inGame) {
        this.showGame();
        this.startGame(false);
      } else {
        this.lobby.render();
      }
    }

    if (this.game) {
      this.game.updateClients(state.clients);
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

  handleGameSnapshot(snapshot: gameUpdateMessage) {
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
    const lobby = new Lobby(lobbyView);
    lobby.onGameStart = () => this.startGame(true);
    lobby.onMapSelect = this.sendSetMap.bind(this);
    lobby.onLeave = this.leaveLobby.bind(this);
    return lobby;
  }

  createGame(): Game {
    const game = new Game();
    game.updateClients(this.lobby.state.clients);
    game.htmlElement = gameView;
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
      this.lobbies = new LobbyList(lobbyListView);
      this.lobbies.onJoin = this.connectToLobby.bind(this);
      this.lobbies.onCreate = this.onLobbyCreate.bind(this);
    }
    this.startLobbyListInterval();
  }

  onLobbyCreate(name: string) {
    this.stopLobbyListInterval();
    this.lobby = this.createLobby();
    this.sendLobbyCreate(name);
    this.state = ClientState.JoiningLobby;
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
    this.showView(lobbyListView);
    this.requstLobbies();
  }

  showLobby() {
    this.state = ClientState.InLobby;
    this.showView(lobbyView);
    this.lobby.render();
  }

  showGame() {
    this.state = ClientState.InGame;
    this.showView(gameView);
  }

  showView(elm: HTMLElement) {
    allViews.forEach((elm) => elm.classList.toggle("hidden", true));
    elm.classList.remove("hidden");
  }
}

function testShowGame() {
  const client = new Client();
  client.connect();
  // client.showLoginPage();

  client.conn.onopen = () => {
    client.sendClientName("test");
    client.onLobbyCreate("test");
    window.setTimeout(() => client.startGame(true), 10);
  };
}

window.onload = async function () {
  const client = new Client();
  client.connect();
  client.showLoginPage();

  // testShowGame();
};
