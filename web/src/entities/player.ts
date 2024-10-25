import { Entity, position, size } from "./entity";
import { CollisionComponent } from "./components/collisionComponent";

export class Player extends Entity {
  speed: number = 200;

  collision = new CollisionComponent(this);

  constructor(
    id: number,
    position: position,
    size: size,
    speed: number,
    color: string,
  ) {
    super(id, position, size, color);
    this.prevPosition = position;
    this.speed = speed;
  }

  update(ctx: CanvasRenderingContext2D): void {
    super.update(ctx);
  }
}
