import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../src/game/data/masterdata'
import { stepCollisions, stepMovementAndCollisions } from '../../src/game/simulation/movement'
import { shipContact, shipContactDimensions } from '../../src/game/simulation/ship-contact'
import type { CombatState, ShipEntity } from '../../src/game/simulation/types'
import { CanvasRenderer } from '../../src/game/rendering/canvas'

const initial = () => createInitialState()
function ship(id: string, overrides: Partial<ShipEntity> = {}): ShipEntity {
  return { ...(initial().entities.get('ship.player') as ShipEntity), id, pos: { x: 1000, y: 1000, z: 0 }, angle: 0, speed: 0, targetSpeed: 0, vel: { x: 0, y: 0, z: 0 }, ...overrides }
}
function state(ships: ShipEntity[]): CombatState { return { ...initial(), mapObstacles: [], entities: new Map(ships.map(s => [s.id, s])) } }
function remaining(s: CombatState) { return [...s.entities.values()].filter(e => e.kind === 'ship' && !e.destroyed) as ShipEntity[] }

describe('fleet hull contact', () => {
  it('separates coincident friendly hulls without friendly damage or input mutation', () => {
    const a = ship('a'), b = ship('b')
    const next = stepCollisions(state([a, b]))
    const [left, right] = remaining(next)
    expect(shipContact(left!, right!)).toBeUndefined()
    expect(left!.hp).toBe(a.hp)
    expect(right!.hp).toBe(b.hp)
    expect(a.pos).toEqual(b.pos)
  })
  it('separates hulls even when their velocities already point apart', () => {
    const a = ship('a', { vel: { x: 0, y: -2, z: 0 } })
    const b = ship('b', { team: 'enemy', pos: { x: 1000, y: 1002, z: 0 }, vel: { x: 0, y: 2, z: 0 } })
    const [left, right] = remaining(stepCollisions(state([a, b])))
    expect(shipContact(left!, right!)).toBeUndefined()
    expect(left!.hp).toBe(a.hp)
  })
  it('resolves a crowded group consistently regardless of map insertion order', () => {
    const group = [ship('a'), ship('b'), ship('c'), ship('d')]
    const result = remaining(stepCollisions(state(group)))
    for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) expect(shipContact(result[i]!, result[j]!)).toBeUndefined()
    const reversed = remaining(stepCollisions(state([...group].reverse()))).sort((a,b) => a.id < b.id ? -1 : 1)
    expect(result.map(s => s.pos)).toEqual(reversed.map(s => s.pos))
  })
  it('blocks a high-speed crossing while preserving throttle for recovery', () => {
    const mover = ship('a', { pos: { x: 1000, y: 650, z: 0 }, angle: Math.PI / 2, speed: 600, targetSpeed: 600, maxSpeed: 600 })
    const blocker = ship('b')
    const [a, b] = remaining(stepMovementAndCollisions(state([mover, blocker])))
    expect(a!.pos.y).toBeLessThan(b!.pos.y)
    expect(a!.speed).toBeLessThanOrEqual(.11)
    expect(a!.targetSpeed).toBe(600)
    expect(shipContact(a!, b!)).toBeUndefined()
  })
  it('preserves close parallel sailing rather than using an oversized circle', () => {
    const a = ship('a'), b = ship('b', { pos: { x: 1000, y: 1060, z: 0 } })
    expect(shipContact(a,b)).toBeUndefined()
    expect(remaining(stepCollisions(state([a,b]))).map(s => s.pos)).toEqual([a.pos,b.pos])
    expect(shipContactDimensions(a).length).toBeGreaterThan(300)
  })
})

it('keeps destroyed facility geometry at its original dimensions and adds fire', () => {
  const boxes: unknown[][] = []
  const gradient = { addColorStop() {} }
  const context = new Proxy({ createRadialGradient: () => gradient }, { get: (target, prop) => prop in target ? target[prop as keyof typeof target] : () => {} })
  const renderer = Object.create(CanvasRenderer.prototype)
  Object.assign(renderer, { ctx: context, iso: { scale: .2 }, w2s: (x:number, y:number) => [x,y], drawIsoBox: (...args:unknown[]) => boxes.push(args) })
  const building = { kind: 'building', id: 'base', templateId: 'building.command.bunker', hp: 100, maxHp: 100, radius: 44, pos: { x: 100, y: 100, z: 0 }, destroyed: false }
  renderer.renderBuilding(building, 100)
  const intact = boxes.map(args => args.slice(0,5))
  boxes.length = 0
  let fire = false
  renderer.renderBuildingFire = () => { fire = true }
  renderer.renderBuilding({ ...building, destroyed: true, hp: 0 }, 100)
  expect(boxes.map(args => args.slice(0,5))).toEqual(intact)
  expect(fire).toBe(true)
})
