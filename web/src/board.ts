import { Entity } from "./entities/entity";
import { Player } from "./entities/player";
import { input } from "./input";

export class Board {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");

  player: Player;
  entities: Entity[] = [];

  constructor(
    private width: number,
    private height: number,
  ) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.border = "3px solid #000";
    this.canvas.style.borderRadius = "15px";
  }

  update(input: input = null) {
    this.clear();

    if (input !== null) {
      this.player?.handleInput(input);
    }

    for (const entity of this.entities) {
      if (this.player?.collision.check(entity)) {
        entity.color = "green";
      } else {
        entity.color = "blue";
      }

      entity.update(this.ctx);
    }

    this.player?.update(this.ctx);
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
