import { Entity, position, size } from "./entity";
import { input, Action } from "../input";
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

  handleInput(input: input) {
    const direction = { x: 0.0, y: 0.0 };

    if (input.actions.includes(Action.Up)) {
      direction.y -= 1.0;
    }

    if (input.actions.includes(Action.Down)) {
      direction.y += 1.0;
    }

    if (input.actions.includes(Action.Left)) {
      direction.x -= 1.0;
    }

    if (input.actions.includes(Action.Right)) {
      direction.x += 1.0;
    }

    if (direction.x != 0.0 && direction.y != 0.0) {
      const c = Math.sqrt(2) / 2;
      direction.x *= c;
      direction.y *= c;
    }

    this.prevPosition = { x: this.position.x, y: this.position.y };

    this.position.x += +(direction.x * input.dt * this.speed).toFixed(4);
    this.position.y += +(direction.y * input.dt * this.speed).toFixed(4);
  }
}
