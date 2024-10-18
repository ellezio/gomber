import { GameObject, Player } from "./gameObject";

export class Board {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");

  entities: GameObject[] = [];
  player: Player;

  constructor(
    private width: number,
    private height: number,
  ) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.border = "3px solid #000";
    this.canvas.style.borderRadius = "15px";
  }

  async fetch() {
    // const rows = textBoard.split("|");
    // rows.forEach((row, y) =>
    //   row.split("").forEach((e, x) => {
    //     if (e == "1") {
    //       const entity = new GameObject(x * 50, y * 50, 50, 50, "blue");
    //       this.entities.push(entity);
    //     }
    //   }),
    // );
  }

  draw() {
    this.clear();
    this.drawBorder();

    for (const entity of this.entities) {
      entity.update(this.ctx);
    }

    this.player?.update(this.ctx);
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawBorder() {
    const size = 50;
    this.ctx.fillStyle = "blue";
    this.ctx.fillRect(0, 0, this.width, size);
    this.ctx.fillRect(0, this.height - size, this.width, size);
    this.ctx.fillRect(0, size, size, this.height - 2 * size);
    this.ctx.fillRect(this.width - size, size, size, this.height - 2 * size);
  }
}
