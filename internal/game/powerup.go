package game

import "github.com/ellezio/gomber/internal/math2"

func newPowerUp(pos math2.Vector2) *PowerUp {
	return &PowerUp{
		Entity: Entity{
			Id:       0,
			Tag:      "powerup",
			Pos:      pos,
			Velocity: *math2.NewZeroVector2(),
			AABB:     *math2.NewBox2(math2.NewZeroVector2(), math2.NewVector2(TileSize/2, TileSize/2)),
			Active:   true,
		},
	}
}

func NewSpeedPowerUp(pos math2.Vector2) *PowerUp {
	pu := newPowerUp(pos)
	pu.collect = func(player *Player) {
		player.Speed *= 1.15
	}
	return pu
}

func NewBombCapPowerUp(pos math2.Vector2) *PowerUp {
	pu := newPowerUp(pos)
	pu.collect = func(player *Player) {
		player.MaxBombs += 1
		player.AvailableBombs += 1
	}
	return pu
}

func NewExplosionRangePowerUp(pos math2.Vector2) *PowerUp {
	pu := newPowerUp(pos)
	pu.collect = func(player *Player) {
		player.explosionRange += 1
	}
	return pu
}

func NewHpPowerUp(pos math2.Vector2) *PowerUp {
	pu := newPowerUp(pos)
	pu.collect = func(player *Player) {
		player.HP += 1
	}
	return pu
}

type PowerUp struct {
	Entity
	collect func(player *Player)
}

func (pu *PowerUp) OnCollision(player *Player) {
	pu.collect(player)
	pu.game.Destruct(&pu.Entity)
}
