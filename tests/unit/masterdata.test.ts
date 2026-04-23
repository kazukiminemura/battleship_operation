import { describe, expect, it } from 'vitest'
import { createDebugState, createInitialState, STATIC_DATA, type PlayerShipType } from '../../src/game/data/masterdata'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { MAX_WEAPON_SLOTS, type BuildingEntity, type ShipEntity } from '../../src/game/simulation/types'
import { WORLD_SIZE } from '../../src/game/simulation/movement'

function playerOf(type: PlayerShipType): ShipEntity {
  const state = createInitialState(type)
  return state.entities.get('ship.player') as ShipEntity
}

describe('createInitialState', () => {
  it('creates a destroyer player ship by default', () => {
    const player = createInitialState().entities.get('ship.player') as ShipEntity

    expect(player.templateId).toBe('hull.destroyer.basic')
    expect(player.maxSpeed).toBe(6.25)
    expect(player.weapons.find(w => w.type === 'gun')?.ammo).toBe(220)
    expect(player.weapons.find(w => w.type === 'gun')?.name).toBe('12.7cm連装砲')
    expect(player.weapons.every(w => w.autoFire)).toBe(true)
  })

  it('creates each selectable player ship type with distinct stats', () => {
    const destroyer = playerOf('destroyer')
    const cruiser = playerOf('cruiser')
    const battleship = playerOf('battleship')

    expect(destroyer.templateId).toBe('hull.destroyer.basic')
    expect(cruiser.templateId).toBe('hull.cruiser.player')
    expect(battleship.templateId).toBe('hull.battleship.basic')

    expect(destroyer.maxSpeed).toBeGreaterThan(cruiser.maxSpeed)
    expect(cruiser.maxSpeed).toBeGreaterThan(battleship.maxSpeed)
    expect(battleship.maxHp).toBeGreaterThan(cruiser.maxHp)
    expect(cruiser.maxHp).toBeGreaterThan(destroyer.maxHp)
    expect(cruiser.weapons).toHaveLength(6)
    expect(battleship.weapons).toHaveLength(MAX_WEAPON_SLOTS)
  })

  it('places stage one enemies for arcade-style combat', () => {
    const state = createInitialState()
    const enemies = [...state.entities.values()].filter(
      e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy',
    ) as ShipEntity[]

    expect(state.stage).toBe(1)
    expect(state.maxStage).toBe(10)
    expect(enemies).toHaveLength(3)
  })

  it('places destructible buildings on the central island', () => {
    const state = createInitialState()
    const buildings = [...state.entities.values()].filter(e => e.kind === 'building') as BuildingEntity[]

    expect(buildings).toHaveLength(1)
    expect(buildings.map(b => b.id)).toContain('building.stage1.command')
    expect(buildings.every(b => b.team === 'enemy')).toBe(true)
    expect(buildings.every(b => b.hp > 0 && !b.destroyed)).toBe(true)
  })

  it('keeps ship templates within the maximum weapon slot count', () => {
    for (const template of Object.values(STATIC_DATA.ships)) {
      expect(template.weapons.length).toBeLessThanOrEqual(MAX_WEAPON_SLOTS)
    }
  })

  it('gives every weapon a display name', () => {
    for (const template of Object.values(STATIC_DATA.ships)) {
      expect(template.weapons.every(w => typeof w.name === 'string' && w.name.length > 0)).toBe(true)
    }
  })

  it('includes the special battleship Snowmura', () => {
    const template = STATIC_DATA.ships['hull.bb.yukimura']
    const catalog = HULL_CATALOG.find(h => h.templateId === 'hull.bb.yukimura')

    expect(template).toBeDefined()
    if (!template) throw new Error('Snowmura template missing')
    expect(template.weapons).toHaveLength(MAX_WEAPON_SLOTS)
    expect(template.hp).toBe(1800)
    expect(catalog?.name).toBe('雪村')
    expect(catalog?.shipType).toBe('battleship')
    expect(catalog?.minStage).toBe(1)
  })

  it('creates ten stages and puts a boss in the final stage', () => {
    expect(STATIC_DATA.stages).toHaveLength(10)

    const finalState = createInitialState('battleship', 10)
    const boss = finalState.entities.get('ship.enemy.boss.dreadnought') as ShipEntity | undefined
    const enemies = [...finalState.entities.values()].filter(
      e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy',
    ) as ShipEntity[]

    expect(finalState.stageName).toBe('Dreadnought Core')
    expect(boss?.templateId).toBe('hull.enemy.boss.dreadnought')
    expect(boss?.weapons).toHaveLength(MAX_WEAPON_SLOTS)
    expect(enemies.length).toBeGreaterThan(1)
  })

  it('changes map obstacles between stages', () => {
    const stageOne = createInitialState('destroyer', 1)
    const stageFive = createInitialState('destroyer', 5)
    const stageTen = createInitialState('destroyer', 10)

    expect(stageOne.mapObstacles).toHaveLength(1)
    expect(stageFive.mapObstacles).toHaveLength(2)
    expect(stageTen.mapObstacles).toHaveLength(3)
    expect(stageOne.mapObstacles[0]?.id).not.toBe(stageFive.mapObstacles[0]?.id)
  })

  it('creates a dense debug map with many enemies and complex terrain', () => {
    const state = createDebugState()
    const enemies = [...state.entities.values()].filter(
      e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy',
    ) as ShipEntity[]
    const buildings = [...state.entities.values()].filter(e => e.kind === 'building') as BuildingEntity[]

    expect(state.stageName).toBe('Debug Maze Fleet')
    expect(state.mapObstacles.length).toBeGreaterThanOrEqual(10)
    expect(enemies.length).toBeGreaterThanOrEqual(100)
    expect(enemies.some(e => e.templateId === 'hull.enemy.boss.dreadnought')).toBe(true)
    expect(Math.max(...enemies.map(e => e.pos.x))).toBeGreaterThan(12000)
    expect(WORLD_SIZE).toBeGreaterThan(10000)
    expect(buildings.length).toBeGreaterThanOrEqual(5)
  })

  it('hardens debug enemies for fleet battles', () => {
    const debugState = createDebugState()
    const normalState = createInitialState('battleship', 10)
    const debugDestroyer = [...debugState.entities.values()].find(
      e => e.kind === 'ship' && (e as ShipEntity).templateId === 'hull.enemy.destroyer.basic',
    ) as ShipEntity
    const normalDestroyer = [...normalState.entities.values()].find(
      e => e.kind === 'ship' && (e as ShipEntity).templateId === 'hull.enemy.destroyer.basic',
    ) as ShipEntity
    const debugBoss = debugState.entities.get('ship.debug.enemy.boss.dreadnought') as ShipEntity
    const normalBoss = normalState.entities.get('ship.enemy.boss.dreadnought') as ShipEntity

    expect(debugDestroyer.maxHp).toBe(normalDestroyer.maxHp * 4)
    expect(debugDestroyer.hp).toBe(debugDestroyer.maxHp)
    expect(debugBoss.maxHp).toBe(Math.round(normalBoss.maxHp * 2.5))
  })

  it('maxes debug player visibility and speed', () => {
    const debugState = createDebugState()
    const player = debugState.entities.get('ship.player') as ShipEntity

    expect(player.detectionRange).toBe(WORLD_SIZE * 2)
    expect(player.maxSpeed).toBe(20)
    expect(player.speed).toBe(20)
    expect(player.targetSpeed).toBe(20)
    expect(player.speedLevel).toBe('full')
  })
})
