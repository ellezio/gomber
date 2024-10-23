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
