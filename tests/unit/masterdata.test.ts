import { describe, expect, it } from 'vitest'
import { createInitialState, type PlayerShipType } from '../../src/game/data/masterdata'
import type { BuildingEntity, ShipEntity } from '../../src/game/simulation/types'

function playerOf(type: PlayerShipType): ShipEntity {
  const state = createInitialState(type)
  return state.entities.get('ship.player') as ShipEntity
}

describe('createInitialState', () => {
  it('creates a destroyer player ship by default', () => {
    const player = createInitialState().entities.get('ship.player') as ShipEntity

    expect(player.templateId).toBe('hull.destroyer.basic')
    expect(player.maxSpeed).toBe(5)
    expect(player.weapons.find(w => w.type === 'gun')?.ammo).toBe(220)
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
  })

  it('places a dense enemy fleet for arcade-style combat', () => {
    const state = createInitialState()
    const enemies = [...state.entities.values()].filter(
      e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy',
    ) as ShipEntity[]

    expect(enemies).toHaveLength(28)
  })

  it('places destructible buildings on the central island', () => {
    const state = createInitialState()
    const buildings = [...state.entities.values()].filter(e => e.kind === 'building') as BuildingEntity[]

    expect(buildings).toHaveLength(3)
    expect(buildings.map(b => b.id)).toContain('building.island.command')
    expect(buildings.every(b => b.team === 'enemy')).toBe(true)
    expect(buildings.every(b => b.hp > 0 && !b.destroyed)).toBe(true)
  })
})
