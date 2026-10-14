type playersListHUD = {
  name: string;
  hp: number;
  latency: number;
}[];

type playerStatsHUD = {
  hp: number;
  bombsCount: number;
};

export class HUD {
  private width: number;
  private height: number;

  private playersList: playersListHUD = [];
  private playersListPosition = { x: 0, y: 80, w: 200, h: 0 };

  private playerStats: playerStatsHUD = { hp: 0, bombsCount: 0 };
  private playerStatsPosition = { x: 0, y: 0, w: 0, h: 80 };

  updateResolution(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.playersListPosition.h = this.height;

    this.playerStatsPosition.w = this.width;
  }

  updatePlayersList(list: playersListHUD) {
    this.playersList = list;
  }

  updatePlayerStats(stats: playerStatsHUD) {
    this.playerStats = stats;
  }

  render(ctx: CanvasRenderingContext2D) {
    this.renderPlayersList(ctx);
    this.renderPlayerStats(ctx);
  }

  renderPlayersList(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "blue";
    ctx.fillRect(
      this.playersListPosition.x,
      this.playersListPosition.y,
      this.playersListPosition.x + this.playersListPosition.w,
      this.playersListPosition.y + this.playersListPosition.h,
    );

    for (let i = 0; i < this.playersList.length; i++) {
      const player = this.playersList[i];

      ctx.fillStyle = "black";
      ctx.font = "24px serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        `${player.name} | ${player.latency} ms`,
        this.playersListPosition.x,
        this.playersListPosition.y + 24 * (i + 1),
      );
    }
  }

  renderPlayerStats(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "yellow";
    ctx.fillRect(
      this.playerStatsPosition.x,
      this.playerStatsPosition.y,
      this.playerStatsPosition.x + this.playerStatsPosition.w,
      this.playerStatsPosition.y + this.playerStatsPosition.h,
    );

    ctx.fillStyle = "black";
    ctx.font = "48px serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${this.playerStats.hp} HP`, 0, 48);

    ctx.fillStyle = "black";
    ctx.font = "48px serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${this.playerStats.bombsCount} Bombs`, 500, 48);
  }
}
