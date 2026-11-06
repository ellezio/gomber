import { bombInMsg, Game } from "../game";
import { TILE_SIZE } from "../gameMap";
import { Entity, position, size } from "./entity";
import { Explosion, ExplosionDirection } from "./explosion";

const sprite = new Image(TILE_SIZE, TILE_SIZE);
sprite.src = "/bomb.png";

export class Bomb extends Entity {
  countDown: number;
  explosionRange: number;
  private countAcc = 0;
  private toExplode = false;

  constructor(
    game: Game,
    id: number,
    position: position,
    size: size,
    active: boolean,
  ) {
    super(game, id, position, size, "white", active);
  }

  static fromMessage(msg: bombInMsg, game: Game) {
    const b = new Bomb(
      game,
      msg.id,
      msg.pos,
      { width: msg.aabb.max.x, height: msg.aabb.max.y },
      msg.active,
    );
    b.countDown = msg.cd;
    b.explosionRange = msg.er;

    return b;
  }

  render(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.active) return;

    ctx.drawImage(
      sprite,
      this.position.x,
      this.position.y,
      this.size.width,
      this.size.height,
    );

    ctx.fillStyle = "white";
    ctx.font = "24px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      this.countDown.toString(),
      this.position.x * scale + (this.size.width * scale) / 2,
      this.position.y * scale + (this.size.height * scale) / 2 + 7,
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

  explode() {
    const grid = this.game.gameMap.grid;
    const x = Math.floor(this.position.x / TILE_SIZE);
    const y = Math.floor(this.position.y / TILE_SIZE);

    if (grid[y]?.[x] === 1) {
      this.active = false;
      return;
    }

    const reach = (dx: number, dy: number): number => {
      let distance = 0;
      for (let i = 1; i <= this.explosionRange; i++) {
        const tileX = x + dx * i;
        const tileY = y + dy * i;
        const tile = grid[tileY]?.[tileX];
        if (tile === undefined) break;

        // don't render explosion on solid wall
        if (tile === 1) break;

        distance = i;

        // render explosion on destructible wall
        if (tile === 2) break;

        // if there is bomb on an explosion way it should stop there
        // as the bomb is considered as blocking entity
        if (
          this.game.state.bombs.some(
            (bomb) =>
              bomb.active &&
              bomb !== this &&
              Math.floor(bomb.position.x / TILE_SIZE) === tileX &&
              Math.floor(bomb.position.y / TILE_SIZE) === tileY,
          )
        ) {
          break;
        }
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
            width: (1 + dx * before) * TILE_SIZE,
            height: (1 + dy * before) * TILE_SIZE,
          },
          true,
          dx == 0 ? ExplosionDirection.Up : ExplosionDirection.Left,
        ),
      );

      this.game.instantiate(
        new Explosion(
          this.game,
          0,
          {
            x: this.position.x + dx * TILE_SIZE,
            y: this.position.y + dy * TILE_SIZE,
          },
          {
            width: dx * after * TILE_SIZE,
            height: dy * after * TILE_SIZE,
          },
          true,
          dx == 0 ? ExplosionDirection.Down : ExplosionDirection.Right,
        ),
      );
    }

    this.game.instantiate(
      new Explosion(
        this.game,
        0,
        {
          x: this.position.x,
          y: this.position.y,
        },
        {
          width: TILE_SIZE,
          height: TILE_SIZE,
        },
        true,
        ExplosionDirection.Center,
      ),
    );

    this.active = false;
  }
}
