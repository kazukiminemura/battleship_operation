import { describe, expect, it } from 'vitest'
import { createInitialState, STATIC_DATA } from '../../src/game/data/masterdata'
import { combatStep } from '../../src/game/simulation/combat'
import { createRngStreams } from '../../src/game/simulation/random'
import type { ShipEntity } from '../../src/game/simulation/types'

describe('combatStep', () => {
  it('auto-fires at destructible buildings when no enemy ship is nearer', () => {
    const state = createInitialState()
    const entities = new Map(state.entities)

    for (const [id, entity] of entities) {
      if (entity.kind === 'ship' && entity.team === 'enemy') entities.delete(id)
    }

    const player = entities.get('ship.player') as ShipEntity
    entities.set('ship.player', {
      ...player,
      pos: { x: 5000, y: 6100, z: 0 },
      weapons: player.weapons.map(w => w.type === 'gun' ? { ...w, autoFire: true } : w),
    })

    const next = combatStep({ ...state, entities }, [], createRngStreams(12345), STATIC_DATA)

    expect(next.eventLog.some(e =>
      e.type === 'weapon.fired' &&
      e.sourceId === 'ship.player' &&
      e.weaponId === 'weapon.gun.127mm.twin'
    )).toBe(true)
  })

  it('fires the selected weapon slot', () => {
    const state = createInitialState('cruiser')
    const player = state.entities.get('ship.player') as ShipEntity
    const secondary = player.weapons[1]!

    const next = combatStep(
      state,
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 1,
        target: { x: player.pos.x, y: player.pos.y - 400, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    expect(next.eventLog.some(e =>
      e.type === 'weapon.fired' &&
      e.sourceId === 'ship.player' &&
      e.weaponId === secondary.id
    )).toBe(true)
  })

  it('spawns one projectile per configured barrel', () => {
    const state = createInitialState(
      'cruiser',
      1,
      [{ id: 'weapon.gun.152mm.twin', name: '四連装テスト砲', type: 'gun', ammo: 20, barrels: 4, mount: { x: 0, y: 0.4 } }],
      'hull.cruiser.player',
    )
    const player = state.entities.get('ship.player') as ShipEntity

    const next = combatStep(
      state,
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 0,
        target: { x: player.pos.x, y: player.pos.y - 500, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const projectiles = [...next.entities.values()].filter((e): e is Extract<typeof e, { kind: 'projectile' }> =>
      e.kind === 'projectile' &&
      e.ownerId === 'ship.player' &&
      e.weaponId === 'weapon.gun.152mm.twin'
    )
    const fired = next.eventLog.find(e => e.type === 'weapon.fired' && e.weaponId === 'weapon.gun.152mm.twin')
    const updatedPlayer = next.entities.get('ship.player') as ShipEntity
    expect(projectiles).toHaveLength(4)
    expect(fired?.salvoCount).toBe(4)
    expect(fired?.muzzlePositions).toHaveLength(4)
    expect(updatedPlayer.weapons[0]!.ammo).toBe(16)
    expect(next.metrics.playerAmmoSpent).toBe(4)
    expect(next.metrics.shotCountByWeapon['weapon.gun.152mm.twin']).toBe(4)

    const xPositions = projectiles.map(p => p.pos.x)
    expect(Math.max(...xPositions) - Math.min(...xPositions)).toBeGreaterThan(14)
  })

  it('fires only remaining ammo when a multi-barrel weapon is almost empty', () => {
    const state = createInitialState(
      'cruiser',
      1,
      [{ id: 'weapon.gun.152mm.twin', name: '四連装テスト砲', type: 'gun', ammo: 2, barrels: 4, mount: { x: 0, y: 0.4 } }],
      'hull.cruiser.player',
    )
    const player = state.entities.get('ship.player') as ShipEntity

    const next = combatStep(
      state,
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 0,
        target: { x: player.pos.x, y: player.pos.y - 500, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const projectiles = [...next.entities.values()].filter(e =>
      e.kind === 'projectile' &&
      e.ownerId === 'ship.player' &&
      e.weaponId === 'weapon.gun.152mm.twin'
    )
    const updatedPlayer = next.entities.get('ship.player') as ShipEntity
    expect(projectiles).toHaveLength(2)
    expect(updatedPlayer.weapons[0]!.ammo).toBe(0)
  })

  it('uses barrel count for torpedo salvos and ammo consumption', () => {
    const state = createInitialState(
      'destroyer',
      1,
      [{ id: 'weapon.torpedo.533mm.basic', name: '三連装魚雷', type: 'torpedo', ammo: 9, barrels: 3, mount: { x: 0, y: 0.2 } }],
      'hull.destroyer.basic',
    )
    const player = state.entities.get('ship.player') as ShipEntity

    const next = combatStep(
      state,
      [{ tick: 0, actorId: 'ship.player', type: 'fire.slot', value: 0, target: { x: player.pos.x, y: player.pos.y - 500, z: 0 } }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const projectiles = [...next.entities.values()].filter((e): e is Extract<typeof e, { kind: 'projectile' }> =>
      e.kind === 'projectile' &&
      e.ownerId === 'ship.player' &&
      e.weaponId === 'weapon.torpedo.533mm.basic'
    )
    const updatedPlayer = next.entities.get('ship.player') as ShipEntity
    expect(projectiles).toHaveLength(3)
    expect(updatedPlayer.weapons[0]!.ammo).toBe(6)

    const angles = projectiles.map(p => Math.atan2(p.vel.y, p.vel.x))
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(0.12)
  })

  it('uses barrel count for machine gun salvos and ammo consumption', () => {
    const state = createInitialState(
      'destroyer',
      1,
      [{ id: 'weapon.aa.20mm.dd', name: '四連装機銃', type: 'aa', ammo: 12, barrels: 4, mount: { x: 0, y: 0.2 } }],
      'hull.destroyer.basic',
    )
    const player = state.entities.get('ship.player') as ShipEntity

    const next = combatStep(
      state,
      [{ tick: 0, actorId: 'ship.player', type: 'fire.slot', value: 0, target: { x: player.pos.x, y: player.pos.y - 450, z: 0 } }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const projectiles = [...next.entities.values()].filter((e): e is Extract<typeof e, { kind: 'projectile' }> =>
      e.kind === 'projectile' &&
      e.ownerId === 'ship.player' &&
      e.weaponId === 'weapon.aa.20mm.dd'
    )
    const updatedPlayer = next.entities.get('ship.player') as ShipEntity
    expect(projectiles).toHaveLength(4)
    expect(updatedPlayer.weapons[0]!.ammo).toBe(8)
  })

  it('lets battleship main guns fire beyond standard gun range', () => {
    const state = createInitialState('battleship')
    const player = state.entities.get('ship.player') as ShipEntity
    const mainGun = player.weapons[0]!

    const next = combatStep(
      state,
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 0,
        target: { x: player.pos.x, y: player.pos.y - 1800, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    expect(next.eventLog.some(e =>
      e.type === 'weapon.fired' &&
      e.sourceId === 'ship.player' &&
      e.weaponId === mainGun.id
    )).toBe(true)
  })

  it('spawns fire events from the selected weapon mount', () => {
    const state = createInitialState('cruiser')
    const player = state.entities.get('ship.player') as ShipEntity

    const next = combatStep(
      state,
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 0,
        target: { x: player.pos.x, y: player.pos.y - 500, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const fired = next.eventLog.find(e => e.type === 'weapon.fired' && e.sourceId === 'ship.player')
    expect(fired?.position?.y).toBeLessThan(player.pos.y)
    expect(fired?.position).not.toEqual(player.pos)
    expect(fired?.targetPosition).toEqual({ x: player.pos.x, y: player.pos.y - 500, z: 0 })
  })

  it('uses custom design mount positions for player weapon fire', () => {
    const state = createInitialState(
      'cruiser',
      1,
      [{ id: 'weapon.gun.152mm.twin.forward', name: '15.2cm移設砲', type: 'gun', ammo: 20, mount: { x: 0, y: 1 } }],
      'hull.cruiser.player',
    )
    const player = state.entities.get('ship.player') as ShipEntity

    const next = combatStep(
      state,
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 0,
        target: { x: player.pos.x, y: player.pos.y - 500, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const fired = next.eventLog.find(e => e.type === 'weapon.fired' && e.sourceId === 'ship.player')
    expect(fired?.position?.y).toBeGreaterThan(player.pos.y)
  })

  it('blocks port and starboard secondary guns outside their side arcs', () => {
    const state = createInitialState('battleship')
    const entities = new Map(state.entities)
    const player = entities.get('ship.player') as ShipEntity
    const weapons = player.weapons.map(w => ({ ...w, autoFire: false }))

    entities.set('ship.player', {
      ...player,
      angle: 0,
      weapons,
    })

    const next = combatStep(
      { ...state, entities },
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 3,
        target: { x: player.pos.x, y: player.pos.y + 700, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    const portGun = weapons[3]!
    const updatedPlayer = next.entities.get('ship.player') as ShipEntity
    expect(next.eventLog.some(e => e.type === 'weapon.fired' && e.weaponId === portGun.id)).toBe(false)
    expect(updatedPlayer.weapons[3]!.ammo).toBe(portGun.ammo)
  })

  it('lets side secondary guns fire into their allowed side arc', () => {
    const state = createInitialState('battleship')
    const entities = new Map(state.entities)
    const player = entities.get('ship.player') as ShipEntity
    const weapons = player.weapons.map(w => ({ ...w, autoFire: false }))

    entities.set('ship.player', {
      ...player,
      angle: 0,
      weapons,
    })

    const next = combatStep(
      { ...state, entities },
      [{
        tick: 0,
        actorId: 'ship.player',
        type: 'fire.slot',
        value: 3,
        target: { x: player.pos.x, y: player.pos.y - 700, z: 0 },
      }],
      createRngStreams(12345),
      STATIC_DATA,
    )

    expect(next.eventLog.some(e =>
      e.type === 'weapon.fired' &&
      e.sourceId === 'ship.player' &&
      e.weaponId === weapons[3]!.id
    )).toBe(true)
  })

  it('auto-fires starboard secondary guns through their own slot', () => {
    const state = createInitialState('battleship')
    const entities = new Map(state.entities)
    const player = entities.get('ship.player') as ShipEntity
    const weapons = player.weapons.map((w, i) => ({ ...w, autoFire: i === 4 }))
    const enemy = entities.get('ship.enemy.destroyer.01') as ShipEntity

    for (const [id, entity] of entities) {
      if (id !== 'ship.player' && id !== 'ship.enemy.destroyer.01') entities.delete(id)
      if (entity.kind === 'building') entities.delete(id)
    }

    entities.set('ship.player', {
      ...player,
      angle: 0,
      weapons,
    })
    entities.set('ship.enemy.destroyer.01', {
      ...enemy,
      pos: { x: player.pos.x, y: player.pos.y + 700, z: 0 },
    })

    const next = combatStep({ ...state, entities }, [], createRngStreams(12345), STATIC_DATA)

    expect(next.eventLog.some(e =>
      e.type === 'weapon.fired' &&
      e.sourceId === 'ship.player' &&
      e.weaponId === weapons[4]!.id
    )).toBe(true)
  })
})
