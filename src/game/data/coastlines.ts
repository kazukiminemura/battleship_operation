import type { MapObstacle } from '../simulation/types'

// Original fictional coast profiles: long capes, deep bays, and uneven headlands.
const PROFILES = [
  [1, .96, .78, .43, .32, .63, .91, .88, 1, .71, .35, .28, .57, .93, .87, .96],
  [.82, 1, .9, .72, .43, .29, .55, .85, .97, .83, .69, .38, .31, .65, .92, .85],
  [.95, .88, .59, .27, .39, .77, .98, .9, .72, .49, .3, .65, .92, .81, .62, .91],
]

export function naturalCoastline(obstacle: MapObstacle, variant: number): { x: number; y: number }[] {
  const profile = PROFILES[Math.abs(variant) % PROFILES.length]!
  return Array.from({ length: 96 }, (_, i) => {
    const sample = i / 96 * profile.length
    const j = Math.floor(sample), t = sample - j
    const eased = t * t * (3 - 2 * t)
    const r = profile[j]! * (1 - eased) + profile[(j + 1) % profile.length]! * eased
    const angle = i * Math.PI / 48
    const detail = 1 + .035 * Math.sin(angle * 13 + variant) + .018 * Math.cos(angle * 23 - variant)
    return {
      x: obstacle.x + Math.cos(angle) * obstacle.rx * r * detail,
      y: obstacle.y + Math.sin(angle) * obstacle.ry * r * detail,
    }
  })
}

export function pointInCoast(x: number, y: number, points: readonly { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j]!, b = points[i]!
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
