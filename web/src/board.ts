import { Bomb } from "./entities/bomb";
import { Entity } from "./entities/entity";
import { Player } from "./entities/player";
import { input, InputHandler } from "./input";

export type TileType = number;

const SCALE = 1;

export class Board {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d")!;

  grid: TileType[][];

  player: Player;
  entities: Entity[] = [];
  bombs: Bomb[] = [];
  explosions: Entity[] = [];
  powerups: Entity[] = [];

  constructor(
    width: number,
    height: number,
    private offset: number,
    private inputHandler: InputHandler,
  ) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.border = "3px solid #000";
  }

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

  update(input: input | null = null) {
    this.clear();

    // if (this.player !== undefined && input !== null) {
    //   const command = this.inputHandler.handleInput(input);
    //   command && command(this.player);
    // }

    for (let x = 0; x < this.grid[0].length; x++) {
      for (let y = 0; y < this.grid.length; y++) {
        const tile = this.grid[y][x];
        if (tile === 1) {
          this.ctx.fillStyle = "gray";
          const size = 50 * SCALE;
          this.ctx.fillRect(this.offset + x * size, y * size, size, size);
        } else if (tile === 2) {
          this.ctx.fillStyle = "brown";
          const size = 50 * SCALE;
          this.ctx.fillRect(this.offset + x * size, y * size, size, size);
        }
      }
    }

    for (const entity of this.entities) {
      // if (this.player?.collision.check(entity)) {
      //   entity.color = "green";
      // } else {
      //   entity.color = "blue";
      // }

      entity.update(this.ctx, this.offset, SCALE);
    }

    this.bombs.forEach((b) => b.update(this.ctx, this.offset, SCALE));
    this.explosions.forEach((e) => e.update(this.ctx, this.offset, SCALE));
    this.powerups.forEach((e) => e.update(this.ctx, this.offset, SCALE));
    this.player?.update(this.ctx, this.offset, SCALE);
  }

  private clear() {
    // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#404040";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
