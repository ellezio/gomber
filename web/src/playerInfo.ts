import { Player } from "./entities/player";

export class PlayerInfo {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d")!;
  player: Player;

  constructor(
    private offset: number,
    private scale: number,
  ) {}

  update() {
    this.ctx.fillStyle = "black";
    this.ctx.font = "48px serif";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(`${this.player.hp} HP`, this.offset + 0, 48);

    this.ctx.fillStyle = "black";
    this.ctx.font = "48px serif";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(
      `${this.player.availableBombs}/${this.player.maxBombs} Bombs`,
      this.offset + 0,
      96,
    );
  }
}
