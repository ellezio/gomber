import { Game } from "./game";

export class PlayerList {
  constructor(
    private game: Game,
    private offset: number,
    private scale: number,
  ) {}

  update(ctx: CanvasRenderingContext2D) {
    const players = this.game.clients;
    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      ctx.fillStyle = "black";
      ctx.font = "24px serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        `${player.name} | ${player.latency} ms`,
        this.offset + 0,
        24 * (i + 1),
      );
    }
  }
}
