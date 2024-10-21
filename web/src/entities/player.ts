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
    this.speed = speed;
  }

  update(ctx: CanvasRenderingContext2D): void {
    super.update(ctx);
  }

  handleInput(input: input) {
    const dist = input.dt * this.speed;

    this.prevPosition = { x: this.position.x, y: this.position.y };

    switch (input.action) {
      case Action.Up:
        this.position.y = +(this.position.y - dist).toFixed(4);
        break;
      case Action.UpRight:
        this.position.y = +(this.position.y - dist).toFixed(4);
        this.position.x = +(this.position.x + dist).toFixed(4);
        break;
      case Action.Right:
        this.position.x = +(this.position.x + dist).toFixed(4);
        break;
      case Action.DownRight:
        this.position.x = +(this.position.x + dist).toFixed(4);
        this.position.y = +(this.position.y + dist).toFixed(4);
        break;
      case Action.Down:
        this.position.y = +(this.position.y + dist).toFixed(4);
        break;
      case Action.DownLeft:
        this.position.y = +(this.position.y + dist).toFixed(4);
        this.position.x = +(this.position.x - dist).toFixed(4);
        break;
      case Action.Left:
        this.position.x = +(this.position.x - dist).toFixed(4);
        break;
      case Action.UpLeft:
        this.position.x = +(this.position.x - dist).toFixed(4);
        this.position.y = +(this.position.y - dist).toFixed(4);
        break;
    }
  }
}
