import { playerInMsg } from "../game";
import { TILE_SIZE } from "../gameMap";
import { Entity, position, size } from "./entity";

const sprite = new Image(TILE_SIZE, TILE_SIZE);
sprite.src = "/player.png";

export class Player extends Entity {
  constructor(
    id: number,
    position: position,
    size: size,
    color: string,
    active: boolean,
    public name: string,
    public speed: number,
    public maxBombs: number,
    public availableBombs: number,
    public hp: number,
    public serverPosition: position,
  ) {
    super(null, id, position, size, color, active);
    this.prevPosition = position;
  }

  static fromMessage(playerMsg: playerInMsg): Player {
    return new Player(
      playerMsg.id,
      {
        x: playerMsg.pos.x + playerMsg.aabb.min.x,
        y: playerMsg.pos.y + playerMsg.aabb.min.y,
      },
      {
        width: playerMsg.aabb.max.x - playerMsg.aabb.min.x,
        height: playerMsg.aabb.max.y - playerMsg.aabb.min.y,
      },
      "green",
      playerMsg.active,
      playerMsg.name,
      playerMsg.speed,
      playerMsg.maxBombs,
      playerMsg.availableBombs,
      playerMsg.hp,
      {
        x: playerMsg.pos.x + playerMsg.aabb.min.x,
        y: playerMsg.pos.y + playerMsg.aabb.min.y,
      },
    );
  }

  updateFromMessage(playerMsg: playerInMsg) {
    this.serverPosition.x = playerMsg.pos.x;
    this.serverPosition.y = playerMsg.pos.y;
    this.size.width = playerMsg.aabb.max.x;
    this.size.height = playerMsg.aabb.max.y;
    this.updateStatsFromMessage(playerMsg);
  }

  updateStatsFromMessage(playerMsg: playerInMsg) {
    this.speed = playerMsg.speed;
    this.maxBombs = playerMsg.maxBombs;
    this.availableBombs = playerMsg.availableBombs;
    this.hp = playerMsg.hp;
    this.active = playerMsg.active;
    this.name = playerMsg.name;
  }

  render(ctx: CanvasRenderingContext2D, scale: number): void {
    if (!this.active) return;

    ctx.drawImage(
      sprite,
      this.position.x - TILE_SIZE / 2 + this.size.width / 2,
      this.position.y + this.size.height - TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    );

    ctx.font = "18px Sans-serif";
    ctx.strokeStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 4;
    ctx.miterLimit = 2;
    ctx.strokeText(
      this.name,
      this.size.width / 2 + this.position.x * scale,
      (this.position.y + this.size.height - TILE_SIZE) * scale,
    );

    ctx.fillStyle = "white";
    ctx.fillText(
      this.name,
      this.size.width / 2 + this.position.x * scale,
      (this.position.y + this.size.height - TILE_SIZE) * scale,
    );
  }
}
