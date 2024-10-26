package game

import (
	"github.com/ellezio/gomber/internal/entity"
)

func CheckCollision(entity *entity.Entity, colliders []*entity.Wall) {
	for _, c := range colliders {
		overlapsX := entity.X < c.X+c.Width && entity.X+entity.Width > c.X &&
			entity.PrevY < c.Y+c.Height && entity.PrevY+entity.Height > c.Y

		if overlapsX {
			dx := entity.X - entity.PrevX
			if dx < 0 {
				entity.X = c.X + c.Width
			} else if dx > 0 {
				entity.X = c.X - entity.Width
			}
		}

		overlapsY := entity.PrevX < c.X+c.Width && entity.PrevX+entity.Width > c.X &&
			entity.Y < c.Y+c.Height && entity.Y+entity.Height > c.Y

		if overlapsY {
			dy := entity.Y - entity.PrevY
			if dy < 0 {
				entity.Y = c.Y + c.Height
			} else if dy > 0 {
				entity.Y = c.Y - entity.Height
			}
		}
	}
}
