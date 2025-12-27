import { Game } from "./game";

export class PlayerList {
  ctx: CanvasRenderingContext2D;

  constructor(
    private game: Game,
    private offset: number,
    private scale: number,
  ) {}

  update() {
    const players = this.game.clients;
    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      this.ctx.fillStyle = "black";
      this.ctx.font = "24px serif";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "bottom";
      this.ctx.fillText(
        `${player.name} | ${player.latency} ms`,
        this.offset + 0,
        24 * (i + 1),
      );
    }
  }
}
