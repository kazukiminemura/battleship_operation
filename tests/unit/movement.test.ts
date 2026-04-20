import { describe, it, expect } from 'vitest'
import {
  stepMovement, applySpeedUpCommand, applySpeedDownCommand,
  applyMoveCommand, applyRotateCommand, isOnLand, WORLD_SIZE,
} from '../../src/game/simulation/movement'
import type { CombatState, ShipEntity, Metrics, SpeedLevel } from '../../src/game/simulation/types'

function makeShip(overrides: Partial<ShipEntity> = {}): ShipEntity {
  return {
    kind: 'ship',
    id: 'test.ship',
    pos: { x: 500, y: 500, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    angle: 0,
    hp: 100, maxHp: 100,
    speed: 0, targetSpeed: 0, speedLevel: 'stop',
    maxSpeed: 5, turnRate: 0.04,
    weapons: [],
    team: 'player', destroyed: false,
    templateId: 'hull.destroyer.basic',
    ...overrides,
  }
}

function makeState(ships: ShipEntity[]): CombatState {
  const entities = new Map()
  for (const s of ships) entities.set(s.id, s)
  const metrics: Metrics = {
    result: 'none', durationTicks: 0, playerDamageTaken: 0, playerAmmoSpent: 0,
    hitCountByWeapon: {}, shotCountByWeapon: {}, damageByWeapon: {}, enemiesDestroyed: 0,
  }
  return {
    tick: 0,
    stage: 1,
    stageName: 'Test Stage',
    maxStage: 10,
    mapObstacles: [{ id: 'island.test', x: 5000, y: 5050, rx: 620, ry: 430 }],
    entities,
    eventLog: [],
    missionResult: 'none',
    metrics,
  }
}

describe('stepMovement', () => {
  it('accelerates speed toward targetSpeed', () => {
    const ship = makeShip({ speed: 0, targetSpeed: 5, angle: 0 })
    const state = makeState([ship])
    const next = stepMovement(state)
    const updated = next.entities.get(ship.id) as ShipEntity
    expect(updated.speed).toBeGreaterThan(0)
    expect(updated.speed).toBeLessThanOrEqual(5)
  })

  it('moves ship forward when speed > 0', () => {
    const ship = makeShip({ speed: 3, targetSpeed: 3, angle: 0 })
    const state = makeState([ship])
    const next = stepMovement(state)
    const updated = next.entities.get(ship.id) as ShipEntity
    expect(updated.pos.x).toBeGreaterThan(500)
    expect(updated.pos.y).toBeCloseTo(500)
  })

  it('clamps to WORLD_SIZE on x and zeroes speed', () => {
    const ship = makeShip({ pos: { x: WORLD_SIZE - 1, y: 500, z: 0 }, speed: 5, targetSpeed: 5, angle: 0 })
    const state = makeState([ship])
    const next = stepMovement(state)
    const updated = next.entities.get(ship.id) as ShipEntity
    expect(updated.pos.x).toBe(WORLD_SIZE)
    expect(updated.speed).toBe(0)
  })

  it('clamps to y=0 and zeroes speed when heading up', () => {
    const ship = makeShip({ pos: { x: 500, y: 2, z: 0 }, speed: 5, targetSpeed: 5, angle: -Math.PI / 2 })
    const state = makeState([ship])
    const next = stepMovement(state)
    const updated = next.entities.get(ship.id) as ShipEntity
    expect(updated.pos.y).toBe(0)
    expect(updated.speed).toBe(0)
  })

  it('skips destroyed ships', () => {
    const ship = makeShip({ destroyed: true, speed: 5, targetSpeed: 5 })
    const state = makeState([ship])
    const next = stepMovement(state)
    const updated = next.entities.get(ship.id) as ShipEntity
    expect(updated.pos.x).toBe(500)
  })

  it('prevents ships from entering island land', () => {
    const ship = makeShip({
      pos: { x: 5000, y: 5485, z: 0 },
      angle: -Math.PI / 2,
      speed: 5,
      targetSpeed: 5,
    })
    const state = makeState([ship])
    let next = state

    for (let i = 0; i < 20; i++) next = stepMovement(next)

    const updated = next.entities.get(ship.id) as ShipEntity
    expect(isOnLand(updated.pos.x, updated.pos.y)).toBe(false)
    expect(updated.speed).toBe(0)
  })
})

describe('applySpeedUpCommand', () => {
  const levels: SpeedLevel[] = ['reverse', 'stop', 'slow', 'cruise', 'full']

  it('advances to next speed level', () => {
    const ship = makeShip({ speedLevel: 'stop' })
    const result = applySpeedUpCommand(ship)
    expect(result.speedLevel).toBe('slow')
    expect(result.targetSpeed).toBeCloseTo(ship.maxSpeed * 0.3)
  })

  it('sets full speed from the selected ship maxSpeed', () => {
    const destroyer = applySpeedUpCommand(makeShip({ speedLevel: 'cruise', maxSpeed: 6.25 }))
    const cruiser = applySpeedUpCommand(makeShip({ speedLevel: 'cruise', maxSpeed: 4.4 }))
    const battleship = applySpeedUpCommand(makeShip({ speedLevel: 'cruise', maxSpeed: 2.6 }))

    expect(destroyer.targetSpeed).toBeCloseTo(6.25)
    expect(cruiser.targetSpeed).toBeCloseTo(4.4)
    expect(battleship.targetSpeed).toBeCloseTo(2.6)
  })

  it('stays at full when already at max', () => {
    const ship = makeShip({ speedLevel: 'full' })
    const result = applySpeedUpCommand(ship)
    expect(result.speedLevel).toBe('full')
  })

  it('covers all transitions upward', () => {
    for (let i = 0; i < levels.length - 1; i++) {
      const ship = makeShip({ speedLevel: levels[i] })
      const result = applySpeedUpCommand(ship)
      expect(result.speedLevel).toBe(levels[i + 1])
    }
  })
})

describe('applySpeedDownCommand', () => {
  const levels: SpeedLevel[] = ['reverse', 'stop', 'slow', 'cruise', 'full']

  it('lowers to previous speed level', () => {
    const ship = makeShip({ speedLevel: 'slow' })
    const result = applySpeedDownCommand(ship)
    expect(result.speedLevel).toBe('stop')
    expect(result.targetSpeed).toBe(0)
  })

  it('stays at reverse when already at min', () => {
    const ship = makeShip({ speedLevel: 'reverse' })
    const result = applySpeedDownCommand(ship)
    expect(result.speedLevel).toBe('reverse')
  })

  it('covers all transitions downward', () => {
    for (let i = levels.length - 1; i > 0; i--) {
      const ship = makeShip({ speedLevel: levels[i] })
      const result = applySpeedDownCommand(ship)
      expect(result.speedLevel).toBe(levels[i - 1])
    }
  })
})

describe('applyMoveCommand (AI use)', () => {
  it('sets targetSpeed from value', () => {
    const ship = makeShip()
    const cmd = { tick: 0, actorId: ship.id, type: 'move' as const, value: 2 }
    const result = applyMoveCommand(ship, cmd)
    expect(result.targetSpeed).toBe(2)
  })

  it('clamps targetSpeed to maxSpeed', () => {
    const ship = makeShip({ maxSpeed: 3 })
    const cmd = { tick: 0, actorId: ship.id, type: 'move' as const, value: 10 }
    const result = applyMoveCommand(ship, cmd)
    expect(result.targetSpeed).toBe(3)
  })
})

describe('applyRotateCommand', () => {
  it('updates angle', () => {
    const ship = makeShip({ angle: 0, turnRate: 0.04 })
    const cmd = { tick: 0, actorId: ship.id, type: 'rotate' as const, value: 0.04 }
    expect(applyRotateCommand(ship, cmd).angle).toBeCloseTo(0.04)
  })

  it('clamps to turnRate', () => {
    const ship = makeShip({ angle: 0, turnRate: 0.04 })
    const cmd = { tick: 0, actorId: ship.id, type: 'rotate' as const, value: 999 }
    expect(applyRotateCommand(ship, cmd).angle).toBeCloseTo(0.04)
  })
})
