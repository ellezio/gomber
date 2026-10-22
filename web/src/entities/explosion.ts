import { Entity } from "./entity";

export class Explosion extends Entity {
  private showTime = 0.3; // second
  private showTimeCounter = 0;

  update(dt: number) {
    this.showTimeCounter += dt;
    if (this.showTimeCounter >= this.showTime) {
      this.active = false;
    }
  }
}
