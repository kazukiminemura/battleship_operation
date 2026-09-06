import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import kit from '../../src/game/rendering/assets/battleship-kit.json'
import { blenderBattleshipPart } from '../../src/game/rendering/blender-battleship'
import { buildShip } from '../../src/game/rendering/three-ship-designer-renderer'
import { createInitialState } from '../../src/game/data/masterdata'
import { combatShipPreviewConfig } from '../../src/game/rendering/three-battlefield-renderer'
import type { ShipEntity } from '../../src/game/simulation/types'
import { historicalProfile } from '../../src/game/rendering/historical-ship-profiles'

describe('Blender battleship asset integration', () => {
  it('ships evaluated Blender geometry within the per-part polygon budget', () => {
    expect(kit.generator).toMatch(/^Blender /)
    expect(kit.freeboardRatio).toBe(historicalProfile('battleship').freeboard)
    for (const groups of Object.values(kit.parts)) {
      expect(groups.reduce((sum, group) => sum + group.indices.length / 3, 0)).toBeLessThan(30000)
      for (const data of groups) {
        expect(data.positions.length).toBe(data.normals.length)
        expect(data.uv.length).toBe(data.positions.length / 3 * 2)
        expect(data.indices.every(i => i >= 0 && i < data.positions.length / 3)).toBe(true)
        expect(data.positions.every(Number.isFinite)).toBe(true)
        for (let i = 0; i < data.normals.length; i += 3) {
          expect(Math.hypot(data.normals[i]!, data.normals[i + 1]!, data.normals[i + 2]!)).toBeCloseTo(1, 3)
        }
      }
    }
  })
  it('shares immutable GPU geometry while keeping each instance transform independent', () => {
    const a = blenderBattleshipPart('hull'), b = blenderBattleshipPart('hull', 2)
    expect(a).not.toBe(b)
    expect((a.children[0] as THREE.Mesh).geometry).toBe((b.children[0] as THREE.Mesh).geometry)
    expect(a.scale.x).toBe(1); expect(b.scale.x).toBe(2)
    expect(new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3()).x).toBeCloseTo(kit.referenceLength, 1)
  })
  it('changes only capital-ship visuals and keeps custom positions and barrel counts', () => {
    for (const kind of ['destroyer', 'cruiser', 'battleship'] as const) {
      const entity = createInitialState(kind).entities.get('ship.player') as ShipEntity
      const before = JSON.stringify(entity)
      const config = combatShipPreviewConfig(entity)
      config.weapons = [{ id: 'test', name: 'custom-gun', type: 'gun', mount: { x: .35, y: .5 }, rotation: 65, barrels: 2, selected: true }]
      const ship = buildShip(config)
      expect(!!ship.getObjectByName('blender-hull')).toBe(kind === 'battleship')
      expect(!!ship.getObjectByName('blender-bridge')).toBe(kind === 'battleship')
      const gun = ship.getObjectByName('custom-gun')!
      expect(!!gun.getObjectByName('blender-turret')).toBe(kind === 'battleship')
      expect(gun.getObjectByName('gun-barrel-1')).toBeDefined()
      expect(gun.getObjectByName('gun-barrel-2')).toBeDefined()
      expect(gun.getObjectByName('gun-barrel-3')).toBeUndefined()
      if (kind === 'battleship') {
        expect(gun.getObjectByName('gun-barrel-1')!.userData['assetSource']).toBe('Blender')
        const barrelBounds = new THREE.Box3().setFromObject(blenderBattleshipPart('barrel'))
        expect(barrelBounds.min.z).toBeCloseTo(-1.25, 2)
      }
      expect(gun.position.x).toBeLessThan(0); expect(gun.position.z).toBeGreaterThan(0)
      expect(gun.rotation.y).toBeCloseTo(-Math.PI / 2 - 65 * Math.PI / 180)
      expect(JSON.stringify(entity)).toBe(before)
    }
  })
})
