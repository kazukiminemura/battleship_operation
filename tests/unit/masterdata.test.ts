import { describe, expect, it } from 'vitest'
import { createInitialState, type PlayerShipType } from '../../src/game/data/masterdata'
import type { ShipEntity } from '../../src/game/simulation/types'

function playerOf(type: PlayerShipType): ShipEntity {
  const state = createInitialState(type)
  return state.entities.get('ship.player') as ShipEntity
}

describe('createInitialState', () => {
  it('creates a destroyer player ship by default', () => {
    const player = createInitialState().entities.get('ship.player') as ShipEntity

    expect(player.templateId).toBe('hull.destroyer.basic')
    expect(player.maxSpeed).toBe(5)
    expect(player.weapons.find(w => w.type === 'gun')?.ammo).toBe(60)
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
})
