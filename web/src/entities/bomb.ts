import { Entity } from "./entity";

export class Bomb extends Entity {
  countDown: number;

  render(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.fillStyle = "white";
    ctx.fillRect(
      this.position.x * scale,
      this.position.y * scale,
      this.size.width * scale,
      this.size.height * scale,
    );

    ctx.fillStyle = "black";
    ctx.font = "48px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      this.countDown.toString(),
      this.position.x * scale + (this.size.width * scale) / 2,
      this.position.y * scale + (this.size.height * scale) / 2,
    );
  }
}
