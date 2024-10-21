import { Entity } from "../entity";

export class CollisionComponent {
  constructor(private parent: Entity) {}

  check(entity: Entity) {
    if (
      this.parent.position.x < entity.position.x + entity.size.width &&
      this.parent.position.x + this.parent.size.width > entity.position.x &&
      this.parent.position.y < entity.position.y + entity.size.height &&
      this.parent.position.y + this.parent.size.height > entity.position.y
    ) {
      if (
        this.parent.prevPosition.y < entity.position.y + entity.size.height &&
        this.parent.prevPosition.y + this.parent.size.height > entity.position.y
      ) {
        if (this.parent.prevPosition.x - this.parent.position.x < 0) {
          this.parent.position.x = entity.position.x - this.parent.size.width;
        } else if (this.parent.prevPosition.x - this.parent.position.x > 0) {
          this.parent.position.x = entity.position.x + entity.size.width;
        }
      }

      if (
        this.parent.prevPosition.x < entity.position.x + entity.size.width &&
        this.parent.prevPosition.x + this.parent.size.width > entity.position.x
      ) {
        if (this.parent.prevPosition.y - this.parent.position.y < 0) {
          this.parent.position.y = entity.position.y - this.parent.size.height;
        } else if (this.parent.prevPosition.y - this.parent.position.y > 0) {
          this.parent.position.y = entity.position.y + entity.size.height;
        }
      }

      return true;
    }
  }
}
