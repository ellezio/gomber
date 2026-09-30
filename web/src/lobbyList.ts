export class LobbyItem {
  id: number;
  name: string;
}

export class LobbyList {
  root: HTMLElement;
  lobbies: LobbyItem[];

  onJoin: (lobbyID: number) => void;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  update(lobbies: LobbyItem[]) {
    this.lobbies = lobbies;
  }

  render() {
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

    this.root.replaceChildren(lobbies);
  }

  handleMessage(data: LobbyItem[]) {
    this.update(data);
    this.render();
  }
}
