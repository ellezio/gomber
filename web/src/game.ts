import { Board } from "./board";
import { GameObject, Player } from "./gameObject";
import { Action, unprocessedInput } from "./input";

type pressedKeys = { [key: string]: boolean };

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

export class Game {
  board: Board;

  fps = document.createElement("div");
  fc = 0;
  dtSum = 0;

  pressedKey: pressedKeys = {};
  unprocessedInputs: unprocessedInput[] = [];
  conn: WebSocket;
  updateRate = 50;
  lastTs: number;

  async start() {
    this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    this.conn.onmessage = this.messageHandler.bind(this);

    this.board = new Board(1000, 600);
    this.populateDOM();

    await this.board.fetch();

    window.onkeyup = window.onkeydown = this.handleKeyboardEvent.bind(this);

    setInterval(() => this.update(), 1000 / this.updateRate);
  }

  private messageHandler(evt: MessageEvent<any>) {
    const message: Message = JSON.parse(evt.data);

    if (message.type === "PlayerInit") {
      const data = message.data;
      this.board.player = new Player(
        data.id,
        data.x,
        data.y,
        data.speed,
        "red",
      );
      return;
    } else if (message.type === "State") {
      const data = message.data;

      for (const player of data.players ?? []) {
        if (this.board.player.id === player.id) {
          if (data.input === null) {
            continue;
          }

          const processingInput = this.unprocessedInputs.shift();
          if (processingInput !== undefined) {
            if (processingInput.inputId !== data.input.i) {
              this.unprocessedInputs.length = 0;
              this.board.player.x = player.x;
              this.board.player.y = player.y;
              this.board.player.speed = player.speed;
            } else {
              if (
                processingInput.x !== player.x ||
                processingInput.y !== player.y ||
                processingInput.speed !== player.speed
              ) {
                this.board.player.x = player.x;
                this.board.player.y = player.y;
                this.board.player.speed = player.speed;
                for (const uinp of this.unprocessedInputs) {
                  this.board.player.handleInput(uinp.input);
                }
              }
            }
          }
        } else {
          const obj = this.board.entities.find((obj) => obj.id === player.id);
          if (obj !== undefined) {
            obj.x = player.x;
            obj.y = player.y;
            obj.speed = player.speed;
          } else {
            const newPlayer = new Player(
              player.id,
              player.x,
              player.y,
              player.speed,
              "green",
            );
            this.board.entities.push(newPlayer);
          }
        }
      }
    }
  }

  private populateDOM() {
    const wrapper = document.createElement("div");
    wrapper.style.width = "fit-content";
    wrapper.style.margin = "auto";
    wrapper.appendChild(this.board.canvas);
    document.body.replaceChildren(wrapper);
    document.body.appendChild(this.fps);
  }

  private handleKeyboardEvent(evt: KeyboardEvent) {
    // evt.preventDefault();
    this.pressedKey[evt.key.toLowerCase()] = evt.type == "keydown";
  }

  private update() {
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
      this.board.player.handleInput(input);
      const uinp: unprocessedInput = {
        inputId: (last_uinp?.inputId ?? 0) + 1,
        x: this.board.player.x,
        y: this.board.player.y,
        speed: this.board.player.speed,
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

    this.board.draw();
  }
}
