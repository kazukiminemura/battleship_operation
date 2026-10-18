import { describe, expect, it } from 'vitest'
import { naturalCoastline } from '../../src/game/data/coastlines'
import { createInitialState } from '../../src/game/data/masterdata'
import { stepAircraft } from '../../src/game/simulation/aircraft'
import { isOnLand, stepMovement } from '../../src/game/simulation/movement'
import { stepProjectiles } from '../../src/game/simulation/projectiles'
import { generateAutoFireCommands } from '../../src/game/simulation/player-auto-commands'
import { createRngStreams } from '../../src/game/simulation/random'
import type { AircraftEntity, ShipEntity } from '../../src/game/simulation/types'

describe('airfield sorties and irregular coast', () => {
  it('launches once, climbs, and prevents new sorties from a destroyed base', () => {
    const initial = { ...createInitialState(), tick: 90 }
    const next = stepAircraft(initial)
    const plane = [...next.entities.values()].find(e => e.kind === 'aircraft') as AircraftEntity
    expect(plane.phase).toBe('takeoff')
    expect([...stepAircraft(next).entities.values()].filter(e => e.kind === 'aircraft')).toHaveLength(1)
    expect([...initial.entities.values()].some(e => e.kind === 'aircraft')).toBe(false)
    const climbed = stepAircraft({ ...next, tick: 170 }).entities.get(plane.id) as AircraftEntity
    expect(climbed.pos.z).toBeGreaterThan(0)
    expect(climbed.phase).toBe('attack')
    const entities = new Map(initial.entities)
    for (const [id, e] of entities) if (e.kind === 'building' && e.templateId.includes('airfield')) entities.set(id, { ...e, destroyed: true })
    expect([...stepAircraft({ ...initial, entities }).entities.values()].some(e => e.kind === 'aircraft')).toBe(false)
  })

  it('drops one bomb, returns home, and can be engaged by automatic AA', () => {
    const state = createInitialState()
    const player = state.entities.get('ship.player') as ShipEntity
    const plane: AircraftEntity = { kind: 'aircraft', id: 'plane', homeId: 'base', bornTick: 0, phase: 'attack', team: 'enemy', destroyed: false, hp: 20, maxHp: 20, pos: { x: player.pos.x + 100, y: player.pos.y, z: 150 }, vel: { x: -8, y: 0, z: 0 }, angle: Math.PI }
    const entities = new Map(state.entities)
    entities.set(plane.id, plane)
    entities.set(player.id, { ...player, weapons: [{ id: 'aa', name: 'AA', type: 'aa', autoFire: true, cooldownTick: 0, ammo: 20, maxAmmo: 20, firingArc: { center: 0, width: Math.PI * 2 } }] })
    const flying = { ...state, tick: 100, entities, detectedByPlayer: new Set([plane.id]) }
    expect(generateAutoFireCommands(flying)).toHaveLength(1)
    const bombed = stepAircraft(flying)
    expect((bombed.entities.get(plane.id) as AircraftEntity).phase).toBe('return')
    expect(bombed.entities.has('bomb:plane')).toBe(true)
    const attacked = new Map(flying.entities)
    attacked.set('aa.round', { kind: 'projectile', id: 'aa.round', ownerId: player.id, pos: { x: plane.pos.x - 15, y: plane.pos.y, z: 0 }, vel: { x: 20, y: 0, z: 0 }, weaponType: 'aa', damage: 40, lifetime: 10, initialLifetime: 10, maxHeight: 100, destroyed: false })
    const intercepted = stepProjectiles({ ...flying, entities: attacked }, createRngStreams(1).combat)
    expect((intercepted.entities.get(plane.id) as AircraftEntity).destroyed).toBe(true)
  })

  it('keeps bays navigable and pushes ships out through the polygon shore', () => {
    const island = { id: 'coast', x: 5000, y: 5000, rx: 500, ry: 500 }
    const coast = { ...island, points: naturalCoastline(island, 0) }
    expect(coast.points).toHaveLength(96)
    expect(isOnLand(5000, 5000, [coast])).toBe(true)
    expect(isOnLand(5000, 5400, [coast])).toBe(false)
    const state = createInitialState()
    const ship = state.entities.get('ship.player') as ShipEntity
    const next = stepMovement({ ...state, mapObstacles: [coast], entities: new Map([[ship.id, { ...ship, speed: 0, targetSpeed: 0, pos: { x: 5000, y: 5000, z: 0 } }]]) })
    const pushed = next.entities.get(ship.id) as ShipEntity
    expect(isOnLand(pushed.pos.x, pushed.pos.y, [coast])).toBe(false)
  })
})
