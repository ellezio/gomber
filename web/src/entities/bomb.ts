import { TILE_SIZE } from "../gameMap";
import { Entity } from "./entity";
import { Explosion } from "./explosion";

export class Bomb extends Entity {
  countDown: number;
  explosionRange: number;
  private countAcc = 0;
  private toExplode = false;

  render(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.active) return;

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

  update(dt: number) {
    if (!this.active) return;

    this.countAcc += dt;

    if (this.countAcc >= 1) {
      const elapsed = Math.trunc(this.countAcc);
      this.countAcc -= elapsed;
      this.countDown -= elapsed;
    }

    if (this.countDown <= 0 || this.toExplode) {
      this.explode();
    }
  }

  onCollision(collider: Entity) {
    if (!this.active) return;

    if (collider instanceof Explosion) {
      this.toExplode = true;
    }
  }

  private explode() {
    const grid = this.game.gameMap.grid;
    const x = Math.floor(this.position.x / TILE_SIZE);
    const y = Math.floor(this.position.y / TILE_SIZE);

    const reach = (dx: number, dy: number): number => {
      let distance = 0;
      for (let i = 1; i <= this.explosionRange; i++) {
        const tile = grid[y + dy * i]?.[x + dx * i];
        if (tile === undefined) break;

        // don't render explosion on solid wall
        if (tile === 1) break;

        distance = i;

        // render explosion on destructible wall
        if (tile === 2) break;
      }
      return distance;
    };

    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
    ]) {
      const before = reach(-dx, -dy);
      const after = reach(dx, dy);
      this.game.instantiate(
        new Explosion(
          this.game,
          0,
          {
            x: this.position.x - dx * before * TILE_SIZE,
            y: this.position.y - dy * before * TILE_SIZE,
          },
          {
            width: (1 + dx * (before + after)) * TILE_SIZE,
            height: (1 + dy * (before + after)) * TILE_SIZE,
          },
          "yellow",
          true,
        ),
      );
    }

    this.active = false;
  }
}
