import { playerInMsg } from "../game";
import { Entity, position, size } from "./entity";

export class Player extends Entity {
  constructor(
    id: number,
    position: position,
    size: size,
    color: string,
    public speed: number,
    public maxBombs: number,
    public availableBombs: number,
    public hp: number,
  ) {
    super(id, position, size, color);
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
  }

  update(ctx: CanvasRenderingContext2D): void {
    super.update(ctx);
  }
}
