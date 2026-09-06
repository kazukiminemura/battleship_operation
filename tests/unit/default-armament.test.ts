import { describe, expect, it } from 'vitest'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { getDefaultLoadout } from '../../src/game/data/weapon-catalog'
import { createInitialState, createDebugState } from '../../src/game/data/masterdata'
import { defaultHLGDesign, validateHLGDesign, calculateHLGStats, hlgDesignToLoadout, previewWeaponsFromHLG, HLG_PART_BY_ID, findNearestValidCell, hlgGridSpec } from '../../src/designer/hlg-system'
import type { ShipEntity } from '../../src/game/simulation/types'

const expected = { destroyer: 10, cruiser: 14, battleship: 17 }
describe('complete standard armament', () => {
  it('fits all selectable hulls without overlap or lost weapon mounts', () => {
    for (const hull of HULL_CATALOG) {
      const design = defaultHLGDesign(hull)
      expect(validateHLGDesign(hull, design), hull.templateId).toEqual([])
      expect(previewWeaponsFromHLG(hull, design), hull.templateId).toHaveLength(expected[hull.shipType])
      const stats = calculateHLGStats(hull, design)
      expect(stats.totalWeight, hull.templateId).toBeLessThanOrEqual(stats.maxWeight)
      const actual = hlgDesignToLoadout(hull, design)
      const standard = getDefaultLoadout(hull.shipType)
      expect(actual.map(w => [w.id, w.mounts?.length, w.mounts?.map(m => m.barrels)])).toEqual(standard.map(w => [w.id, w.mounts?.length, w.mounts?.map(m => m.barrels)]))
    }
  })
  it('uses the richer standard in both ordinary and debug combat', () => {
    for (const kind of ['destroyer', 'cruiser', 'battleship'] as const) {
      for (const state of [createInitialState(kind), createDebugState(kind)]) {
        const player = state.entities.get('ship.player') as ShipEntity
        expect(player.weapons.reduce((sum, w) => sum + (w.mounts?.length ?? 1), 0)).toBe(expected[kind])
        expect(player.weapons.every(w => w.ammo > 0 && w.mounts?.every(m => m.firingArc))).toBe(true)
      }
    }
  })
  it('does not share mutable presets or overwrite explicit empty custom loadouts', () => {
    const first = getDefaultLoadout('battleship')
    first[0]!.mounts![0]!.mount!.x = 99
    expect(getDefaultLoadout('battleship')[0]!.mounts![0]!.mount!.x).toBe(0)
    expect((createInitialState('battleship', 1, []).entities.get('ship.player') as ShipEntity).weapons).toEqual([])
  })
  it('checks requested rotation and slot when finding placement for a new weapon kind', () => {
    const hull = HULL_CATALOG.find(h => h.shipType === 'battleship')!
    const design = defaultHLGDesign(hull), spec = hlgGridSpec(hull)
    const part = HLG_PART_BY_ID['part.weapon.weapon.aa.heavy']!
    expect(findNearestValidCell(hull, design, part, { c: spec.centerC, r: spec.topR + 25 }, 90, 6)).not.toBeNull()
    // Slot zero contains a different gun, so forcing AA into it must fail.
    expect(findNearestValidCell(hull, design, part, { c: spec.centerC, r: spec.topR + 25 }, 90, 0)).toBeNull()
  })
})
