export type TileType = number;

export const TILE_SIZE = 50;
export const SCALE = 1;

const wall = new Image(TILE_SIZE, TILE_SIZE);
wall.src = "/wall.png";

const destructibleWall = new Image(TILE_SIZE, TILE_SIZE);
destructibleWall.src = "/destructible_wall.png";

const floor = new Image(TILE_SIZE, TILE_SIZE);
floor.src = "/floor.png";

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

        const size = TILE_SIZE * SCALE;
        switch (tile) {
          case 0:
            ctx.drawImage(floor, x * size, y * size, size, size);
            break;
          case 1:
            ctx.drawImage(wall, x * size, y * size, size, size);
            break;
          case 2:
            ctx.drawImage(destructibleWall, x * size, y * size, size, size);
            break;
        }
      }
    }
  }
}
