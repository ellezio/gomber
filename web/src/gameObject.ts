import { input, Action } from "./input";

export class GameObject {
  public id: string;
  public speed = 0;

  constructor(
    public x: number,
    public y: number,
    protected width: number,
    protected height: number,
    protected color: string,
  ) {}

  update(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

export class Player extends GameObject {
  speed: number = 200;

  constructor(id: string, x: number, y: number, speed: number, color: string) {
    super(x, y, 30, 30, color);
    this.id = id;
    this.speed = speed;
  }

  update(ctx: CanvasRenderingContext2D): void {
    super.update(ctx);
  }

  handleInput(input: input) {
    const dist = input.dt * this.speed;

    switch (input.action) {
      case Action.Up:
        this.y = +(this.y - dist).toFixed(4);
        break;
      case Action.UpRight:
        this.y = +(this.y - dist).toFixed(4);
        this.x = +(this.x + dist).toFixed(4);
        break;
      case Action.Right:
        this.x = +(this.x + dist).toFixed(4);
        break;
      case Action.DownRight:
        this.x = +(this.x + dist).toFixed(4);
        this.y = +(this.y + dist).toFixed(4);
        break;
      case Action.Down:
        this.y = +(this.y + dist).toFixed(4);
        break;
      case Action.DownLeft:
        this.y = +(this.y + dist).toFixed(4);
        this.x = +(this.x - dist).toFixed(4);
        break;
      case Action.Left:
        this.x = +(this.x - dist).toFixed(4);
        break;
      case Action.UpLeft:
        this.x = +(this.x - dist).toFixed(4);
        this.y = +(this.y - dist).toFixed(4);
        break;
    }
  }
}
