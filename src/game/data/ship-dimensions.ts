export const SHIP_DIMS: Record<string, { l: number; w: number; h: number }> = {
  'hull.destroyer.basic':       { l: 145, w: 30, h: 16 },
  'hull.dd.improved':           { l: 155, w: 32, h: 18 },
  'hull.dd.elite':              { l: 165, w: 34, h: 20 },
  'hull.enemy.destroyer.basic': { l: 90,  w: 20, h: 11 },
  'hull.cruiser.player':        { l: 205, w: 48, h: 29 },
  'hull.cl.heavy':              { l: 240, w: 58, h: 34 },
  'hull.ca.elite':              { l: 250, w: 62, h: 36 },
  'hull.cruiser.basic':         { l: 165, w: 36, h: 22 },
  'hull.battleship.basic':      { l: 285, w: 68, h: 42 },
  'hull.bb.fast':               { l: 290, w: 70, h: 42 },
  'hull.bb.super':              { l: 310, w: 82, h: 48 },
  'hull.bb.yukimura':           { l: 278, w: 74, h: 44 },
  'hull.enemy.boss.dreadnought': { l: 340, w: 82, h: 54 },
}

/** Returns ship dimensions scaled by armor grade (armorBonus 0→100 yields +0%→+20% size). */
export function scaledShipDims(templateId: string, armorBonus = 0): { l: number; w: number; h: number } {
  const base = SHIP_DIMS[templateId] ?? { l: 100, w: 22, h: 12 }
  const s = 1 + armorBonus * 0.002
  return { l: base.l * s, w: base.w * s, h: base.h * s }
}

export type ShipShapeClass = 'destroyer' | 'cruiser' | 'battleship' | 'yukimura' | 'boss'

export const SHIP_SHAPES: Record<string, ShipShapeClass> = {
  'hull.destroyer.basic': 'destroyer',
  'hull.dd.improved': 'destroyer',
  'hull.dd.elite': 'destroyer',
  'hull.enemy.destroyer.basic': 'destroyer',
  'hull.cruiser.player': 'cruiser',
  'hull.cl.heavy': 'cruiser',
  'hull.ca.elite': 'cruiser',
  'hull.cruiser.basic': 'cruiser',
  'hull.battleship.basic': 'battleship',
  'hull.bb.fast': 'battleship',
  'hull.bb.super': 'battleship',
  'hull.bb.yukimura': 'yukimura',
  'hull.enemy.boss.dreadnought': 'boss',
}

/** Shared presentation scale and hull proportions used by rendering and contact envelopes. */
export function visualScaleForShip(shape: ShipShapeClass): number {
  if (shape === 'destroyer') return 2.78
  if (shape === 'cruiser') return 2.66
  if (shape === 'boss') return 2.40
  return 2.72
}

export function shipLengthToBeam(shape: ShipShapeClass): number {
  return shape === 'destroyer' ? 10.2 : shape === 'cruiser' ? 9 : 7.3
}
