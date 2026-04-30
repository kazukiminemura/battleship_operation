import { getHullsByClass } from '../game/data/hull-catalog'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { PlayerShipType } from '../game/data/masterdata'
import type { PrepResult } from '../game/ui/prepscreen'
import { buildPlacements, defaultTowerCell, gridSpec, type GridCell, type Placement } from '../game/ui/prep-layout'
import { createDesignEntry, designWeaponId, loadDesign, WEAPONS } from './data'
import type { Design, DesignLayout } from './types'

export type PlacementSelection = { kind: 'weapon'; slotId: string } | { kind: 'tower' } | null

export function hullIndexForTemplate(shipType: PlayerShipType, templateId: string): number {
  const hulls = getHullsByClass(shipType)
  return Math.max(0, hulls.findIndex(h => h.templateId === templateId))
}

export function designFromPrepResult(result: PrepResult): Design {
  const hull = getHullsByClass(result.shipType).find(h => h.templateId === result.templateId)
  if (!hull) return loadDesign()

  const design: Design = {}
  for (let i = 0; i < hull.slots.length; i++) {
    const slot = hull.slots[i]!
    const weapon = result.loadout[i]
    if (!weapon || !slot.compatibleTypes.includes(weapon.type)) continue
    design[slot.id] = createDesignEntry(weapon.id, weapon.barrels)
  }
  return sanitizeDesignForHull(design, hull)
}

export function layoutFromPrepResult(result: PrepResult): DesignLayout {
  const hull = getHullsByClass(result.shipType).find(h => h.templateId === result.templateId)
  if (!hull) return emptyLayoutForHull(null)
  return sanitizeLayoutForHull({
    slotCells: result.slotCells ?? {},
    towerCell: result.towerCell ?? null,
  }, hull)
}

export function sanitizeDesignForHull(design: Design, hull: HullCatalogEntry): Design {
  const next: Design = {}
  for (const slot of hull.slots) {
    const entry = design[slot.id]
    const weaponId = designWeaponId(entry)
    const weapon = WEAPONS.find(w => w.id === weaponId)
    if (weapon && slot.compatibleTypes.includes(weapon.type)) {
      next[slot.id] = createDesignEntry(weapon.id, typeof entry === 'string' ? undefined : entry?.barrels)
    }
  }
  return next
}

export function sanitizeLayoutForHull(layout: DesignLayout, hull: HullCatalogEntry): DesignLayout {
  const validSlotIds = new Set(hull.slots.map(slot => slot.id))
  const slotCells: Record<string, GridCell> = {}
  const spec = gridSpec(hull)
  for (const [slotId, cell] of Object.entries(layout.slotCells ?? {})) {
    if (!validSlotIds.has(slotId)) continue
    if (!isGridCell(cell, spec.cols, spec.rows)) continue
    slotCells[slotId] = { c: cell.c, r: cell.r }
  }
  const towerCell = isGridCell(layout.towerCell, spec.cols, spec.rows) ? { c: layout.towerCell.c, r: layout.towerCell.r } : null
  return { slotCells, towerCell }
}

export function emptyLayoutForHull(hull: HullCatalogEntry | null): DesignLayout {
  if (!hull) return { slotCells: {}, towerCell: null }
  const spec = gridSpec(hull)
  const towerCell = defaultTowerCell(hull, spec)
  return { slotCells: {}, towerCell }
}

export function buildDesignerPlacements(hull: HullCatalogEntry, design: Design, layout: DesignLayout): Placement[] {
  const spec = gridSpec(hull)
  const slotWeapons = new Map()
  for (const slot of hull.slots) {
    const weaponId = designWeaponId(design[slot.id])
    const weapon = weaponId ? WEAPONS.find(w => w.id === weaponId) : undefined
    if (!weapon) continue
    slotWeapons.set(slot.id, {
      id: weapon.id,
      name: weapon.name,
      type: weapon.type,
      ammo: 0,
      desc: '',
      cost: 0,
      minStage: 1,
    })
  }
  return buildPlacements(hull, spec, slotWeapons, new Map(Object.entries(layout.slotCells)), layout.towerCell)
}

export function collisionWarningText(placements: Placement[], collisionIds: Set<string>): string | null {
  if (collisionIds.size === 0) return null
  const labels = placements
    .filter(placement => collisionIds.has(placement.id))
    .map(placement => placement.kind === 'tower' ? '艦橋' : placement.label)
  const uniqueLabels = [...new Set(labels)]
  return `配置が物理的に重なっています: ${uniqueLabels.join(' / ')}。重なりを解消するまで出撃できません。`
}

export function weaponScore(weapon: { firepower?: number; antiAir?: number; accuracy: number; reload: number }): number {
  const firepower = weapon.firepower ?? 0
  const antiAir = weapon.antiAir ?? 0
  return (firepower * 2.2 + antiAir * 1.6) * weapon.accuracy / Math.max(0.3, weapon.reload)
}

function isGridCell(value: unknown, cols: number, rows: number): value is GridCell {
  if (!value || typeof value !== 'object') return false
  const cell = value as GridCell
  return Number.isInteger(cell.c) && Number.isInteger(cell.r) && cell.c >= 0 && cell.r >= 0 && cell.c < cols && cell.r < rows
}
