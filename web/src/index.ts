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

type pressedKeys = { [key: string]: boolean };
type input = { key: string; dt: number };
type unprocessedInput = {
  inputId: number;
  input: input;
  x: number;
  y: number;
  speed: number;
};

type gameData = {
  [entityId: string]: {
    type: "init" | "update";
    inputId: number;
    x: number;
    y: number;
    speed: number;
  };
};

class Game {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");
  player: Player;
  gameObjects: GameObject[] = [];
  pressedKey: pressedKeys = {};
  unprocessedInputs: unprocessedInput[] = [];
  conn: WebSocket;
  updateRate = 30;
  lastTs: number;

  start() {
    this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    this.conn.onmessage = (evt) => {
      const gameData: gameData = JSON.parse(evt.data);

      for (const [entityId, data] of Object.entries(gameData)) {
        if (data.type === "init") {
          this.player = new Player(data.x, data.y, 30, 30, "red");
          this.player.speed = data.speed;
          this.player.id = entityId;
          continue;
        }

        if (this.player.id === entityId) {
          const processingInput = this.unprocessedInputs.shift();
          if (processingInput !== undefined) {
            if (processingInput.inputId !== data.inputId) {
              this.unprocessedInputs.length = 0;
              this.player.x = data.x;
              this.player.y = data.y;
              this.player.speed = data.speed;
            } else {
              if (
                processingInput.x !== data.x ||
                processingInput.y !== data.y ||
                processingInput.speed !== data.speed
              ) {
                this.player.x = data.x;
                this.player.y = data.y;
                this.player.speed = data.speed;
                for (const uinp of this.unprocessedInputs) {
                  this.player.handleInput(uinp.input);
                }
              }
            }
          }
        } else {
          const obj = this.gameObjects.find((obj) => obj.id === entityId);
          if (obj !== undefined) {
            obj.x = data.x;
            obj.y = data.y;
            obj.speed = data.speed;
          } else {
            const newObj = new GameObject(data.x, data.y, 30, 30, "green");
            newObj.speed = data.speed;
            newObj.id = entityId;
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
      this.pressedKey[evt.key.toLowerCase()] = evt.type == "keydown";
    };

    setInterval(() => this.update(), 1000 / this.updateRate);
  }

  update() {
    const nowTs = +new Date();
    const lastTs = this.lastTs || nowTs;
    const dt = (nowTs - lastTs) / 1000;
    this.lastTs = nowTs;

    const fps = Math.round(1000 / (nowTs - lastTs));
    if (fps < 20) {
      console.log(`${fps} fps`);
    }
    this.clear();
    let key = "";
    if (this.pressedKey.w) key += "w";
    if (this.pressedKey.s) key += "s";
    if (this.pressedKey.a) key += "a";
    if (this.pressedKey.d) key += "d";

    if (key != "") {
      const last_uinp =
        this.unprocessedInputs[this.unprocessedInputs.length - 1];
      const input = { key, dt };
      this.player.handleInput(input);
      const uinp: unprocessedInput = {
        inputId: (last_uinp?.inputId ?? 0) + 1,
        x: this.player.x,
        y: this.player.y,
        speed: this.player.speed,
        input,
      };
      this.unprocessedInputs.push(uinp);
      this.conn.send(
        JSON.stringify({
          id: uinp.inputId,
          k: uinp.input.key,
          dt: uinp.input.dt,
        }),
      );
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

  handleInput(input: input) {
    const dist = +(input.dt * this.speed).toFixed(4);
    for (const key of input.key) {
      switch (key) {
        case "w":
          this.y = +(this.y - dist).toFixed(4);
          break;
        case "s":
          this.y = +(this.y + dist).toFixed(4);
          break;
        case "a":
          this.x = +(this.x - dist).toFixed(4);
          break;
        case "d":
          this.x = +(this.x + dist).toFixed(4);
          break;
      }
    }
  }
}

window.onload = function () {
  const game = new Game();
  game.start();
};
