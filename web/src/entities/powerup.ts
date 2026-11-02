import { Game, powerUpInMsg } from "../game";
import { TILE_SIZE } from "../gameMap";
import { Entity, position, size } from "./entity";

const sprite_speed = new Image(TILE_SIZE, TILE_SIZE);
sprite_speed.src = "/power_up_speed.png";

const sprite_bomb = new Image(TILE_SIZE, TILE_SIZE);
sprite_bomb.src = "/power_up_bomb.png";

const sprite_explosion = new Image(TILE_SIZE, TILE_SIZE);
sprite_explosion.src = "/power_up_explosion.png";

const sprite_hp = new Image(TILE_SIZE, TILE_SIZE);
sprite_hp.src = "/power_up_hp.png";

enum PowerUpType {
  Speed = "speed",
  Bomb = "bomb",
  Explosion = "explosion",
  HP = "hp",
}

export class PowerUp extends Entity {
  constructor(
    game: Game,
    id: number,
    position: position,
    size: size,
    active: boolean,
    private type: PowerUpType,
  ) {
    super(game, id, position, size, "", active);
  }

  static fromMessage(msg: powerUpInMsg, game: Game) {
    const p = new PowerUp(
      game,
      msg.id,
      msg.pos,
      { width: msg.aabb.max.x, height: msg.aabb.max.y },
      msg.active,
      msg.type as PowerUpType,
    );

    return p;
  }

  render(ctx: CanvasRenderingContext2D, _scale: number) {
    if (!this.active) return;

    let sprite;
    switch (this.type) {
      case PowerUpType.Speed:
        sprite = sprite_speed;
        break;

      case PowerUpType.Bomb:
        sprite = sprite_bomb;
        break;

      case PowerUpType.Explosion:
        sprite = sprite_explosion;
        break;

      case PowerUpType.HP:
        sprite = sprite_hp;
        break;
    }

    ctx.drawImage(
      sprite,
      Math.floor(this.position.x / TILE_SIZE) * TILE_SIZE,
      Math.floor(this.position.y / TILE_SIZE) * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
}
