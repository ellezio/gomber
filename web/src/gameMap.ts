export type TileType = number;

export const TILE_SIZE = 50;
export const SCALE = 1;

export class GameMap {
  grid: TileType[][];

  width: number;
  height: number;

  setGrid(grid: TileType[][]) {
    const rowsCount = grid.length;
    const colsCount = grid[0].length;

    this.width = colsCount * TILE_SIZE;
    this.height = rowsCount * TILE_SIZE;

    this.grid = grid;
  }

  updateGrid(grid: TileType[][]) {
    this.grid = grid;
  }

  render(ctx: CanvasRenderingContext2D) {
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[0].length; x++) {
        const tile = this.grid[y][x];
        if (tile === 0) continue;

        if (tile === 1) {
          ctx.fillStyle = "gray";
        } else if (tile === 2) {
          ctx.fillStyle = "brown";
        }

        const size = TILE_SIZE * SCALE;
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  }
}
