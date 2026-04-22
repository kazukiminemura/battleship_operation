import { describe, expect, it } from 'vitest'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { buildPlacements, footprintRect, gridSpec, hullDimensions } from '../../src/game/ui/prep-layout'
import { WEAPON_SHOP } from '../../src/game/data/weapon-shop'

describe('prep layout', () => {
  it('derives blueprint dimensions from hull scale', () => {
    const battleship = HULL_CATALOG.find(h => h.templateId === 'hull.battleship.basic')!
    const destroyer = HULL_CATALOG.find(h => h.templateId === 'hull.destroyer.basic')!

    expect(hullDimensions(battleship).lengthM).toBeGreaterThan(hullDimensions(destroyer).lengthM)
    expect(gridSpec(battleship).lengthCells).toBeGreaterThan(gridSpec(destroyer).lengthCells)
  })

  it('centers even-width weapons on the centerline', () => {
    const hull = HULL_CATALOG.find(h => h.templateId === 'hull.battleship.basic')!
    const spec = gridSpec(hull)
    const mainGun = WEAPON_SHOP.find(w => w.id === 'weapon.gun.406mm.twin.forward')!
    const slotWeapons = new Map([[hull.slots[0]!.id, mainGun]])
    const placements = buildPlacements(hull, spec, slotWeapons, new Map(), null)
    const gun = placements.find(p => p.id === hull.slots[0]!.id)!
    const rect = footprintRect({ c: spec.centerC, r: gun.cell.r }, gun.footprint)
    const centerX = rect.left + rect.w / 2

    expect(centerX).toBe(spec.centerC + 0.5)
  })
})
