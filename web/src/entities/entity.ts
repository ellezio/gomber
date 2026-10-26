import { Game, powerUpInMsg } from "../game";

export type position = { x: number; y: number };
export type size = { width: number; height: number };

export class Entity {
  prevPosition: position;

  constructor(
    public game: Game,
    public id: number,
    public position: position,
    public size: size,
    public color: string,
    public active: boolean,
  ) {}

  render(ctx: CanvasRenderingContext2D, scale: number) {
    if (!this.active) return;

    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.position.x * scale,
      this.position.y * scale,
      this.size.width * scale,
      this.size.height * scale,
    );
  }

  onCollision(_collider: Entity) {}
}

export function powerUpFromMessage(msg: powerUpInMsg) {
  return new Entity(
    this,
    msg.id,
    msg.pos,
    { width: msg.aabb.max.x, height: msg.aabb.max.y },
    "purple",
    msg.active,
  );
}
