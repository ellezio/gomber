import { Player } from "./entities/player";

export type input = { actions: Action[]; dt: number };
export type unprocessedInput = {
  inputId: number;
  input: input;
  x: number;
  y: number;
  speed: number;
};

export enum Action {
  Up = "up",
  Down = "down",
  Left = "left",
  Right = "right",
}

type command = (player: Player) => void;
type pressedKeys = { [key: string]: boolean };

export class InputHandler {
  pressedKey: pressedKeys = {};

  handleKeyboardEvent = (evt: KeyboardEvent) => {
    // evt.preventDefault();
    this.pressedKey[evt.key.toLowerCase()] = evt.type == "keydown";
  };

  getAction = (): Action[] => {
    const actions = [];
    if (this.pressedKey.w) actions.push(Action.Up);
    if (this.pressedKey.d) actions.push(Action.Right);
    if (this.pressedKey.s) actions.push(Action.Down);
    if (this.pressedKey.a) actions.push(Action.Left);

    return actions;
  };

  handleInput(input: input): command {
    let [dx, dy] = [0, 0];

    if (input.actions.includes(Action.Up)) dy -= 1.0;
    if (input.actions.includes(Action.Down)) dy += 1.0;
    if (input.actions.includes(Action.Left)) dx -= 1.0;
    if (input.actions.includes(Action.Right)) dx += 1.0;

    if (dx != 0.0 && dy != 0.0) {
      const c = Math.sqrt(2) / 2;
      dx *= c;
      dy *= c;
    }

    if (dx != 0.0 || dy != 0.0) {
      return this.move(input.dt, dx, dy);
    }

    return null;
  }

  private move(dt: number, dx: number, dy: number): command {
    return function (player: Player) {
      player.prevPosition = { x: player.position.x, y: player.position.y };
      player.position.x += +(dx * dt * player.speed).toFixed(4);
      player.position.y += +(dy * dt * player.speed).toFixed(4);
    };
  }
}
