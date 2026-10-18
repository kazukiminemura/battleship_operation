import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { canPlaceHLGPart, hlgGridSpec, makeComponent, type HLGCell, type HLGDesign, type HLGPartDefinition, type HLGRotation } from './hlg-system'

export function designerLayerForPart(part: HLGPartDefinition): 'internal' | 'deck' {
  return part.category === 'boiler' || part.category === 'turbine' ? 'internal' : 'deck'
}

export function mirroredPlacementCell(hull: HullCatalogEntry, cell: HLGCell): HLGCell | null {
  const spec = hlgGridSpec(hull)
  if (cell.c === spec.centerC) return null
  const c = spec.centerC * 2 - cell.c
  return c >= 0 && c < spec.cols ? { c, r: cell.r } : null
}

/** A mirrored pair is one edit and shares its selected combat weapon slot. */
export function makePlacementComponents(hull: HullCatalogEntry, design: HLGDesign, part: HLGPartDefinition, cell: HLGCell, rotation: HLGRotation, weaponSlot?: number, mirrored = true) {
  if (!canPlaceHLGPart(hull, design, part, cell, rotation, weaponSlot)) return []
  const components = [makeComponent(part, cell, rotation, weaponSlot)]
  const mirror = mirrored ? mirroredPlacementCell(hull, cell) : null
  if (mirror && canPlaceHLGPart(hull, { ...design, components: [...design.components, ...components] }, part, mirror, rotation, weaponSlot)) {
    components.push(makeComponent(part, mirror, rotation, weaponSlot))
  }
  return components
}
