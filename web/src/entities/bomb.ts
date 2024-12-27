import { Entity } from "./entity";

export class Bomb extends Entity {
  countDown: number;

  update(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "white";
    ctx.fillRect(
      this.position.x,
      this.position.y,
      this.size.width,
      this.size.height,
    );

    ctx.fillStyle = "black";
    ctx.font = "48px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      this.countDown.toString(),
      this.position.x + this.size.width / 2,
      this.position.y + this.size.height / 2,
    );
  }
}
