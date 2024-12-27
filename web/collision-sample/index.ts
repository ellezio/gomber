window.onload = function () {
  const cs = new CollisionSample();
  cs.start();
};

type vector2 = { x: number; y: number };
type box2 = { pos: vector2; size: vector2 };
type ray = { start: vector2; end: vector2 };

class CollisionSample {
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d")!;

  refreshRate = 60;

  staticBox: box2 = { pos: { x: 0, y: 0 }, size: { x: 100, y: 200 } };
  box: box2 = { pos: { x: 0, y: 0 }, size: { x: 20, y: 150 } };
  ray: ray = { start: { x: -1, y: -1 }, end: { x: -1, y: -1 } };

  start() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);

    this.staticBox.pos.x = this.canvas.width / 2 - this.staticBox.size.x / 2;
    this.staticBox.pos.y = this.canvas.height / 2 - this.staticBox.size.y / 2;

    window.addEventListener("mousemove", this.mouseHandler.bind(this));
    window.addEventListener("mouseup", this.mouseHandler.bind(this));

    setInterval(this.update.bind(this), 1000 / this.refreshRate);
  }

  mouseHandler(evt: MouseEvent) {
    if (evt.type === "mousemove") {
      this.ray.end.x = evt.x;
      this.ray.end.y = evt.y;
    } else if (evt.type === "mouseup") {
      this.ray.start.x = evt.x;
      this.ray.start.y = evt.y;
      this.ray.end.x = evt.x;
      this.ray.end.y = evt.y;
    }
  }

  setBoxPosition(box: box2, pos: vector2) {
    box.pos.x = pos.x - box.size.x / 2;
    box.pos.y = pos.y - box.size.y / 2;
  }

  expandBox(source: box2, size: vector2): box2 {
    return {
      pos: {
        x: source.pos.x - size.x / 2,
        y: source.pos.y - size.y / 2,
      },
      size: {
        x: source.size.x + size.x,
        y: source.size.y + size.y,
      },
    };
  }

  strokeBox(box: box2) {
    this.ctx.strokeRect(box.pos.x, box.pos.y, box.size.x, box.size.y);
  }

  strokeRay(ray: ray) {
    this.ctx.beginPath();
    this.ctx.moveTo(ray.start.x, ray.start.y);
    this.ctx.lineTo(ray.end.x, ray.end.y);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  addVector2(source: vector2, other: vector2): vector2 {
    return { x: source.x + other.x, y: source.y + other.y };
  }

  subVector2(source: vector2, other: vector2): vector2 {
    return { x: source.x - other.x, y: source.y - other.y };
  }

  mul(source: vector2, scalar: number): vector2 {
    return { x: source.x * scalar, y: source.y * scalar };
  }

  divVector2(source: vector2, other: vector2): vector2 {
    return { x: source.x / other.x, y: source.y / other.y };
  }

  rayVsBox2(ray: ray, box: box2): vector2 | null {
    const d: vector2 = this.subVector2(ray.end, ray.start);

    let near = this.subVector2(box.pos, ray.start);
    near = this.divVector2(near, d);

    const collisionBorderMax = this.addVector2(box.pos, box.size);
    let far = this.subVector2(collisionBorderMax, ray.start);
    far = this.divVector2(far, d);

    if (d.y < 0) [near.y, far.y] = [far.y, near.y];
    if (d.x < 0) [near.x, far.x] = [far.x, near.x];

    if (near.x < far.y && near.y < far.x) {
      let nearT = Math.max(near.x, near.y);

      if (nearT <= 1 && nearT >= 0) {
        const collisionTime = this.mul(d, nearT);
        const collisionPoint = this.addVector2(ray.start, collisionTime);
        return collisionPoint;
      }
    }

    return null;
  }

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = "gray";
    this.strokeBox(this.staticBox);

    if (this.ray.start.x >= 0 && this.ray.start.y >= 0) {
      this.setBoxPosition(this.box, this.ray.start);

      this.ctx.strokeStyle = "lightgray";
      this.strokeBox(this.box);
      this.strokeRay(this.ray);

      const collisionBorder = this.expandBox(this.staticBox, this.box.size);
      const collisionPoint = this.rayVsBox2(this.ray, collisionBorder);
      if (collisionPoint != null) {
        const collisionBox = structuredClone(this.box);
        this.setBoxPosition(collisionBox, collisionPoint);

        this.ctx.strokeStyle = "yellow";
        this.strokeBox(collisionBox);
      }
    }
  }
}
