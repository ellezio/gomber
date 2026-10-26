import type { Entity, position } from "./entities/entity";
import type { Player } from "./entities/player";
import { TILE_SIZE, type GameMap } from "./gameMap";

const COLLISION_MARGIN = 0.1;

type Obstacle = Pick<Entity, "position" | "size">;
type Contact = { time: number; normal: position };

export function entityVsEntities(entity: Entity, colliders: Entity[]): void {
  if (!entity.active) return;

  for (const collider of colliders) {
    if (!collider.active) continue;

    if (
      !(
        entity.position.x >= collider.position.x + collider.size.width ||
        entity.position.x + entity.size.width <= collider.position.x ||
        entity.position.y >= collider.position.y + collider.size.height ||
        entity.position.y + entity.size.height <= collider.position.y
      )
    ) {
      entity.onCollision(collider);
    }
  }
}

function sweepPlayer(
  player: Player,
  velocity: position,
  obstacle: Obstacle,
): Contact | null {
  const halfWidth = player.size.width / 2;
  const halfHeight = player.size.height / 2;
  const originX = player.prevPosition.x + halfWidth;
  const originY = player.prevPosition.y + halfHeight;

  let nearX = (obstacle.position.x - halfWidth - originX) / velocity.x;
  let nearY = (obstacle.position.y - halfHeight - originY) / velocity.y;
  let farX =
    (obstacle.position.x + obstacle.size.width + halfWidth - originX) /
    velocity.x;
  let farY =
    (obstacle.position.y + obstacle.size.height + halfHeight - originY) /
    velocity.y;

  if ([nearX, nearY, farX, farY].some(Number.isNaN)) return null;

  if (velocity.x < 0) [nearX, farX] = [farX, nearX];
  if (velocity.y < 0) [nearY, farY] = [farY, nearY];

  if (nearX > farY || nearY > farX) return null;

  const time = Math.max(nearX, nearY);
  if (time >= 1 || time <= 0) return null;

  const normal = { x: 0, y: 0 };
  if (nearX >= nearY) {
    normal.x = velocity.x < 0 ? 1 : -1;
  } else if (nearY >= nearX) {
    normal.y = velocity.y < 0 ? 1 : -1;
  }

  return { time, normal };
}

export function checkPlayerCollision(
  player: Player,
  gameMap: GameMap,
  colliders: Entity[],
): void {
  if (!player.active) return;

  const velocity = {
    x: player.position.x - player.prevPosition.x,
    y: player.position.y - player.prevPosition.y,
  };
  if (velocity.x === 0 && velocity.y === 0) return;

  // Check collision 2 tiems, because after first correction
  // player may have other collision
  for (let pass = 0; pass < 2; pass++) {
    const startingVelocity = { ...velocity };
    const start = player.prevPosition;
    const endX = start.x + velocity.x;
    const endY = start.y + velocity.y;
    const minCol = Math.trunc(Math.min(start.x, endX) / TILE_SIZE);
    const minRow = Math.trunc(Math.min(start.y, endY) / TILE_SIZE);
    const maxCol = Math.trunc(
      (Math.max(start.x, endX) + player.size.width) / TILE_SIZE,
    );
    const maxRow = Math.trunc(
      (Math.max(start.y, endY) + player.size.height) / TILE_SIZE,
    );
    const collisions: { time: number; obstacle: Obstacle }[] = [];

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (
          row < 0 ||
          row >= gameMap.grid.length ||
          col < 0 ||
          col >= gameMap.grid[row].length
        ) {
          continue;
        }

        if (gameMap.grid[row][col] !== 0) {
          const obstacle: Obstacle = {
            position: { x: col * TILE_SIZE, y: row * TILE_SIZE },
            size: { width: TILE_SIZE, height: TILE_SIZE },
          };

          const contact = sweepPlayer(player, velocity, obstacle);
          if (contact) collisions.push({ time: contact.time, obstacle });
        }
      }
    }

    for (const collider of colliders) {
      const contact = sweepPlayer(player, velocity, collider);
      if (contact) collisions.push({ time: contact.time, obstacle: collider });
    }

    collisions.sort((a, b) => a.time - b.time);

    for (const { obstacle } of collisions) {
      const contact = sweepPlayer(player, velocity, obstacle);
      if (!contact) continue;

      if (contact.normal.x !== 0) {
        velocity.x =
          velocity.x * contact.time + contact.normal.x * COLLISION_MARGIN;
      }
      if (contact.normal.y !== 0) {
        velocity.y =
          velocity.y * contact.time + contact.normal.y * COLLISION_MARGIN;
      }
    }

    // If there isn't any collision then there is no need for second pass
    if (
      velocity.x === startingVelocity.x &&
      velocity.y === startingVelocity.y
    ) {
      break;
    }
  }

  player.position.x = player.prevPosition.x + velocity.x;
  player.position.y = player.prevPosition.y + velocity.y;
}
