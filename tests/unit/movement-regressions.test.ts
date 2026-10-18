import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/game/data/masterdata'
import { stepCollisions, stepMovement, stepMovementAndCollisions } from '../../src/game/simulation/movement'
import { shipContactDimensions } from '../../src/game/simulation/ship-contact'
import { generateAiCommands } from '../../src/game/simulation/ai'
import { createRngStreams } from '../../src/game/simulation/random'
import type { CombatState, ShipEntity } from '../../src/game/simulation/types'

function vessel(id: string, overrides: Partial<ShipEntity> = {}): ShipEntity {
  return { ...(createInitialState().entities.get('ship.player') as ShipEntity), id, angle: 0, pos: { x: 1000, y: 1000, z: 0 }, speed: 3, targetSpeed: 3, speedLevel: 'cruise', vel: { x: 4.5, y: 0, z: 0 }, ...overrides }
}
function state(ships: ShipEntity[]): CombatState { return { ...createInitialState(), mapObstacles: [], entities: new Map(ships.map(s => [s.id, s])) } }

describe('movement regressions', () => {
  it('keeps throttle on contact, leaves the leading ship moving, and resumes after clearance', () => {
    const follower = vessel('a')
    const leader = vessel('b', { pos: { x: 1000 + shipContactDimensions(follower).length - 1, y: 1000, z: 0 }, speed: 1, targetSpeed: 1, vel: { x: 1.5, y: 0, z: 0 } })
    const contact = stepCollisions(state([follower, leader]))
    const a = contact.entities.get('a') as ShipEntity, b = contact.entities.get('b') as ShipEntity
    expect(a.targetSpeed).toBe(3)
    expect(a.speedLevel).toBe('cruise')
    expect(a.speed).toBeCloseTo(1)
    expect(b.speed).toBe(1)
    const clear = stepMovementAndCollisions(state([a])).entities.get('a') as ShipEntity
    expect(clear.speed).toBeGreaterThan(a.speed)
    expect(clear.pos.x).toBeGreaterThan(a.pos.x)
  })

  it('does not jump back from shore or lose throttle when turning away', () => {
    const v = vessel('a', { pos: { x: 5000, y: 5481, z: 0 }, angle: -Math.PI / 2 })
    const s = { ...state([v]), mapObstacles: [{ id: 'coast', x: 5000, y: 5050, rx: 620, ry: 430 }] }
    const stopped = stepMovement(s).entities.get('a') as ShipEntity
    expect(stopped.pos).toEqual(v.pos)
    expect(stopped.targetSpeed).toBe(3)
    const away = stepMovement({ ...s, entities: new Map([['a', { ...stopped, angle: Math.PI / 2 }]]) }).entities.get('a') as ShipEntity
    expect(away.pos.y).toBeGreaterThan(stopped.pos.y)
  })

  it('keeps free movement identical when a distant fast vessel changes substep count', () => {
    const a = vessel('a', { speed: 1, targetSpeed: 3 })
    const fast = vessel('b', { pos: { x: 10000, y: 10000, z: 0 }, speed: 100, targetSpeed: 100, maxSpeed: 100 })
    const alone = stepMovementAndCollisions(state([a])).entities.get('a') as ShipEntity
    const fleet = stepMovementAndCollisions(state([a, fast])).entities.get('a') as ShipEntity
    expect(fleet.pos.x).toBeCloseTo(alone.pos.x, 8)
    expect(fleet.speed).toBeCloseTo(alone.speed, 8)
  })

  it('steers an advancing enemy around another ship without treating itself as an obstacle', () => {
    const player = vessel('ship.player', { pos: { x: 9000, y: 1000, z: 0 } })
    const enemy = vessel('enemy', { team: 'enemy', templateId: 'hull.enemy.destroyer.basic' })
    const blocker = vessel('blocker', { team: 'enemy', pos: { x: 1250, y: 1000, z: 0 }, speed: 0, targetSpeed: 0 })
    const alone = generateAiCommands(state([player, enemy]), createRngStreams(1).ai).filter(c => c.actorId === enemy.id)
    expect(alone.some(c => c.type === 'rotate')).toBe(false)
    const crowded = generateAiCommands(state([player, enemy, blocker]), createRngStreams(1).ai).filter(c => c.actorId === enemy.id)
    expect(crowded.some(c => c.type === 'rotate')).toBe(true)
    expect(crowded.find(c => c.type === 'move')!.value).toBeLessThan(enemy.maxSpeed)
  })
})
