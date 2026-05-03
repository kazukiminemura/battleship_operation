import { describe, expect, it } from 'vitest'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import {
  HLG_PART_BY_ID,
  canPlaceHLGPart,
  calculateHLGStats,
  componentRect,
  defaultHLGDesign,
  hlgCellIsInsideHull,
  hlgDesignToLoadout,
  hlgGridSpec,
  makeComponent,
  migrateLegacyDesignerState,
  rotateFootprint,
  validateHLGDesign,
} from '../../src/designer/hlg-system'

const battleship = HULL_CATALOG.find(hull => hull.templateId === 'hull.battleship.basic')!

describe('freeform ship design system', () => {
  it('derives a ship hull mask from the freeform grid', () => {
    const spec = hlgGridSpec(battleship)
    expect(hlgCellIsInsideHull(battleship, { c: spec.centerC, r: spec.topR + 10 })).toBe(true)
    expect(hlgCellIsInsideHull(battleship, { c: 0, r: 0 })).toBe(false)
  })

  it('rotates component footprints for placement', () => {
    expect(rotateFootprint({ w: 4, h: 2 }, 0)).toEqual({ w: 4, h: 2 })
    expect(rotateFootprint({ w: 4, h: 2 }, 90)).toEqual({ w: 2, h: 4 })
  })

  it('uses odd footprints so components can sit exactly on the centerline', () => {
    const spec = hlgGridSpec(battleship)
    const part = HLG_PART_BY_ID['part.weapon.weapon.gun.406mm.twin']!
    const component = makeComponent(part, { c: spec.centerC, r: spec.topR + 40 }, 0)
    const rect = componentRect(component, part)
    expect(part.footprint.w % 2).toBe(1)
    expect(part.footprint.h % 2).toBe(1)
    expect(rect.left + rect.w / 2).toBe(spec.centerC + 0.5)
    expect(Number.isInteger(rect.left)).toBe(true)
  })

  it('rejects overlapping components', () => {
    const part = HLG_PART_BY_ID['part.weapon.weapon.gun.406mm.twin']!
    const design = {
      ...defaultHLGDesign(battleship),
      components: [makeComponent(part, { c: hlgGridSpec(battleship).centerC, r: 16 }, 0)],
    }
    expect(canPlaceHLGPart(battleship, design, part, { c: hlgGridSpec(battleship).centerC, r: 16 }, 0)).toBe(false)
  })

  it('allows deck equipment to be placed above internal machinery', () => {
    const spec = hlgGridSpec(battleship)
    const boiler = HLG_PART_BY_ID['part.boiler.heavy']!
    const gun = HLG_PART_BY_ID['part.weapon.weapon.gun.406mm.twin']!
    const design = {
      ...defaultHLGDesign(battleship),
      components: [makeComponent(boiler, { c: spec.centerC, r: spec.topR + 90 }, 0)],
    }
    expect(canPlaceHLGPart(battleship, design, gun, { c: spec.centerC, r: spec.topR + 90 }, 0)).toBe(true)
  })

  it('still rejects overlapping internal machinery', () => {
    const spec = hlgGridSpec(battleship)
    const boiler = HLG_PART_BY_ID['part.boiler.heavy']!
    const turbine = HLG_PART_BY_ID['part.turbine.heavy']!
    const design = {
      ...defaultHLGDesign(battleship),
      components: [makeComponent(boiler, { c: spec.centerC, r: spec.topR + 90 }, 0)],
    }
    expect(canPlaceHLGPart(battleship, design, turbine, { c: spec.centerC, r: spec.topR + 90 }, 0)).toBe(false)
  })

  it('reports invalid zone placement', () => {
    const part = HLG_PART_BY_ID['part.boiler.heavy']!
    const spec = hlgGridSpec(battleship)
    const component = makeComponent(part, { c: spec.centerC, r: spec.topR + 2 }, 0)
    const design = { ...defaultHLGDesign(battleship), components: [component] }
    expect(validateHLGDesign(battleship, design).some(warning => warning.includes('配置区画'))).toBe(true)
  })

  it('calculates weight, propulsion, exhaust and deployment readiness', () => {
    const design = defaultHLGDesign(battleship)
    const stats = calculateHLGStats(battleship, design)
    expect(stats.totalWeight).toBeGreaterThan(0)
    expect(stats.powerProvided).toBeGreaterThan(0)
    expect(stats.smokeProvided).toBeGreaterThanOrEqual(stats.smokeRequired)
    expect(stats.canDeploy).toBe(true)
  })

  it('converts each placed weapon to an individual combat template', () => {
    const design = defaultHLGDesign(battleship)
    const loadout = hlgDesignToLoadout(battleship, design)
    const weaponComponents = design.components.filter(component => HLG_PART_BY_ID[component.partId]?.type)
    expect(loadout).toHaveLength(weaponComponents.length)
    expect(loadout.every(weapon => weapon.instanceId && weapon.mount)).toBe(true)
  })

  it('migrates legacy slot assignments into HLG components', () => {
    const migrated = migrateLegacyDesignerState(battleship, {
      design: {
        s0: { weaponId: 'weapon.gun.406mm.twin', barrels: 2 },
        s1: { weaponId: 'weapon.gun.406mm.he', barrels: 2 },
      },
      layout: { slotCells: {} },
    })
    const rects = migrated.components
      .map(component => {
        const part = HLG_PART_BY_ID[component.partId]
        return part ? componentRect(component, part) : null
      })
      .filter(Boolean)
    expect(migrated.components.some(component => component.partId === 'part.weapon.weapon.gun.406mm.twin')).toBe(true)
    expect(rects.length).toBeGreaterThan(0)
  })
})
