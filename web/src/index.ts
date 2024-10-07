class GameObject {
  public id: string;
  public speed = 10;

  constructor(
    public x: number,
    public y: number,
    protected width: number,
    protected height: number,
    protected color: string,
  ) {}

  update(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

type input = { [key: string]: boolean };

class Game {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");
  player: Player;
  gameObjects: GameObject[] = [];
  input: input = {};
  inputId = 0;
  conn: WebSocket;
  updateRate = 30;
  last_ts: number;

  start() {
    this.conn = new WebSocket("ws://192.168.55.28:3000/connectplayer");
    this.conn.onmessage = (evt) => {
      const players = (evt.data as string).split("|");
      for (const player of players) {
        const data = player.split(",");
        if (data[0] === this.player.id) {
          this.player.x = parseFloat(data[1]);
          this.player.y = parseFloat(data[2]);
        } else {
          let found = false;
          for (const obj of this.gameObjects) {
            if (data[0] === obj.id) {
              found = true;
              obj.x = parseFloat(data[1]);
              obj.y = parseFloat(data[2]);
            }
          }

          if (!found) {
            const newObj = new GameObject(
              parseFloat(data[1]),
              parseFloat(data[2]),
              30,
              30,
              "green",
            );
            newObj.id = data[0];
            this.gameObjects.push(newObj);
          }
        }
      }
    };

    this.canvas.width = 1000;
    this.canvas.height = 600;
    this.canvas.style.border = "3px solid #000";
    this.canvas.style.borderRadius = "15px";

    const wrapper = document.createElement("div");
    wrapper.style.width = "fit-content";
    wrapper.style.margin = "auto";

    wrapper.appendChild(this.canvas);
    document.body.replaceChildren(wrapper);

    window.onkeyup = window.onkeydown = (evt) => {
      // evt.preventDefault();
      this.input[evt.key.toLowerCase()] = evt.type == "keydown";
    };

    setInterval(() => this.update(), 1000 / this.updateRate);
  }

  update() {
    const now_ts = +new Date();
    const last_ts = this.last_ts || now_ts;
    const dt_sec = (now_ts - last_ts) / 1000;
    this.last_ts = now_ts;

    this.clear();
    let key = "";
    if (this.input.w) key += "w";
    if (this.input.s) key += "s";
    if (this.input.a) key += "a";
    if (this.input.d) key += "d";

    if (key != "") {
      this.conn.send(
        JSON.stringify({
          id: this.inputId,
          k: key,
          dt: dt_sec,
        }),
      );

      this.inputId++;
    }

    this.gameObjects.forEach((c) => c.update(this.ctx));
    this.player.update(this.ctx);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

class Player extends GameObject {
  speed: number = 200;

  update(ctx: CanvasRenderingContext2D): void {
    super.update(ctx);
  }
}

window.onload = function () {
  const game = new Game();

  game.player = new Player(10, 120, 30, 30, "red");
  game.player.id = "p";

  game.start();
};
