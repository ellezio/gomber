import { playerInMsg } from "../game";
import { Entity, position, size } from "./entity";

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
  ) {
    super(id, position, size, color, active);
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
        width: playerMsg.aabb.max.x - playerMsg.aabb.min.x + 1,
        height: playerMsg.aabb.max.y - playerMsg.aabb.min.y + 1,
      },
      "green",
      playerMsg.active,
      playerMsg.name,
      playerMsg.speed,
      playerMsg.maxBombs,
      playerMsg.availableBombs,
      playerMsg.hp,
    );
  }

  updateFromMessage(playerMsg: playerInMsg) {
    this.position.x = playerMsg.pos.x;
    this.position.y = playerMsg.pos.y;
    this.size.width = playerMsg.aabb.max.x;
    this.size.height = playerMsg.aabb.max.y;
    this.speed = playerMsg.speed;
    this.maxBombs = playerMsg.maxBombs;
    this.availableBombs = playerMsg.availableBombs;
    this.hp = playerMsg.hp;
    this.active = playerMsg.active;
    this.name = playerMsg.name;
  }

  update(ctx: CanvasRenderingContext2D, offset: number, scale: number): void {
    super.update(ctx, offset, scale);

    if (!this.active) return;

    ctx.fillStyle = "black";
    ctx.font = "24px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      this.name,
      this.size.width / 2 + this.position.x * scale + offset,
      this.position.y * scale,
    );
  }
}
