import { describe, expect, it } from 'vitest'
import { planGunRun } from '../../src/game/simulation/naval-tactics'
import { generateAiCommands } from '../../src/game/simulation/ai'
import { createInitialState } from '../../src/game/data/masterdata'
import { createRngStreams } from '../../src/game/simulation/random'
import { fireWeaponAtSlot, stepWeaponCooldowns } from '../../src/game/simulation/weapons'
import { getWeaponConfig } from '../../src/game/simulation/weapon-strategies'
import { TICKS_PER_SECOND } from '../../src/game/simulation/ticker'
import type { ShipEntity } from '../../src/game/simulation/types'

describe('mobile gunnery tactics', () => {
  const ship = { id: 'enemy.1', pos: { x: 0, y: 0, z: 0 }, angle: 0, maxSpeed: 6 }
  it('approaches, circles and disengages without parking or reversing', () => {
    const approach = planGunRun(ship, { x: 3000, y: 0, z: 0 }, 1000)
    expect(Math.cos(approach.heading)).toBeCloseTo(1)
    const orbit = planGunRun(ship, { x: 1000, y: 0, z: 0 }, 1000)
    expect(Math.cos(orbit.heading)).toBeCloseTo(0)
    const disengage = planGunRun(ship, { x: 200, y: 0, z: 0 }, 1000)
    expect(Math.cos(disengage.heading)).toBeCloseTo(-1)
    for (const maneuver of [approach, orbit, disengage]) {
      expect(maneuver.speed).toBeGreaterThan(0)
      expect(maneuver.speed).toBeLessThanOrEqual(ship.maxSpeed)
    }
    const otherFlank = planGunRun({ ...ship, id: 'enemy.2' }, { x: 1000, y: 0, z: 0 }, 1000)
    expect(Math.sin(otherFlank.heading)).toBeCloseTo(-Math.sin(orbit.heading))
  })

  it('generates simultaneous helm and fire orders deterministically in engagement range', () => {
    const initial = createInitialState()
    const player = initial.entities.get('ship.player') as ShipEntity
    const enemy = [...initial.entities.values()].find(e => e.kind === 'ship' && e.team === 'enemy') as ShipEntity
    const entities = new Map(initial.entities)
    entities.set(player.id, { ...player, pos: { x: 5000, y: 5000, z: 0 } })
    entities.set(enemy.id, { ...enemy, pos: { x: 5800, y: 5000, z: 0 } })
    const state = { ...initial, entities, mapObstacles: [] }
    const before = JSON.stringify([...entities])
    const commands = generateAiCommands(state, createRngStreams(42).ai)
    expect(commands.some(c => c.actorId === enemy.id && c.type === 'move' && c.value! > 0)).toBe(true)
    expect(commands.some(c => c.actorId === enemy.id && c.type === 'fire.slot')).toBe(true)
    expect(commands).toEqual(generateAiCommands(state, createRngStreams(42).ai))
    expect(JSON.stringify([...entities])).toBe(before)
  })

  it('fires repeated battleship salvos while respecting reload and finite ammunition', () => {
    let state = createInitialState('battleship')
    const player = state.entities.get('ship.player') as ShipEntity
    const weapon = player.weapons[0]!
    const target = { x: player.pos.x + 800 * Math.cos(player.angle + Math.PI / 2), y: player.pos.y + 800 * Math.sin(player.angle + Math.PI / 2), z: 0 }
    const rng = createRngStreams(42).combat
    let volleys = 0, shells = 0
    const firedAt: number[] = []
    for (let tick = 0; tick < 30 * TICKS_PER_SECOND; tick++) {
      state = { ...state, tick, eventLog: [] }
      if (tick > 0) state = stepWeaponCooldowns(state)
      state = fireWeaponAtSlot(state, player.id, 0, target, rng)
      for (const event of state.eventLog) if (event.type === 'weapon.fired') {
        volleys++; shells += event.salvoCount ?? 0; firedAt.push(tick)
      }
    }
    expect(volleys).toBe(9)
    for (let i = 1; i < firedAt.length; i++) expect(firedAt[i]! - firedAt[i - 1]!).toBe(getWeaponConfig(weapon.id, weapon.type).cooldown)
    expect((state.entities.get(player.id) as ShipEntity).weapons[0]!.ammo).toBe(weapon.ammo - shells)
  })
})
