import { isGunMount, normalizedMountHeight } from '../game/data/gun-mount-geometry'
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
export function makePlacementComponents(hull: HullCatalogEntry, design: HLGDesign, part: HLGPartDefinition, cell: HLGCell, rotation: HLGRotation, weaponSlot?: number, mirrored = true, mountHeight = 0) {
  mountHeight = isGunMount(part.type) ? normalizedMountHeight(mountHeight) : 0
  if (!canPlaceHLGPart(hull, design, part, cell, rotation, weaponSlot, mountHeight)) return []
  const components = [{ ...makeComponent(part, cell, rotation, weaponSlot), mountHeight }]
  const mirror = mirrored ? mirroredPlacementCell(hull, cell) : null
  if (mirror && canPlaceHLGPart(hull, { ...design, components: [...design.components, ...components] }, part, mirror, rotation, weaponSlot, mountHeight)) {
    components.push({ ...makeComponent(part, mirror, rotation, weaponSlot), mountHeight })
  }
  return components
}
