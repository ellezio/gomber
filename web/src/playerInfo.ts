import { Player } from "./entities/player";

export class PlayerInfo {
  player: Player;

  constructor(
    private offset: number,
    private scale: number,
  ) {}

  update(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "black";
    ctx.font = "48px serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${this.player.hp} HP`, this.offset + 0, 48);

    ctx.fillStyle = "black";
    ctx.font = "48px serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `${this.player.availableBombs}/${this.player.maxBombs} Bombs`,
      this.offset + 0,
      96,
    );
  }
}
