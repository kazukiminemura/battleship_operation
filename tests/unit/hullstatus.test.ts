import { describe, expect, it } from 'vitest'
import { durabilityColor, estimateHullSections } from '../../src/game/ui/hullstatus'
import type { ShipEntity } from '../../src/game/simulation/types'

function makeShip(hp: number, maxHp = 100): ShipEntity {
  return {
    kind: 'ship',
    id: 'ship.test',
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    angle: 0,
    hp,
    maxHp,
    speed: 0,
    targetSpeed: 0,
    speedLevel: 'stop',
    maxSpeed: 1,
    turnRate: 0.01,
    weapons: [],
    team: 'player',
    destroyed: false,
    templateId: 'hull.test',
    detectionRange: 2200,
  }
}

describe('estimateHullSections', () => {
  it('keeps section ratios inside display bounds', () => {
    const sections = estimateHullSections(makeShip(25))

    for (const ratio of Object.values(sections)) {
      expect(ratio).toBeGreaterThanOrEqual(0)
      expect(ratio).toBeLessThanOrEqual(1)
    }
  })

  it('increases section durability as total HP increases', () => {
    const damaged = estimateHullSections(makeShip(30))
    const healthy = estimateHullSections(makeShip(90))

    expect(healthy.bow).toBeGreaterThan(damaged.bow)
    expect(healthy.stern).toBeGreaterThan(damaged.stern)
    expect(healthy.superstructure).toBeGreaterThan(damaged.superstructure)
    expect(healthy.deck).toBeGreaterThan(damaged.deck)
  })
})

describe('durabilityColor', () => {
  it('maps durability to status colors', () => {
    expect(durabilityColor(0.8)).toBe('#22c55e')
    expect(durabilityColor(0.4)).toBe('#eab308')
    expect(durabilityColor(0.1)).toBe('#ef4444')
  })
})
