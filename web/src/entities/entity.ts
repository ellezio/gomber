import { Game } from "../game";

export type position = { x: number; y: number };
export type size = { width: number; height: number };

export class Entity {
  prevPosition: position;

  constructor(
    public game: Game,
    public id: number,
    public position: position,
    public size: size,
    public color: string,
    public active: boolean,
  ) {}

  render(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.active) return;

    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.position.x * scale,
      this.position.y * scale,
      this.size.width * scale,
      this.size.height * scale,
    );
  }
}
