import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/game/data/masterdata'
import { stepAircraft } from '../../src/game/simulation/aircraft'
import { stepProjectiles } from '../../src/game/simulation/projectiles'
import { stepDetection } from '../../src/game/simulation/detection'
import { createRngStreams } from '../../src/game/simulation/random'
import type { AircraftEntity, ShipEntity } from '../../src/game/simulation/types'

function hitPlane(damage: number) {
  const state = createInitialState()
  const player = state.entities.get('ship.player') as ShipEntity
  const plane: AircraftEntity = {
    kind: 'aircraft', id: 'plane', homeId: 'base', bornTick: 0, phase: 'attack',
    team: 'enemy', destroyed: false, hp: 28, maxHp: 28,
    pos: { x: player.pos.x + 100, y: player.pos.y, z: 150 }, vel: { x: 8, y: 0, z: 0 }, angle: 0,
  }
  const entities = new Map(state.entities)
  entities.set(plane.id, plane)
  entities.set('aa.round', {
    kind: 'projectile', id: 'aa.round', ownerId: player.id,
    pos: { x: plane.pos.x - 15, y: plane.pos.y, z: 150 }, vel: { x: 20, y: 0, z: 0 },
    weaponType: 'aa', damage, lifetime: 10, initialLifetime: 10, maxHeight: 100, destroyed: false,
  })
  const before = { ...state, tick: 101, entities }
  return { before, after: stepProjectiles(before, createRngStreams(1).combat) }
}

describe('damaged aircraft lifecycle', () => {
  it('preserves HP on a surviving hit and starts an untargetable descent on a lethal hit', () => {
    const damaged = hitPlane(5).after.entities.get('plane') as AircraftEntity
    expect(damaged.hp).toBe(23)
    expect(damaged.destroyed).toBe(false)
    expect(damaged.phase).toBe('attack')
    const { before, after } = hitPlane(40)
    const falling = after.entities.get('plane') as AircraftEntity
    expect(falling).toMatchObject({ hp: 0, destroyed: true, phase: 'crashing', crashTick: 101 })
    expect(falling.vel.z).toBeLessThan(0)
    expect((before.entities.get('plane') as AircraftEntity).hp).toBe(28)
    expect(stepDetection(after).detectedByPlayer.has('plane')).toBe(true)
    expect(after.eventLog.filter(e => e.type === 'entity.destroyed' && e.targetId === 'plane')).toHaveLength(1)
  })

  it.each([false, true])('falls without bombing, impacts %s land, then expires once', onLand => {
    const { after } = hitPlane(40)
    const original = after.entities.get('plane') as AircraftEntity
    let state = { ...after, mapObstacles: onLand ? [{ id: 'land', x: original.pos.x, y: original.pos.y, rx: 1000, ry: 1000 }] : [] }
    let previousHeight = original.pos.z
    let impact: AircraftEntity | undefined
    for (let i = 0; i < 120; i++) {
      state = stepAircraft({ ...state, tick: state.tick + 1 })
      const plane = state.entities.get('plane') as AircraftEntity | undefined
      expect(state.entities.has('bomb:plane')).toBe(false)
      if (!plane) break
      expect(plane.pos.z).toBeLessThanOrEqual(previousHeight)
      expect(plane.pos.z).toBeGreaterThanOrEqual(0)
      previousHeight = plane.pos.z
      if (plane.phase === 'crashed') impact ??= plane
    }
    expect(impact).toMatchObject({ phase: 'crashed', impactOnLand: onLand, pos: { z: 0 }, vel: { x: 0, y: 0, z: 0 } })
    expect(impact!.pos.x).not.toBe(original.pos.x)
    expect(state.entities.has('plane')).toBe(false)
    expect((after.entities.get('plane') as AircraftEntity).pos.z).toBe(150)
  })
})
