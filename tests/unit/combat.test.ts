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
      e.weaponId === 'weapon.gun.127mm.single'
    )).toBe(true)
  })
})
