export type clients = {
  id: number;
  name: string;
  latency: number;
}[];

export type lobbyState = {
  name: string;
  clients: clients;
  gameMaps: string[];
  currentMap: string;
};

export class Lobby {
  root: HTMLElement;
  state: lobbyState;
  onGameStart: () => void;
  onMapSelect: (mapName: string) => void;
  onLeave: () => void;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  update(state: lobbyState) {
    this.state = state;
  }

  render() {
    let lobby = document.getElementById("lobby-menu");
    const firstRender = !lobby;
    if (!lobby) {
      lobby = document.createElement("div");
      lobby.id = "lobby-menu";
    }

    if (!document.getElementById("lobby-name")) {
      const title = document.createElement("h2");
      title.id = "lobby-name";
      title.innerText = this.state.name;
      lobby.appendChild(title);
    }

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
      if (firstRender) {
        lobby.appendChild(mapSelect);
      } else {
        lobby.replaceChild(mapSelect, oldMapSelect);
      }
      console.log(mapSelect.value, this.state.currentMap);
    }

    const clients = document.createElement("div");
    clients.id = "lobby-clients";
    for (const client of this.state.clients) {
      const c = document.createElement("div");
      c.innerHTML = `<span>${client.name}</span> | <span>${client.latency} ms</span>`;
      clients.appendChild(c);
    }

    const oldClients = document.getElementById("lobby-clients");
    if (oldClients) {
      lobby.replaceChild(clients, oldClients);
    } else {
      lobby.appendChild(clients);
    }

    if (!document.getElementById("lobby-leave-btn")) {
      const btn = document.createElement("button");
      btn.id = "lobby-leave-btn";
      btn.innerText = "Leave";
      btn.onclick = this.onLeave;
      lobby.appendChild(btn);
    }

    if (!document.getElementById("lobby-start-game-btn")) {
      const btn = document.createElement("button");
      btn.id = "lobby-start-game-btn";
      btn.innerText = "Start game";
      btn.onclick = this.onGameStart;
      lobby.appendChild(btn);
    }

    if (firstRender) {
      this.root.replaceChildren(lobby);
    }
  }
}
