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
    const res = await fetch("/board");
    const data = await res.json();
    data.e.forEach((e: any) => {
      this.entities.push(new GameObject(e.x, e.y, e.w, e.h, "blue"));
    });
  }

  draw() {
    this.clear();

    for (const entity of this.entities) {
      entity.update(this.ctx);
    }

    this.player?.update(this.ctx);
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
