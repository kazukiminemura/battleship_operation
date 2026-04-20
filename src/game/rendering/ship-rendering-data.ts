export const SHIP_DIMS: Record<string, { l: number; w: number; h: number }> = {
  'hull.destroyer.basic':       { l: 145, w: 30, h: 16 },
  'hull.enemy.destroyer.basic': { l: 90,  w: 20, h: 11 },
  'hull.cruiser.basic':         { l: 165, w: 36, h: 22 },
  'hull.cruiser.player':        { l: 205, w: 48, h: 29 },
  'hull.battleship.basic':      { l: 285, w: 68, h: 42 },
  'hull.enemy.boss.dreadnought': { l: 340, w: 82, h: 54 },
}

export type ShipShapeClass = 'destroyer' | 'cruiser' | 'battleship' | 'boss'

export const SHIP_SHAPES: Record<string, ShipShapeClass> = {
  'hull.destroyer.basic': 'destroyer',
  'hull.enemy.destroyer.basic': 'destroyer',
  'hull.cruiser.basic': 'cruiser',
  'hull.cruiser.player': 'cruiser',
  'hull.battleship.basic': 'battleship',
  'hull.enemy.boss.dreadnought': 'boss',
}
