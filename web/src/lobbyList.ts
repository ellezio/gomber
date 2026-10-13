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
    const newLobbyInp = this.root.querySelector(
      ".new-lobby-input",
    ) as HTMLInputElement;

    const newLobbyBtn = this.root.querySelector(
      ".new-lobby-button",
    ) as HTMLButtonElement;

    const lobbyList = this.root.querySelector(".lobby-list") as HTMLDivElement;

    newLobbyBtn.onclick = () => {
      const value = newLobbyInp.value;
      this.onCreate(value);
    };

    if (this.lobbies) {
      const items = [];
      for (const lobby of this.lobbies) {
        const item = document.createElement("div");
        item.classList = "lobby-item";
        item.innerHTML = `
          <div class="left">${lobby.name}</div>
          <button class="operation-button">Join</button>
        `;
        const btn = item.querySelector("button");
        btn.onclick = () => this.onJoin?.(lobby.id);
        items.push(item);
      }

      lobbyList.replaceChildren(...items);
    }
  }
}
