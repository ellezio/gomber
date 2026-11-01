import { Game } from "../game";
import { TILE_SIZE } from "../gameMap";
import { Entity, position, size } from "./entity";

const spriteCenter = new Image(TILE_SIZE, TILE_SIZE);
spriteCenter.src = "/explosion_center.png";

const spriteMiddle = new Image(TILE_SIZE, TILE_SIZE);
spriteMiddle.src = "/explosion_middle.png";

const spriteEnd = new Image(TILE_SIZE, TILE_SIZE);
spriteEnd.src = "/explosion_end.png";

export enum ExplosionDirection {
  Center,
  Up,
  Down,
  Left,
  Right,
}

export class Explosion extends Entity {
  private showTime = 0.3; // second
  private showTimeCounter = 0;

  constructor(
    game: Game,
    id: number,
    position: position,
    size: size,
    active: boolean,
    private direction: ExplosionDirection,
  ) {
    super(game, id, position, size, "", active);
  }

  update(dt: number) {
    this.showTimeCounter += dt;
    if (this.showTimeCounter >= this.showTime) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.active) return;

    if (this.direction == ExplosionDirection.Center) {
      ctx.drawImage(
        spriteCenter,
        this.position.x,
        this.position.y,
        TILE_SIZE,
        TILE_SIZE,
      );
    } else {
      const up = Number(this.direction === ExplosionDirection.Up);
      const down = Number(this.direction === ExplosionDirection.Down);
      const left = Number(this.direction === ExplosionDirection.Left);
      const right = Number(this.direction === ExplosionDirection.Right);

      if (
        this.direction === ExplosionDirection.Left ||
        this.direction === ExplosionDirection.Right
      ) {
        for (
          let x = this.position.x + left * TILE_SIZE;
          x < this.position.x + this.size.width - right * TILE_SIZE;
          x += TILE_SIZE
        ) {
          ctx.drawImage(spriteMiddle, x, this.position.y, TILE_SIZE, TILE_SIZE);
        }

        ctx.save();
        ctx.translate(
          this.position.x +
            right * (this.size.width - TILE_SIZE) +
            TILE_SIZE / 2,
          this.position.y + TILE_SIZE / 2,
        );
        ctx.rotate((right * 180 * Math.PI) / 180);
        ctx.drawImage(
          spriteEnd,
          -TILE_SIZE / 2,
          -TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
        );
        ctx.restore();
      } else {
        for (
          let y = this.position.y + up * TILE_SIZE;
          y < this.position.y + this.size.height - down * TILE_SIZE;
          y += TILE_SIZE
        ) {
          ctx.save();
          ctx.translate(this.position.x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.rotate(((up * 90 + down * -90) * Math.PI) / 180);
          ctx.drawImage(
            spriteMiddle,
            -TILE_SIZE / 2,
            -TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
          );
          ctx.restore();
        }

        ctx.save();
        ctx.translate(
          this.position.x + TILE_SIZE / 2,
          this.position.y +
            down * (this.size.height - TILE_SIZE) +
            TILE_SIZE / 2,
        );
        ctx.rotate(((up * 90 + down * -90) * Math.PI) / 180);
        ctx.drawImage(
          spriteEnd,
          -TILE_SIZE / 2,
          -TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
        );
        ctx.restore();
      }
    }
  }
}
