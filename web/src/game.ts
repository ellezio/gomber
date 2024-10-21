import { Board } from "./board";
import { Player } from "./entities/player";
import { Action, unprocessedInput } from "./input";

type pressedKeys = { [key: string]: boolean };

type Message =
  | {
      type: "PlayerInit";
      data: {
        id: number;
        x: number;
        y: number;
        speed: number;
      };
    }
  | {
      type: "State";
      data: {
        players: {
          id: number;
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
    // this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    // this.conn.onmessage = this.messageHandler.bind(this);

    this.board = new Board(1000, 600);
    this.populateDOM();

    this.board.player = new Player(
      0,
      { x: 100, y: 100 },
      { width: 30, height: 30 },
      200,
      "red",
    );

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
        { x: data.x, y: data.y },
        { width: 30, height: 30 },
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
              this.board.player.position.x = player.x;
              this.board.player.position.y = player.y;
              this.board.player.speed = player.speed;
            } else {
              if (
                processingInput.x !== player.x ||
                processingInput.y !== player.y ||
                processingInput.speed !== player.speed
              ) {
                this.board.player.position.x = player.x;
                this.board.player.position.y = player.y;
                this.board.player.speed = player.speed;
                for (const uinp of this.unprocessedInputs) {
                  this.board.player.handleInput(uinp.input);
                }
              }
            }
          }
        } else {
          const obj = this.board.entities.find(
            (obj) => obj.id === player.id,
          ) as Player;
          if (obj !== undefined) {
            obj.position.x = player.x;
            obj.position.y = player.y;
            obj.speed = player.speed;
          } else {
            const newPlayer = new Player(
              player.id,
              { x: player.x, y: player.y },
              { width: 30, height: 30 },
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

    const input = action === "" ? null : { action, dt };
    this.board.update(input);

    // if (input != null) {
    //   const last_uinp =
    //     this.unprocessedInputs[this.unprocessedInputs.length - 1];
    //   const uinp: unprocessedInput = {
    //     inputId: (last_uinp?.inputId ?? 0) + 1,
    //     x: this.board.player.position.x,
    //     y: this.board.player.position.y,
    //     speed: this.board.player.speed,
    //     input,
    //   };
    //   this.unprocessedInputs.push(uinp);
    //   this.conn.send(
    //     JSON.stringify({
    //       i: uinp.inputId,
    //       a: uinp.input.action,
    //       dt: uinp.input.dt,
    //     }),
    //   );
    // }
  }
}
