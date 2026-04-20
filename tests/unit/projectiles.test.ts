import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/game/data/masterdata'
import { stepProjectiles } from '../../src/game/simulation/projectiles'
import { createRngStreams } from '../../src/game/simulation/random'
import type { ProjectileEntity, ShipEntity } from '../../src/game/simulation/types'

describe('stepProjectiles', () => {
  it('checks hits along the projectile path before lifetime miss effects', () => {
    const state = createInitialState()
    const entities = new Map(state.entities)
    const enemy = entities.get('ship.enemy.destroyer.01') as ShipEntity

    const projectile: ProjectileEntity = {
      kind: 'projectile',
      id: 'proj.test.swept',
      pos: { x: enemy.pos.x - 30, y: enemy.pos.y, z: 0 },
      vel: { x: 60, y: 0, z: 0 },
      ownerId: 'ship.player',
      weaponId: 'weapon.gun.127mm.twin',
      weaponType: 'gun',
      damage: 10,
      lifetime: 1,
      initialLifetime: 1,
      maxHeight: 100,
      destroyed: false,
    }

    entities.set(projectile.id, projectile)

    const next = stepProjectiles({ ...state, entities, eventLog: [] }, createRngStreams(12345).combat)

    expect(next.eventLog.some(e => e.type === 'weapon.hit' && e.targetId === enemy.id)).toBe(true)
    expect(next.eventLog.some(e => e.type === 'weapon.missed' && e.sourceId === 'ship.player')).toBe(false)
  })
})
