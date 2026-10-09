export class LobbyItem {
  id: number;
  name: string;
}

export class LobbyList {
  root: HTMLElement;
  lobbies: LobbyItem[];

  onJoin: (lobbyID: number) => void;
  onCreate: (name: string) => void;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  update(lobbies: LobbyItem[]) {
    this.lobbies = lobbies;
  }

  render() {
    const root = document.createElement("div");

    const header = document.createElement("h1");
    header.innerText = "Lobbies";
    root.appendChild(header);

    const newLobbyInput = document.createElement("input");
    newLobbyInput.name = "lobby_name";
    root.appendChild(newLobbyInput);

    const newLobbyBtn = document.createElement("button");
    newLobbyBtn.innerText = "Add";
    newLobbyBtn.onclick = () => {
      const value = newLobbyInput.value;
      this.onCreate(value);
    };
    root.appendChild(newLobbyBtn);

    if (this.lobbies) {
      const lobbies = document.createElement("div");

      for (const lobby of this.lobbies) {
        const item = document.createElement("div");
        item.innerText = `${lobby.id} ${lobby.name}`;
        const btn = document.createElement("button");
        btn.innerText = "Join";
        btn.onclick = () => this.onJoin?.(lobby.id);

        item.appendChild(btn);
        lobbies.appendChild(item);
      }

      root.appendChild(lobbies);
    }

    this.root.replaceChildren(root);
  }
}
