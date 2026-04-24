import { describe, it, expect } from 'vitest'
import { applyDamage, checkDestroyed } from '../../src/game/simulation/damage'
import type { ShipEntity } from '../../src/game/simulation/types'

function makeShip(hp: number, maxHp: number): ShipEntity {
  return {
    kind: 'ship',
    id: 'test.ship',
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    angle: 0,
    hp,
    maxHp,
    speed: 0, targetSpeed: 0, speedLevel: 'stop' as const,
    maxSpeed: 3, turnRate: 0.04,
    armor: 0,
    weapons: [],
    team: 'player',
    destroyed: false,
    templateId: 'hull.destroyer.basic',
    detectionRange: 2200,
  }
}

describe('applyDamage', () => {
  it('reduces hp by amount', () => {
    const ship = makeShip(100, 100)
    const result = applyDamage(ship, 30)
    expect(result.hp).toBe(70)
  })

  it('clamps hp to 0 (never negative)', () => {
    const ship = makeShip(10, 100)
    const result = applyDamage(ship, 999)
    expect(result.hp).toBe(0)
  })

  it('clamps hp to maxHp (never exceeds max)', () => {
    const ship = makeShip(80, 100)
    // negative damage (healing) should not exceed maxHp
    const result = applyDamage(ship, -50)
    expect(result.hp).toBe(100)
  })

  it('does not mutate the original ship', () => {
    const ship = makeShip(100, 100)
    applyDamage(ship, 50)
    expect(ship.hp).toBe(100)
  })
})

describe('checkDestroyed', () => {
  it('sets destroyed=true when hp is 0', () => {
    const ship = makeShip(0, 100)
    const result = checkDestroyed(ship)
    expect(result.destroyed).toBe(true)
  })

  it('does not set destroyed when hp > 0', () => {
    const ship = makeShip(1, 100)
    const result = checkDestroyed(ship)
    expect(result.destroyed).toBe(false)
  })

  it('does not mutate already-destroyed flag', () => {
    const ship = { ...makeShip(0, 100), destroyed: true }
    const result = checkDestroyed(ship)
    expect(result.destroyed).toBe(true)
  })
})
