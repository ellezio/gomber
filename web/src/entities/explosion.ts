import { Entity } from "./entity";

export class Explosion extends Entity {
  private showTime = 0.3; // second
  private showTimeCounter = 0;

  update(
    ctx: CanvasRenderingContext2D,
    offset: number,
    scale: number,
    dt: number,
  ): void {
    this.showTimeCounter += dt;
    if (this.showTimeCounter >= this.showTime) {
      this.active = false;
    }
    super.update(ctx, offset, scale, dt);
  }
}
