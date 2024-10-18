export type input = { action: string; dt: number };

export type unprocessedInput = {
  inputId: number;
  input: input;
  x: number;
  y: number;
  speed: number;
};

export enum Action {
  Up = "Up",
  Down = "Down",
  Left = "Left",
  Right = "Right",
  UpLeft = "UpLeft",
  UpRight = "UpRight",
  DownLeft = "DownLeft",
  DownRight = "DownRight",
}
