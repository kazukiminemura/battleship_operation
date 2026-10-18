import { describe, expect, it } from 'vitest'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { calculateHLGStats, defaultHLGDesign, hlgDesignToLoadout, HLG_PARTS, hlgGridSpec, canPlaceHLGPart, type HLGCell } from '../../src/designer/hlg-system'
import { initialDesignHistory, reduceDesignHistory } from '../../src/designer/design-history'
import { makePlacementComponents, mirroredPlacementCell } from '../../src/designer/design-placement'

const hull = HULL_CATALOG.find(h => h.templateId === 'hull.battleship.basic')!
const part = HLG_PARTS.find(p => p.type === 'aa' && p.allowedShipClasses.includes('battleship'))!

function placementFixture() {
  const design = { ...defaultHLGDesign(hull), components: [] }
  const spec = hlgGridSpec(hull)
  for (const ratio of [.35, .5, .65]) for (let c = spec.centerC - 2; c > 0; c--) {
    const cell: HLGCell = { c, r: Math.round(spec.topR + spec.lengthCells * ratio) }
    const pair = makePlacementComponents(hull, design, part, cell, 0, 0, true)
    if (pair.length === 2) return { design, cell, pair }
  }
  throw new Error('No legal mirrored AA placement')
}

describe('drafting workbench edits', () => {
  it('toggles symmetric placement and keeps both mounts in the same combat slot', () => {
    const { design, cell, pair } = placementFixture()
    expect(pair[1]!.cell).toEqual(mirroredPlacementCell(hull, cell))
    expect(new Set(pair.map(p => p.instanceId)).size).toBe(2)
    expect(pair.map(p => p.weaponSlot)).toEqual([0, 0])
    const loadout = hlgDesignToLoadout(hull, { ...design, components: pair })
    expect(loadout).toHaveLength(1)
    expect(loadout[0]!.mounts).toHaveLength(2)
    expect(makePlacementComponents(hull, design, part, cell, 0, 0, false)).toHaveLength(1)
    const blockedMirror = { ...design, components: [pair[1]!] }
    expect(makePlacementComponents(hull, blockedMirror, part, cell, 0, 0, true)).toHaveLength(1)
    expect(makePlacementComponents(hull, { ...design, components: pair }, part, cell, 0, 0, true)).toEqual([])
    const center = { ...cell, c: hlgGridSpec(hull).centerC }
    expect(canPlaceHLGPart(hull, design, part, center, 0, 0)).toBe(true)
    expect(makePlacementComponents(hull, design, part, center, 0, 0, true)).toHaveLength(1)
  })

  it('undoes a mirrored pair atomically and restores actual weight, armor and combat loadout', () => {
    const { design, pair } = placementFixture()
    let history = initialDesignHistory(design)
    history = reduceDesignHistory(history, { type: 'edit', update: { ...design, components: pair } })
    const armed = history.present
    history = reduceDesignHistory(history, { type: 'undo' })
    expect(history.present.components).toHaveLength(0)
    expect(hlgDesignToLoadout(hull, history.present)).toHaveLength(0)
    history = reduceDesignHistory(history, { type: 'redo' })
    expect(hlgDesignToLoadout(hull, history.present)).toEqual(hlgDesignToLoadout(hull, armed))
    expect(design.components).toHaveLength(0)
    const complete = defaultHLGDesign(hull)
    const originalStats = calculateHLGStats(hull, complete)
    history = initialDesignHistory(complete)
    history = reduceDesignHistory(history, { type: 'edit', update: previous => ({ ...previous, armorPlan: { ...previous.armorPlan, belt: '61cm' } }) })
    expect(calculateHLGStats(hull, history.present).totalWeight).toBeGreaterThan(originalStats.totalWeight)
    history = reduceDesignHistory(history, { type: 'undo' })
    expect(calculateHLGStats(hull, history.present)).toEqual(originalStats)
    expect(hlgDesignToLoadout(hull, history.present)).toEqual(hlgDesignToLoadout(hull, complete))
  })

  it('drops redo after a new edit and resets history on a hull change', () => {
    const initial = defaultHLGDesign(hull)
    let history = initialDesignHistory(initial)
    const snapshot = JSON.stringify(initial)
    for (let i = 1; i <= 50; i++) history = reduceDesignHistory(history, { type: 'edit', update: previous => ({ ...previous, armorPlan: { ...previous.armorPlan, bulkhead: i } }) })
    expect(history.past).toHaveLength(40)
    history = reduceDesignHistory(history, { type: 'undo' })
    expect(history.future).toHaveLength(1)
    history = reduceDesignHistory(history, { type: 'edit', update: previous => ({ ...previous, armorPlan: { ...previous.armorPlan, bulkhead: 0 } }) })
    expect(history.future).toHaveLength(0)
    const otherHull = HULL_CATALOG.find(h => h.shipType === 'destroyer')!
    history = reduceDesignHistory(history, { type: 'reset', design: defaultHLGDesign(otherHull) })
    expect(reduceDesignHistory(history, { type: 'undo' }).present.hullTemplateId).toBe(otherHull.templateId)
    expect(history.past).toHaveLength(0)
    expect(JSON.stringify(initial)).toBe(snapshot)
  })

})
