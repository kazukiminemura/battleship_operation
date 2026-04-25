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

  it.each([
    ['torpedo', 'weapon.torpedo.533mm.basic'],
    ['missile', 'weapon.missile.antiship.dd'],
    ['missile', 'weapon.rocket.enemy.salvo'],
    ['missile', 'weapon.mine.floating'],
  ] as const)('lets machine guns destroy %s threats', (weaponType, weaponId) => {
    const state = createInitialState()
    const entities = new Map(state.entities)
    const enemy = entities.get('ship.enemy.destroyer.01') as ShipEntity

    const aaProjectile: ProjectileEntity = {
      kind: 'projectile',
      id: 'proj.player.aa.intercept',
      pos: { x: 970, y: 1000, z: 0 },
      vel: { x: 70, y: 0, z: 0 },
      ownerId: 'ship.player',
      weaponId: 'weapon.aa.20mm.dd',
      weaponType: 'aa',
      damage: 8,
      lifetime: 4,
      initialLifetime: 4,
      maxHeight: 95,
      destroyed: false,
    }
    const threat: ProjectileEntity = {
      kind: 'projectile',
      id: `proj.enemy.${weaponId}`,
      pos: { x: 1000, y: 1000, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      ownerId: enemy.id,
      weaponId,
      weaponType,
      damage: 80,
      lifetime: 50,
      initialLifetime: 50,
      maxHeight: weaponType === 'torpedo' ? 0 : 200,
      destroyed: false,
    }

    entities.set(threat.id, threat)
    entities.set(aaProjectile.id, aaProjectile)

    const next = stepProjectiles({ ...state, entities, eventLog: [] }, createRngStreams(12345).combat)
    const updatedThreat = next.entities.get(threat.id) as ProjectileEntity
    const updatedAa = next.entities.get(aaProjectile.id) as ProjectileEntity

    expect(updatedThreat.destroyed).toBe(true)
    expect(updatedAa.destroyed).toBe(true)
    expect(next.eventLog.some(e => e.type === 'weapon.hit' && e.targetId === threat.id)).toBe(true)
  })
})
