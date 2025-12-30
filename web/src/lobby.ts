export type clients = {
  id: number;
  name: string;
  latency: number;
}[];

export type lobbyState = {
  name: string;
  clients: clients;
};

export class Lobby {
  root: HTMLElement;
  state: lobbyState;
  ongamestart: () => void;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  update(state: lobbyState) {
    this.state = state;
  }

  render() {
    const lobby = document.createElement("div");

    const title = document.createElement("h2");
    title.innerText = this.state.name;
    lobby.appendChild(title);

    for (const client of this.state.clients) {
      const c = document.createElement("div");
      c.innerHTML = `<span>${client.name}</span> | <span>${client.latency} ms</span>`;
      lobby.appendChild(c);
    }

    const btn = document.createElement("button");
    btn.innerText = "Start game";
    btn.onclick = this.ongamestart;
    lobby.appendChild(btn);

    this.root.replaceChildren(lobby);
  }

  handleMessage(data: lobbyState, render: boolean) {
    this.update(data);
    if (render) this.render();
  }
}
