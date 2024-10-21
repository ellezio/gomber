export type position = { x: number; y: number };
export type size = { width: number; height: number };

export class Entity {
  constructor(
    public id: number,
    public position: position,
    public size: size,
    public color: string,
  ) {}

  update(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.position.x,
      this.position.y,
      this.size.width,
      this.size.height,
    );
  }
}
