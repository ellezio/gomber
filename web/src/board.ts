import { Bomb } from "./entities/bomb";
import { Entity } from "./entities/entity";
import { Player } from "./entities/player";
import { input, InputHandler } from "./input";

export type TileType = number;

const SCALE = 1;

export class Board {
  grid: TileType[][];

  player: Player;
  entities: Entity[] = [];
  bombs: Bomb[] = [];
  explosions: Entity[] = [];
  powerups: Entity[] = [];

  constructor(
    private offset: number,
    private inputHandler: InputHandler,
  ) {}

  setGrid(grid: TileType[][]) {
    // const rowsCount = grid.length;
    // const colsCount = grid[0].length;

    // this.canvas.width = colsCount * 50;
    // this.canvas.height = rowsCount * 50;

    this.grid = grid;
  }

  updateGrid(grid: TileType[][]) {
    this.grid = grid;
  }

  update(ctx: CanvasRenderingContext2D, input: input | null = null) {
    // if (this.player !== undefined && input !== null) {
    //   const command = this.inputHandler.handleInput(input);
    //   command && command(this.player);
    // }

    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const tile = this.grid[y][x];
        if (tile === 0) continue;

        if (tile === 1) {
          ctx.fillStyle = "gray";
        } else if (tile === 2) {
          ctx.fillStyle = "brown";
        }

        const size = 50 * SCALE;
        ctx.fillRect(this.offset + x * size, y * size, size, size);
      }
    }

    for (const entity of this.entities) {
      // if (this.player?.collision.check(entity)) {
      //   entity.color = "green";
      // } else {
      //   entity.color = "blue";
      // }

      entity.update(ctx, this.offset, SCALE);
    }

    this.bombs.forEach((b) => b.update(ctx, this.offset, SCALE));
    this.explosions.forEach((e) => e.update(ctx, this.offset, SCALE));
    this.powerups.forEach((e) => e.update(ctx, this.offset, SCALE));
    this.player?.update(ctx, this.offset, SCALE);
  }
}
