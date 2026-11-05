export type clients = {
  id: number;
  name: string;
  latency: number;
  admin: boolean;
}[];

export enum ServerLobbyState {
  inLobby,
  inGame,
  closing,
}

export type lobbyState = {
  name: string;
  clients: clients;
  gameMaps: string[];
  mapCap: number;
  currentMap: string;
  state: ServerLobbyState;
};

export class Lobby {
  root: HTMLElement;
  state: lobbyState;
  isAdmin: boolean;
  myClientID: number;
  onGameStart: () => void;
  onMapSelect: (mapName: string) => void;
  onLeave: () => void;
  onKick: (playerID: number) => void;

  constructor(root: HTMLElement, myClientID: number) {
    this.root = root;
    this.myClientID = myClientID;
  }

  setClientID(clientID: number) {
    this.myClientID = clientID;
    this.updateAdmin();
  }

  private updateAdmin() {
    for (const client of this.state.clients) {
      if (client.id == this.myClientID && client.admin) {
        this.isAdmin = true;
        break;
      }
    }
  }

  update(state: lobbyState) {
    this.state = state;
    this.updateAdmin();
  }

  render() {
    const leftPane = this.root.querySelector(".left");
    const topBar = leftPane.querySelector(".lobby-top-bar");
    const info = topBar.querySelector(".lobby-info");
    const leaveBtn = topBar.querySelector(".lobby-leave") as HTMLButtonElement;
    const clientList = leftPane.querySelector(".lobby-client-list");
    const rightPane = this.root.querySelector(".right");
    const mapSelectorPane = rightPane.querySelector(".map-selector-pane");
    const startGameBtn = rightPane.querySelector(
      ".lobby-start-game",
    ) as HTMLButtonElement;

    info.innerHTML = `
      <div>${this.state.name} - ${this.state.currentMap}</div>
      <div>${this.state.clients?.length ?? 0} / ${this.state.mapCap}</div>
    `;

    const oldMapSelect = document.getElementById(
      "map-select",
    ) as HTMLSelectElement;
    if (!oldMapSelect || oldMapSelect.value != this.state.currentMap) {
      const mapSelect = document.createElement("select");
      mapSelect.id = "map-select";
      mapSelect.oninput = (evt) =>
        this.onMapSelect((evt.target as HTMLSelectElement).value);
      for (const map of this.state.gameMaps) {
        const mapOption = document.createElement("option");
        mapOption.value = map;
        mapOption.innerText = map;
        mapOption.selected = map == this.state.currentMap;
        mapSelect.appendChild(mapOption);
      }

      mapSelectorPane.replaceChildren(mapSelect);
    }

    const clients = [];
    for (const client of this.state.clients) {
      const c = document.createElement("div");
      c.classList = "list-item";
      if (client.admin) {
        c.classList.add("admin");
      }
      c.innerHTML = `<div class="lobby-client-info"><span class="lobby-client-name">${client.name}</span> <span>${client.latency} ms</span></div>`;
      if (this.isAdmin && !client.admin) {
        const btn = document.createElement("button");
        btn.classList = "kick";
        btn.innerText = "Kick";
        btn.onclick = () => this.onKick(client.id);
        c.appendChild(btn);
      }
      clients.push(c);
    }
    clientList.replaceChildren(...clients);

    leaveBtn.onclick = this.onLeave;
    startGameBtn.onclick = this.onGameStart;

    if (!this.isAdmin) {
      rightPane.classList.toggle("hidden", true);
    }
  }
}
