import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createInitialState } from '../../src/game/data/masterdata'
import type { ShipEntity } from '../../src/game/simulation/types'
import { combatShipPreviewConfig } from '../../src/game/rendering/three-battlefield-renderer'
import { buildShip } from '../../src/game/rendering/three-ship-designer-renderer'
import { historicalProfile } from '../../src/game/rendering/historical-ship-profiles'
import { bowSheer, navalDeck } from '../../src/game/rendering/naval-geometry'

describe('historical fleet appearance', () => {
  for (const kind of ['destroyer', 'cruiser', 'battleship'] as const) {
    it(`${kind}: preserves live weapons and produces its own bridge and funnel layout`, () => {
      const entity = createInitialState(kind).entities.get('ship.player') as ShipEntity
      const before = JSON.stringify(entity)
      const config = combatShipPreviewConfig(entity)
      const model = buildShip(config)
      expect(model.getObjectByName(`${kind}-bridge`)).toBeDefined()
      const funnels: THREE.Object3D[] = [], weapons: THREE.Object3D[] = []
      model.traverse(part => {
        if (part.name.startsWith('funnel-')) funnels.push(part)
        if (part.userData['weaponId']) weapons.push(part)
      })
      expect(funnels).toHaveLength(kind === 'battleship' ? 1 : 2)
      expect(weapons.map(m => m.userData['weaponId'])).toEqual(entity.weapons.map(m => m.id))
      expect(JSON.stringify(entity)).toBe(before)
      for (const part of weapons) expect(Number.isFinite(part.position.y)).toBe(true)
    })
  }

  it('keeps moved weapons and bridges at the requested normalized deck positions', () => {
    const entity = createInitialState('battleship').entities.get('ship.player') as ShipEntity
    const config = combatShipPreviewConfig(entity)
    config.towerMount = { x: 0.2, y: 0.2 }
    config.weapons = [{ id: 'custom', name: 'custom', type: 'gun', mount: { x: 0.4, y: 0.6 }, selected: false }]
    const model = buildShip(config)
    const gun = model.getObjectByName('custom')!
    const bridge = model.getObjectByName('battleship-bridge')!
    expect(gun.position.x).toBeLessThan(0)
    expect(gun.position.z).toBeGreaterThan(0)
    expect(bridge.position.x).toBeLessThan(0)
    expect(bridge.position.z).toBeGreaterThan(0)
  })

  it('distinguishes slender destroyers from broad battleships and scales main guns', () => {
    const dd = historicalProfile('destroyer'), ca = historicalProfile('cruiser'), bb = historicalProfile('battleship')
    expect(dd.lengthToBeam).toBeGreaterThan(ca.lengthToBeam)
    expect(ca.lengthToBeam).toBeGreaterThan(bb.lengthToBeam)
    expect(dd.gunScale).toBeLessThan(ca.gunScale)
    expect(ca.gunScale).toBeLessThan(bb.gunScale)
    expect(dd.timberDeck).toBe(false)
    expect(bb.timberDeck).toBe(true)
  })

  it('raises the bow deck continuously with upward-facing triangles', () => {
    const geometry = navalDeck(10, 1, 1)
    const positions = geometry.getAttribute('position')
    const normals = geometry.getAttribute('normal')
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getZ(i)).toBeCloseTo(bowSheer(positions.getX(i) / 10 + 0.5, 1))
      expect(normals.getZ(i)).toBeGreaterThanOrEqual(0)
    }
    expect(bowSheer(0.95, 1)).toBeGreaterThan(bowSheer(0.3, 1))
  })
})
