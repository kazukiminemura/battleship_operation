import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { DESIGN_CELL_METERS, normalizedMountHeight } from '../../src/game/data/gun-mount-geometry'
import { barrelsInterfere, gunClearance } from '../../src/designer/gun-clearance'
import { canPlaceHLGPart, defaultHLGDesign, designLayoutFromHLG, hlgDesignToLoadout, hlgGridSpec, HLG_PART_BY_ID, makeComponent, normalizeHLGDesign, validateHLGDesign } from '../../src/designer/hlg-system'
import { makePlacementComponents } from '../../src/designer/design-placement'
import { createInitialState } from '../../src/game/data/masterdata'
import type { ShipEntity } from '../../src/game/simulation/types'
import { combatShipPreviewConfig } from '../../src/game/rendering/combat-ship-config'
import { buildShip } from '../../src/game/rendering/three-ship-designer-renderer'

const hull = HULL_CATALOG.find(h => h.templateId === 'hull.battleship.basic')!
const gun = HLG_PART_BY_ID['part.weapon.weapon.gun.406mm.twin']!
const spec = hlgGridSpec(hull)
const front = makeComponent(gun, { c: spec.centerC, r: 70 }, 0, 0)
const rear = makeComponent(gun, { c: spec.centerC, r: 88 }, 0, 0)
const blank = { ...defaultHLGDesign(hull), components: [] }

describe('height-aware gun clearance', () => {
  it('rejects barrel contact beyond a non-overlapping turret footprint and accepts superfiring clearance', () => {
    const design = { ...blank, components: [front] }
    expect(canPlaceHLGPart(hull, blank, gun, front.cell, 0, 0)).toBe(true)
    expect(canPlaceHLGPart(hull, blank, gun, rear.cell, 0, 0)).toBe(true)
    expect(canPlaceHLGPart(hull, design, gun, rear.cell, 0, 0, 0)).toBe(false)
    expect(canPlaceHLGPart(hull, design, gun, rear.cell, 0, 0, 4)).toBe(true)
    expect(validateHLGDesign(hull, { ...blank, components: [front, rear] }).some(w => w.includes('砲身'))).toBe(true)
    expect(validateHLGDesign(hull, { ...blank, components: [front, { ...rear, mountHeight: 4 }] })).toEqual([])
    // A low rear gun cannot shoot through the pedestal of a raised front turret.
    expect(barrelsInterfere(gunClearance({ ...front, mountHeight: 4 }, gun), gunClearance(rear, gun))).toBe(true)
  })

  it('detects crossing barrels, and respects all four placement directions', () => {
    const small = { ...gun, footprint: { w: 1, h: 1 }, barrels: 1 }
    const a = makeComponent(small, { c: 10, r: 20 }, 0, 0)
    const b = makeComponent(small, { c: 4, r: 14 }, 90, 0)
    const ca = gunClearance(a, small), cb = gunClearance(b, small)
    expect(barrelsInterfere({ body: null, barrels: ca.barrels }, { body: null, barrels: cb.barrels })).toBe(true)
    expect(barrelsInterfere(gunClearance({ ...a, mountHeight: 4 }, small), cb)).toBe(false)
    for (const rotation of [0, 90, 180, 270] as const) {
      const delta = rotation === 0 ? { c: 0, r: -10 } : rotation === 90 ? { c: 10, r: 0 } : rotation === 180 ? { c: 0, r: 10 } : { c: -10, r: 0 }
      const target = makeComponent(small, { c: a.cell.c + delta.c, r: a.cell.r + delta.r }, rotation, 0)
      expect(barrelsInterfere(gunClearance({ ...a, rotation }, small), gunClearance(target, small))).toBe(true)
    }
  })

  it('keeps tall structures blocked and ignores machinery below deck', () => {
    const bridge = HLG_PART_BY_ID['part.bridge.bb']!, boiler = HLG_PART_BY_ID['part.boiler.heavy']!
    const raised = gunClearance({ ...rear, mountHeight: 8 }, gun)
    expect(barrelsInterfere(raised, gunClearance({ ...front, partId: bridge.partId }, bridge))).toBe(true)
    expect(barrelsInterfere(raised, gunClearance({ ...front, partId: boiler.partId }, boiler))).toBe(false)
    expect(canPlaceHLGPart(hull, { ...blank, components: [front] }, gun, front.cell, 0, 0, 8)).toBe(false)
  })

  it('preserves mount height through symmetric placement, save normalization and launch', () => {
    const aa = Object.values(HLG_PART_BY_ID).find(p => p.type === 'aa' && p.allowedShipClasses.includes('battleship'))!
    const pair = makePlacementComponents(hull, blank, aa, { c: spec.centerC - 7, r: 80 }, 0, 0, true, 6)
    expect(pair).toHaveLength(2)
    expect(pair.map(p => p.mountHeight)).toEqual([6, 6])
    const legacy = normalizeHLGDesign(hull, { ...blank, components: [front] })
    expect(normalizedMountHeight(legacy.components[0]!.mountHeight)).toBe(0)
    expect([undefined, NaN, Infinity, -4, 3, 20].map(normalizedMountHeight)).toEqual([0, 0, 0, 0, 4, 8])
    const design = { ...blank, components: [front, { ...rear, mountHeight: 4 }] }
    const layout = designLayoutFromHLG(hull, design), loadout = hlgDesignToLoadout(hull, design)
    expect(loadout[0]!.mounts!.map(m => m.mountHeight)).toEqual([0, 4])
    const state = createInitialState('battleship', 1, loadout, hull.templateId, 0, undefined, layout)
    const entity = state.entities.get('ship.player') as ShipEntity
    expect(entity.weapons[0]!.mounts!.map(m => m.mountHeight)).toEqual([0, 4])
    const config = combatShipPreviewConfig(entity)
    expect(config.weapons.map(w => w.mountHeight)).toEqual([0, 4])
    const raisedModel = buildShip(config)
    const lowerModel = buildShip({ ...config, weapons: config.weapons.map(w => ({ ...w, mountHeight: 0 })) })
    const raisedMount = raisedModel.children.find(p => p.userData['designInstanceId'] === rear.instanceId)!
    const lowerMount = lowerModel.children.find(p => p.userData['designInstanceId'] === rear.instanceId)!
    const lengthUnits = Number(raisedModel.userData['waterlineLength']) * .84 / ((spec.lengthCells - 1) * DESIGN_CELL_METERS)
    expect(raisedMount.position.y - lowerMount.position.y).toBeCloseTo(4 * lengthUnits)
    expect(raisedModel.getObjectByName(`gun-pedestal-${rear.instanceId}`)).toBeDefined()
    const barrel = raisedMount.getObjectByName('gun-barrel-1') as THREE.Mesh
    const g = config.weapons[1]!.gunGeometry!
    expect(-barrel.position.z).toBeCloseTo((g.barrelRoot + g.barrelLength / 2) * lengthUnits)
    expect(barrel.position.y).toBeCloseTo(g.barrelHeight * lengthUnits)
    expect(g.barrelLength).toBeCloseTo(.406 * 45)
  })
})
