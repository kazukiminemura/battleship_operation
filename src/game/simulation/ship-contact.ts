import { scaledShipDims, SHIP_SHAPES, shipLengthToBeam, visualScaleForShip } from '../data/ship-dimensions'
import type { ShipEntity } from './types'

export function shipContactDimensions(ship: ShipEntity): { length: number; beam: number } {
  const shape = SHIP_SHAPES[ship.templateId] ?? 'destroyer'
  const length = scaledShipDims(ship.templateId, ship.armorBonus).l * visualScaleForShip(shape) * (0.045 / 0.04725)
  return { length, beam: length / shipLengthToBeam(shape) }
}

/** Minimum translation between the two oriented hull envelopes, or no contact. */
export function shipContact(a: ShipEntity, b: ShipEntity): { nx: number; ny: number; overlap: number } | undefined {
  const ad = shipContactDimensions(a), bd = shipContactDimensions(b)
  const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y
  const broadRadius = (Math.hypot(ad.length, ad.beam) + Math.hypot(bd.length, bd.beam)) / 2
  if (Math.abs(dx) > broadRadius || Math.abs(dy) > broadRadius) return
  const ax = Math.cos(a.angle), ay = Math.sin(a.angle)
  const bx = Math.cos(b.angle), by = Math.sin(b.angle)
  let overlap = Infinity, nx = 1, ny = 0
  for (const [x, y] of [[ax, ay], [-ay, ax], [bx, by], [-by, bx]]) {
    const rx = x!, ry = y!
    const ar = Math.abs(rx * ax + ry * ay) * ad.length / 2 + Math.abs(-rx * ay + ry * ax) * ad.beam / 2
    const br = Math.abs(rx * bx + ry * by) * bd.length / 2 + Math.abs(-rx * by + ry * bx) * bd.beam / 2
    const distance = dx * rx + dy * ry
    const penetration = ar + br - Math.abs(distance)
    if (penetration <= 0.001) return
    if (penetration < overlap) { overlap = penetration; const sign = distance < 0 ? -1 : 1; nx = rx * sign; ny = ry * sign }
  }
  return { nx, ny, overlap }
}
