import { Entity } from "./entity";

export class Bomb extends Entity {
  countDown: number;

  update(ctx: CanvasRenderingContext2D, offset: number, scale: number) {
    ctx.fillStyle = "white";
    ctx.fillRect(
      this.position.x * scale + offset,
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
      this.position.x * scale + offset + (this.size.width * scale) / 2,
      this.position.y * scale + (this.size.height * scale) / 2,
    );
  }
}
