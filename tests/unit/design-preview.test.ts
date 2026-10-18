import { describe, expect, it } from 'vitest'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { defaultHLGDesign, designLayoutFromHLG, HLG_PART_BY_ID, makeComponent, canPlaceHLGPart } from '../../src/designer/hlg-system'
import { COPY_PREVIEW_ID, previewDesignMove, sideDragCell, sideDragHeight } from '../../src/designer/design-preview'
import { initialDesignHistory, reduceDesignHistory } from '../../src/designer/design-history'

const hull = HULL_CATALOG.find(h => h.templateId === 'hull.battleship.basic')!
const design = defaultHLGDesign(hull)
const source = design.components.find(c => HLG_PART_BY_ID[c.partId]?.type === 'gun')!

describe('shared plan and elevation movement preview', () => {
  it('snaps vertical dragging to mount heights and previews without editing saved design', () => {
    expect(sideDragHeight(0, -20, 1000, 175)).toBe(4)
    expect(sideDragHeight(0, -10, 1000, 87.5)).toBe(4)
    expect(sideDragHeight(4, 20, 1000, 175)).toBe(0)
    expect(sideDragHeight(4, -200, 1000, 175)).toBe(8)
    expect(sideDragHeight(4, 10, 0, 0)).toBe(4)
    const before = JSON.stringify(design)
    const preview = previewDesignMove(design, { instanceId: source.instanceId, cell: source.cell, mountHeight: 6 })
    expect(preview.components.find(c => c.instanceId === source.instanceId)).toEqual({ ...source, mountHeight: 6 })
    expect(JSON.stringify(design)).toBe(before)
  })
  it('updates one shared drawing snapshot without changing saved cells, height or rotation', () => {
    const before = JSON.stringify(design), cell = { c: source.cell.c + 1, r: source.cell.r + 8 }
    const preview = previewDesignMove(design, { instanceId: source.instanceId, cell })
    const moved = preview.components.find(c => c.instanceId === source.instanceId)!
    expect(moved).toEqual({ ...source, cell })
    expect(designLayoutFromHLG(hull, preview).weapons.find(w => w.instanceId === source.instanceId)!.mount).not.toEqual(designLayoutFromHLG(hull, design).weapons.find(w => w.instanceId === source.instanceId)!.mount)
    cell.r++
    expect(moved.cell.r).toBe(source.cell.r + 8)
    expect(JSON.stringify(design)).toBe(before)
    expect(previewDesignMove(design, null)).toBe(design)
    expect(previewDesignMove(design, { instanceId: 'missing', cell })).toBe(design)
  })

  it('shows copies in both drawings while keeping the original in place', () => {
    const cell = { ...source.cell, r: source.cell.r + 10 }
    const preview = previewDesignMove(design, { instanceId: source.instanceId, cell, copying: true })
    expect(preview.components).toHaveLength(design.components.length + 1)
    expect(preview.components.find(c => c.instanceId === source.instanceId)!.cell).toEqual(source.cell)
    expect(preview.components.find(c => c.instanceId === COPY_PREVIEW_ID)).toEqual({ ...source, instanceId: COPY_PREVIEW_ID, cell })
  })

  it('projects side drags through SVG letterboxing while preserving lateral position', () => {
    const origin = { c: 12, r: 40 }
    expect(sideDragCell(origin, 100, 1000, 175, 200)).toEqual({ c: 12, r: 60 })
    expect(sideDragCell(origin, 50, 1000, 87.5, 200)).toEqual({ c: 12, r: 60 })
    expect(sideDragCell(origin, 100, 1000, 500, 200)).toEqual({ c: 12, r: 60 })
    expect(sideDragCell(origin, -10000, 1000, 175, 200).r).toBe(0)
    expect(sideDragCell(origin, 10000, 1000, 175, 200).r).toBe(199)
    expect(sideDragCell(origin, 10, 0, 0, 200)).toEqual(origin)
  })

  it('does not commit an invalid preview and records a completed drag as one undo step', () => {
    const part = HLG_PART_BY_ID[source.partId]!
    const blocker = makeComponent(part, { ...source.cell, r: source.cell.r + 12 }, source.rotation, source.weaponSlot)
    const base = { ...design, components: [source, blocker] }
    let history = initialDesignHistory(base)
    const invalid = previewDesignMove(history.present, { instanceId: source.instanceId, cell: blocker.cell })
    expect(invalid.components[0]!.cell).toEqual(blocker.cell)
    expect(canPlaceHLGPart(hull, { ...base, components: [blocker] }, part, blocker.cell, source.rotation, source.weaponSlot, source.mountHeight)).toBe(false)
    expect(history.present.components[0]!.cell).toEqual(source.cell)
    expect(history.past).toHaveLength(0)
    const final = previewDesignMove(base, { instanceId: source.instanceId, cell: { ...source.cell, r: source.cell.r + 1 } })
    history = reduceDesignHistory(history, { type: 'edit', update: final })
    expect(history.past).toHaveLength(1)
    expect(reduceDesignHistory(history, { type: 'undo' }).present).toEqual(base)
  })
})
