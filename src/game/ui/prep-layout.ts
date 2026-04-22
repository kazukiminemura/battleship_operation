import type { HullCatalogEntry, HullSlot } from '../data/hull-catalog'
import { TYPE_COLOR, TYPE_JP, type ShopWeapon } from '../data/weapon-shop'

export const GRID_CELL_METERS = 2.5
const GRID_MARGIN_CELLS = 2
const MAX_SLOT_MOVE_METERS = 18
const EMPTY_SLOT_COLOR = '#3a6a42'

export type ComponentKind = 'weapon' | 'tower'
export type Footprint = { w: number; h: number }
export type GridCell = { c: number; r: number }
export type FootprintRect = { left: number; top: number; w: number; h: number }
export type MoveTargetState = 'none' | 'far' | 'valid'

export type GridSpec = {
  cols: number
  rows: number
  lengthM: number
  beamM: number
  lengthCells: number
  beamCells: number
  centerC: number
  topR: number
}

export type Placement = {
  id: string
  kind: ComponentKind
  label: string
  cell: GridCell
  footprint: Footprint
  color: string
  slot?: HullSlot
  weapon?: ShopWeapon
}

export function cellToMount(c: number, r: number, spec: GridSpec): { x: number; y: number } {
  const x = (cellCenter(c) - cellCenter(spec.centerC)) / (spec.beamCells / 2)
  const y = ((cellCenter(r) - spec.topR) / Math.max(1, spec.lengthCells - 1)) * 2 - 1
  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(-1, Math.min(1, y)),
  }
}

export function cellCenter(index: number): number {
  return index + 0.5
}

export function hullDimensions(hull: HullCatalogEntry): { lengthM: number; beamM: number } {
  switch (hull.templateId) {
    case 'hull.destroyer.basic': return { lengthM: 118, beamM: 10.8 }
    case 'hull.dd.improved': return { lengthM: 126, beamM: 11.4 }
    case 'hull.dd.elite': return { lengthM: 134, beamM: 12.0 }
    case 'hull.cruiser.player': return { lengthM: 174, beamM: 16.5 }
    case 'hull.cl.heavy': return { lengthM: 203, beamM: 20.5 }
    case 'hull.ca.elite': return { lengthM: 214, beamM: 21.8 }
    case 'hull.bb.fast': return { lengthM: 247, beamM: 33.0 }
    case 'hull.bb.super': return { lengthM: 263, beamM: 38.9 }
    case 'hull.battleship.basic':
    default:
      return hull.shipType === 'battleship' ? { lengthM: 242, beamM: 32.0 }
        : hull.shipType === 'cruiser' ? { lengthM: 190, beamM: 19.0 }
        : { lengthM: 120, beamM: 11.0 }
  }
}

export function gridSpec(hull: HullCatalogEntry): GridSpec {
  const { lengthM, beamM } = hullDimensions(hull)
  const lengthCells = Math.ceil(lengthM / GRID_CELL_METERS)
  const beamCells = beamM / GRID_CELL_METERS
  const cols = makeOdd(Math.max(9, Math.ceil(beamCells) + GRID_MARGIN_CELLS * 2))
  const rows = lengthCells + GRID_MARGIN_CELLS * 2
  return {
    cols,
    rows,
    lengthM,
    beamM,
    lengthCells,
    beamCells,
    centerC: Math.floor(cols / 2),
    topR: GRID_MARGIN_CELLS,
  }
}

export function slotCell(slot: HullSlot, spec: GridSpec): GridCell {
  const c = Math.round(spec.centerC + slot.x * (spec.beamCells / 2) * 0.92)
  const r = Math.round(spec.topR + ((slot.y + 1) / 2) * (spec.lengthCells - 1))
  return {
    c: Math.max(0, Math.min(spec.cols - 1, c)),
    r: Math.max(0, Math.min(spec.rows - 1, r)),
  }
}

export function defaultTowerCell(hull: HullCatalogEntry, spec = gridSpec(hull)): GridCell {
  const y = hull.shipType === 'destroyer' ? -0.25 : hull.shipType === 'cruiser' ? 0.25 : -0.02
  return slotCell({ id: 'tower', label: '管制塔', x: 0, y, compatibleTypes: [] }, spec)
}

export function towerFootprint(hull: HullCatalogEntry): Footprint {
  return hull.shipType === 'battleship' ? { w: 4, h: 5 }
    : hull.shipType === 'cruiser' ? { w: 3, h: 4 }
    : { w: 3, h: 3 }
}

export function weaponFootprint(weapon: ShopWeapon | undefined, slot: HullSlot): Footprint {
  const id = weapon?.id ?? ''
  const type = weapon?.type ?? slot.compatibleTypes[0]
  if (type === 'gun') {
    if (id.includes('460mm')) return { w: 5, h: 4 }
    if (id.includes('406mm')) return { w: 4, h: 3 }
    if (id.includes('203mm')) return { w: 3, h: 3 }
    if (id.includes('152mm')) return { w: 3, h: 2 }
    return { w: 2, h: 2 }
  }
  if (type === 'secondary') return id.includes('152mm') ? { w: 3, h: 2 } : { w: 2, h: 1 }
  if (type === 'torpedo') return id.includes('610mm') ? { w: 4, h: 1 } : { w: 3, h: 1 }
  if (type === 'missile') return id.includes('longrange') || id.includes('cruise') ? { w: 3, h: 3 } : { w: 2, h: 2 }
  if (type === 'aa') return id.includes('ciws') || id.includes('20mm') ? { w: 1, h: 1 } : { w: 2, h: 2 }
  return { w: 2, h: 2 }
}

export function buildPlacements(
  hull: HullCatalogEntry,
  spec: GridSpec,
  slotWeapons: ReadonlyMap<string, ShopWeapon>,
  slotCells: ReadonlyMap<string, GridCell>,
  towerCell: GridCell | null,
): Placement[] {
  const placements: Placement[] = [{
    id: 'tower',
    kind: 'tower',
    label: '管制塔',
    cell: towerCell ?? defaultTowerCell(hull, spec),
    footprint: towerFootprint(hull),
    color: '#d6b86a',
  }]

  for (const slot of hull.slots) {
    const weapon = slotWeapons.get(slot.id)
    placements.push({
      id: slot.id,
      kind: 'weapon',
      label: weapon ? TYPE_JP[weapon.type] : slot.label,
      cell: currentSlotCell(slot, spec, slotCells),
      footprint: weaponFootprint(weapon, slot),
      color: weapon ? (TYPE_COLOR[weapon.type] ?? EMPTY_SLOT_COLOR) : EMPTY_SLOT_COLOR,
      slot,
      weapon,
    })
  }
  return placements
}

export function currentSlotCell(slot: HullSlot, spec: GridSpec, slotCells: ReadonlyMap<string, GridCell>): GridCell {
  return slotCells.get(slot.id) ?? slotCell(slot, spec)
}

export function hullMaxHalfWidth(ny: number): number {
  if (ny < -0.82) return Math.max(0.02, (ny + 1) / 0.18 * 0.38)
  if (ny < -0.48) return 0.38 + (ny + 0.82) / 0.34 * 0.62
  if (ny < 0.50) return 1.0 - Math.abs(ny - 0.02) * 0.07
  if (ny < 0.86) return 0.94 - (ny - 0.50) / 0.36 * 0.20
  return 0.74 - (ny - 0.86) / 0.14 * 0.18
}

export function moveTargetState(
  hull: HullCatalogEntry,
  c: number,
  r: number,
  placements: readonly Placement[],
  spec: GridSpec,
  selected: { slotId: string | null; tower: boolean },
): MoveTargetState {
  if (!isInsideHullCell(c, r, spec)) return 'none'
  if (selected.tower) return canMoveTowerTo(c, r, hull, placements, spec) ? 'valid' : 'far'
  const slot = hull.slots.find(s => s.id === selected.slotId)
  if (!slot) return 'none'
  return canMoveSlotTo(slot, c, r, hull, placements, spec) ? 'valid' : 'far'
}

export function canMoveSlotTo(
  slot: HullSlot,
  c: number,
  r: number,
  _hull: HullCatalogEntry,
  placements: readonly Placement[],
  spec: GridSpec,
): boolean {
  if (!isInsideHullCell(c, r, spec)) return false
  const home = slotCell(slot, spec)
  const dc = c - home.c
  const dr = r - home.r
  if (Math.sqrt(dc * dc + dr * dr) * GRID_CELL_METERS > MAX_SLOT_MOVE_METERS) return false
  const existing = placements.find(p => p.id === slot.id && p.kind === 'weapon')
  if (!existing) return false
  return canPlaceFootprint({ c, r }, existing.footprint, placements, slot.id, spec)
}

export function canMoveTowerTo(
  c: number,
  r: number,
  hull: HullCatalogEntry,
  placements: readonly Placement[],
  spec: GridSpec,
): boolean {
  const home = defaultTowerCell(hull, spec)
  const dc = c - home.c
  const dr = r - home.r
  if (Math.sqrt(dc * dc + dr * dr) * GRID_CELL_METERS > MAX_SLOT_MOVE_METERS) return false
  return canPlaceFootprint({ c, r }, towerFootprint(hull), placements, 'tower', spec)
}

export function isInsideHullCell(c: number, r: number, spec: GridSpec): boolean {
  const nx = (cellCenter(c) - cellCenter(spec.centerC)) / (spec.beamCells / 2)
  const ny = ((cellCenter(r) - spec.topR) / Math.max(1, spec.lengthCells - 1)) * 2 - 1
  if (ny < -1 || ny > 1) return false
  return Math.abs(nx) <= hullMaxHalfWidth(ny) * 0.98
}

export function canPlaceFootprint(
  cell: GridCell,
  footprint: Footprint,
  placements: readonly Placement[],
  ignoreId: string,
  spec: GridSpec,
): boolean {
  const rect = footprintRect(cell, footprint)
  for (let r = Math.floor(rect.top); r < Math.ceil(rect.top + rect.h); r++) {
    for (let c = Math.floor(rect.left); c < Math.ceil(rect.left + rect.w); c++) {
      if (c < 0 || c >= spec.cols || r < 0 || r >= spec.rows || !isInsideHullCell(c, r, spec)) return false
    }
  }

  for (const placement of placements) {
    if (placement.id === ignoreId) continue
    if (rectsOverlap(rect, footprintRect(placement.cell, placement.footprint))) return false
  }
  return true
}

export function occupiedCells(placements: readonly Placement[]): Set<string> {
  const cells = new Set<string>()
  for (const placement of placements) {
    const rect = footprintRect(placement.cell, placement.footprint)
    for (let r = Math.floor(rect.top); r < Math.ceil(rect.top + rect.h); r++) {
      for (let c = Math.floor(rect.left); c < Math.ceil(rect.left + rect.w); c++) cells.add(cellKey(c, r))
    }
  }
  return cells
}

export function footprintRect(cell: GridCell, footprint: Footprint): FootprintRect {
  return {
    left: cellCenter(cell.c) - footprint.w / 2,
    top: cellCenter(cell.r) - footprint.h / 2,
    w: footprint.w,
    h: footprint.h,
  }
}

export function rectsOverlap(a: FootprintRect, b: FootprintRect): boolean {
  return a.left < b.left + b.w && a.left + a.w > b.left && a.top < b.top + b.h && a.top + a.h > b.top
}

export function cellKey(c: number, r: number): string {
  return `${c},${r}`
}

function makeOdd(value: number): number {
  return value % 2 === 0 ? value + 1 : value
}
