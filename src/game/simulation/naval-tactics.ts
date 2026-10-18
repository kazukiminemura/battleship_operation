import type { ShipEntity, Vec3 } from './types'

/** Approach at long range, circle at gunnery range and disengage when too close.
 * The per-ship orbit direction is stable, so opponents approach from both flanks
 * without introducing random decisions into movement.
 */
export function planGunRun(ship: Pick<ShipEntity, 'id' | 'pos' | 'angle' | 'maxSpeed'>, target: Vec3, preferredRange: number): { heading: number; speed: number } {
  const dx = target.x - ship.pos.x, dy = target.y - ship.pos.y
  const distance = Math.hypot(dx, dy)
  const bearing = distance > 0 ? Math.atan2(dy, dx) : ship.angle
  const radial = Math.max(-1, Math.min(1, (distance - preferredRange) / Math.max(1, preferredRange * .5)))
  const parity = [...ship.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2
  const tangent = Math.sqrt(1 - radial * radial) * (parity === 0 ? 1 : -1)
  return {
    heading: bearing + Math.atan2(tangent, radial),
    speed: ship.maxSpeed * (distance > preferredRange * 1.5 ? 1 : .72),
  }
}
