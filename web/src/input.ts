import { Player } from "./entities/player";

export type input = { actions: Action[]; dt: number };
export type unprocessedInput = {
  seq: number;
  input: input;
};

export enum Action {
  Up = "up",
  Down = "down",
  Left = "left",
  Right = "right",
  DropBomb = "dropBomb",
}

type pressedKeys = { [key: string]: boolean };

export class InputController {
  pressedKey: pressedKeys = {};

  handleKeyboardEvent = (evt: KeyboardEvent) => {
    if (evt.key == " ") {
      evt.preventDefault();
    }

    this.pressedKey[evt.key.toLowerCase()] = evt.type == "keydown";
  };

  currentInput(dt: number): input | null {
    const actions: Action[] = [];
    if (this.pressedKey.w) actions.push(Action.Up);
    if (this.pressedKey.d) actions.push(Action.Right);
    if (this.pressedKey.s) actions.push(Action.Down);
    if (this.pressedKey.a) actions.push(Action.Left);
    if (this.pressedKey[" "]) actions.push(Action.DropBomb);

    if (actions.length) {
      return { actions, dt };
    }
    return null;
  }

  handleInput(input: input, player: Player) {
    const dt = input.dt;
    const actions = input.actions;

    let [dx, dy] = [0, 0];

    if (actions.includes(Action.Up)) dy -= 1.0;
    if (actions.includes(Action.Down)) dy += 1.0;
    if (actions.includes(Action.Left)) dx -= 1.0;
    if (actions.includes(Action.Right)) dx += 1.0;

    if (dx != 0.0 && dy != 0.0) {
      const c = Math.sqrt(2) / 2;
      dx *= c;
      dy *= c;
    }

    if (dx != 0.0 || dy != 0.0) {
      player.prevPosition = { x: player.position.x, y: player.position.y };
      player.position.x = +(player.position.x + dx * dt * player.speed);
      player.position.y = +(player.position.y + dy * dt * player.speed);
    }
  }
}
