import { describe, expect, it } from 'vitest'
import { effectiveDetectionRange, stepDetection } from '../../src/game/simulation/detection'
import type { CombatState, Metrics, ShipEntity, WeatherCondition } from '../../src/game/simulation/types'

function makeShip(overrides: Partial<ShipEntity> = {}): ShipEntity {
  return {
    kind: 'ship',
    id: 'ship.player',
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    angle: 0,
    hp: 100,
    maxHp: 100,
    speed: 0,
    targetSpeed: 0,
    speedLevel: 'stop',
    maxSpeed: 5,
    turnRate: 0.04,
    detectionRange: 2200,
    weapons: [],
    armor: 0,
    team: 'player',
    destroyed: false,
    templateId: 'hull.destroyer.basic',
    ...overrides,
  }
}

function makeState(weather: WeatherCondition, enemyDistance: number): CombatState {
  const player = makeShip()
  const enemy = makeShip({
    id: 'ship.enemy',
    pos: { x: enemyDistance, y: 0, z: 0 },
    team: 'enemy',
    templateId: 'hull.enemy.destroyer.basic',
  })
  const metrics: Metrics = {
    result: 'none',
    durationTicks: 0,
    playerDamageTaken: 0,
    playerAmmoSpent: 0,
    hitCountByWeapon: {},
    shotCountByWeapon: {},
    damageByWeapon: {},
    enemiesDestroyed: 0,
  }
  return {
    tick: 0,
    stage: 1,
    stageName: 'Test Stage',
    maxStage: 10,
    weather,
    mapObstacles: [],
    entities: new Map([
      [player.id, player],
      [enemy.id, enemy],
    ]),
    eventLog: [],
    missionResult: 'none',
    metrics,
    detectedByPlayer: new Set<string>(),
    enemyContacts: new Map(),
  }
}

describe('detection visibility', () => {
  it('uses weather visibility distances for clear and rain, and current ship range at night', () => {
    expect(effectiveDetectionRange(2200, 'clear')).toBe(20000)
    expect(effectiveDetectionRange(2200, 'rain')).toBe(10000)
    expect(effectiveDetectionRange(2200, 'night')).toBe(2200)
  })

  it('detects ships up to about 20km in clear weather', () => {
    expect(stepDetection(makeState('clear', 19000)).detectedByPlayer.has('ship.enemy')).toBe(true)
    expect(stepDetection(makeState('clear', 21000)).detectedByPlayer.has('ship.enemy')).toBe(false)
  })

  it('detects ships up to about 10km in rain', () => {
    expect(stepDetection(makeState('rain', 9000)).detectedByPlayer.has('ship.enemy')).toBe(true)
    expect(stepDetection(makeState('rain', 11000)).detectedByPlayer.has('ship.enemy')).toBe(false)
  })

  it('keeps the current ship distance at night', () => {
    expect(stepDetection(makeState('night', 2100)).detectedByPlayer.has('ship.enemy')).toBe(true)
    expect(stepDetection(makeState('night', 2300)).detectedByPlayer.has('ship.enemy')).toBe(false)
  })
})
