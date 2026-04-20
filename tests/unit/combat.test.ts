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
