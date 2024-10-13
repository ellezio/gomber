class GameObject {
  public id: string;
  public speed = 0;

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
type input = { action: string; dt: number };
type unprocessedInput = {
  inputId: number;
  input: input;
  x: number;
  y: number;
  speed: number;
};

enum Action {
  Up = "Up",
  Down = "Down",
  Left = "Left",
  Right = "Right",
  UpLeft = "UpLeft",
  UpRight = "UpRight",
  DownLeft = "DownLeft",
  DownRight = "DownRight",
}

type Message =
  | {
      type: "PlayerInit";
      data: {
        id: string;
        x: number;
        y: number;
        speed: number;
      };
    }
  | {
      type: "State";
      data: {
        players: {
          id: string;
          x: number;
          y: number;
          speed: number;
        }[];
        input: {
          i: number;
          a: Action;
          dt: number;
        };
      };
    };

class Game {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");
  fps = document.createElement("div");
  fc = 0;
  dtSum = 0;
  player: Player;
  gameObjects: GameObject[] = [];
  pressedKey: pressedKeys = {};
  unprocessedInputs: unprocessedInput[] = [];
  conn: WebSocket;
  updateRate = 50;
  lastTs: number;

  start() {
    this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    this.conn.onmessage = (evt) => {
      const message: Message = JSON.parse(evt.data);

      if (message.type === "PlayerInit") {
        const data = message.data;
        this.player = new Player(data.x, data.y, 30, 30, "red");
        this.player.speed = data.speed;
        this.player.id = data.id;
        return;
      } else if (message.type === "State") {
        const data = message.data;

        for (const player of data.players ?? []) {
          if (this.player.id === player.id) {
            if (data.input === null) {
              continue;
            }

            const processingInput = this.unprocessedInputs.shift();
            if (processingInput !== undefined) {
              if (processingInput.inputId !== data.input.i) {
                this.unprocessedInputs.length = 0;
                this.player.x = player.x;
                this.player.y = player.y;
                this.player.speed = player.speed;
              } else {
                if (
                  processingInput.x !== player.x ||
                  processingInput.y !== player.y ||
                  processingInput.speed !== player.speed
                ) {
                  this.player.x = player.x;
                  this.player.y = player.y;
                  this.player.speed = player.speed;
                  for (const uinp of this.unprocessedInputs) {
                    this.player.handleInput(uinp.input);
                  }
                }
              }
            }
          } else {
            const obj = this.gameObjects.find((obj) => obj.id === player.id);
            if (obj !== undefined) {
              obj.x = player.x;
              obj.y = player.y;
              obj.speed = player.speed;
            } else {
              const newObj = new GameObject(
                player.x,
                player.y,
                30,
                30,
                "green",
              );
              newObj.speed = player.speed;
              newObj.id = player.id;
              this.gameObjects.push(newObj);
            }
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
    document.body.appendChild(this.fps);

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

    this.fc++;
    this.dtSum += dt;
    if (this.dtSum >= 1) {
      this.fps.innerHTML = this.fc + " fps";
      this.dtSum = 0;
      this.fc = 0;
    }

    this.clear();

    let action = "";
    if (this.pressedKey.w && this.pressedKey.d) action = Action.UpRight;
    else if (this.pressedKey.s && this.pressedKey.d) action = Action.DownRight;
    else if (this.pressedKey.s && this.pressedKey.a) action = Action.DownLeft;
    else if (this.pressedKey.w && this.pressedKey.a) action = Action.UpLeft;
    else if (this.pressedKey.w) action = Action.Up;
    else if (this.pressedKey.d) action = Action.Right;
    else if (this.pressedKey.s) action = Action.Down;
    else if (this.pressedKey.a) action = Action.Left;

    if (action != "") {
      const last_uinp =
        this.unprocessedInputs[this.unprocessedInputs.length - 1];
      const input = { action, dt };
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
          i: uinp.inputId,
          a: uinp.input.action,
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
    const dist = input.dt * this.speed;

    switch (input.action) {
      case Action.Up:
        this.y = +(this.y - dist).toFixed(4);
        break;
      case Action.UpRight:
        this.y = +(this.y - dist).toFixed(4);
        this.x = +(this.x + dist).toFixed(4);
        break;
      case Action.Right:
        this.x = +(this.x + dist).toFixed(4);
        break;
      case Action.DownRight:
        this.x = +(this.x + dist).toFixed(4);
        this.y = +(this.y + dist).toFixed(4);
        break;
      case Action.Down:
        this.y = +(this.y + dist).toFixed(4);
        break;
      case Action.DownLeft:
        this.y = +(this.y + dist).toFixed(4);
        this.x = +(this.x - dist).toFixed(4);
        break;
      case Action.Left:
        this.x = +(this.x - dist).toFixed(4);
        break;
      case Action.UpLeft:
        this.x = +(this.x - dist).toFixed(4);
        this.y = +(this.y - dist).toFixed(4);
        break;
    }
  }
}

window.onload = function () {
  const game = new Game();
  game.start();
};
