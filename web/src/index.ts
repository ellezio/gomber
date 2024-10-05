class GameObject {
  speed = 0;

  constructor(
    protected x: number,
    protected y: number,
    protected width: number,
    protected height: number,
    protected color: string,
  ) {}

  update(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

type input = { [key: string]: boolean };

class Game {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");
  player: Player;
  gameObjects: GameObject[] = [];
  input: input = {};

  start() {
    this.canvas.width = 1000;
    this.canvas.height = 600;
    this.canvas.style.border = "3px solid #000";
    this.canvas.style.borderRadius = "15px";

    const wrapper = document.createElement("div");
    wrapper.style.width = "fit-content";
    wrapper.style.margin = "auto";

    wrapper.appendChild(this.canvas);
    document.body.replaceChildren(wrapper);

    window.onkeyup = window.onkeydown = (evt) => {
      evt.preventDefault();
      this.input[evt.key.toLowerCase()] = evt.type == "keydown";
    };
  }

  update() {
    this.clear();
    this.player.handleInput(this.input);
    this.player.update(this.ctx);
    this.gameObjects.forEach((c) => c.update(this.ctx));
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

class Player extends GameObject {
  speed: number = 10;

  update(ctx: CanvasRenderingContext2D): void {
    super.update(ctx);
  }

  handleInput(input: input) {
    if (input.w) this.y -= this.speed;
    if (input.s) this.y += this.speed;
    if (input.a) this.x -= this.speed;
    if (input.d) this.x += this.speed;
  }
}

window.onload = function () {
  const game = new Game();

  game.player = new Player(10, 120, 30, 30, "red");

  game.start();
  setInterval(() => game.update(), 20);
};
