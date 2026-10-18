import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/game/data/masterdata'
import { isShip, type ShipEntity } from '../../src/game/simulation/types'
import { propulsionMix } from '../../src/game/audio/naval-ambience'
import { CombatMusicDirector } from '../../src/game/audio/combat-music'

function player() { return createInitialState('destroyer', 1).entities.get('ship.player') as ShipEntity }

describe('naval propulsion sound', () => {
  it('raises engine pitch and bow wash with actual speed, including astern', () => {
    const ship = player()
    const idle = propulsionMix({ ...ship, speed: 0, targetSpeed: 0 }, 'clear')
    const ahead = propulsionMix({ ...ship, speed: ship.maxSpeed }, 'clear')
    const astern = propulsionMix({ ...ship, speed: -ship.maxSpeed }, 'clear')
    expect(ahead.engineHz).toBeGreaterThan(idle.engineHz)
    expect(idle.washGain).toBe(0)
    expect(ahead.washGain).toBeGreaterThan(idle.washGain)
    expect(astern.washGain).toBe(ahead.washGain)
    expect(propulsionMix({ ...ship, destroyed: true }, 'clear').engineGain).toBe(0)
  })

  it('uses heavier machinery for battleships and rain ambience for rain', () => {
    const ship = player()
    expect(propulsionMix({ ...ship, templateId: 'hull.bb.fast' }, 'clear').engineHz)
      .toBeLessThan(propulsionMix(ship, 'clear').engineHz)
    expect(propulsionMix(ship, 'rain').seaGain).toBeGreaterThan(propulsionMix(ship, 'clear').seaGain)
  })
})

describe('combat music director', () => {
  it('does not reveal an unseen boss and changes on detection', () => {
    const director = new CombatMusicDirector()
    const state = createInitialState('destroyer', 1)
    const ship = player()
    state.entities.set('boss', { ...ship, id: 'boss', team: 'enemy', templateId: 'hull.enemy.boss.dreadnought' })
    state.detectedByPlayer.clear()
    expect(director.update(state)).toBe('cruise')
    state.detectedByPlayer.add('boss')
    expect(director.update(state)).toBe('boss')
    state.detectedByPlayer.clear()
    state.tick += 60
    expect(director.update(state)).toBe('boss')
    state.tick += 181
    expect(director.update(state)).toBe('normal')
    state.detectedByPlayer.add('boss')
    expect(director.update(state)).toBe('boss')
    ;(state.entities.get('boss') as ShipEntity).destroyed = true
    expect(director.update(state)).toBe('normal')
  })

  it('holds engagement through reload and returns to cruise after contact loss', () => {
    const director = new CombatMusicDirector()
    const state = createInitialState('destroyer', 1)
    state.detectedByPlayer.clear()
    for (const entity of state.entities.values()) if (isShip(entity) && entity.team === 'enemy') entity.destroyed = true
    state.tick = 20
    state.eventLog = [{ tick: 20, type: 'weapon.fired', sourceId: 'ship.player' }]
    expect(director.update(state)).toBe('normal')
    state.eventLog = []
    state.tick = 300
    expect(director.update(state)).toBe('normal')
    state.tick = 381
    expect(director.update(state)).toBe('cruise')
    director.reset()
    state.tick = 0
    expect(director.update(state)).toBe('cruise')
  })
})
