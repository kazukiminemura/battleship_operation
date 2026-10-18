import { DESIGN_CELL_METERS, gunMountGeometry, isGunMount, normalizedMountHeight } from '../game/data/gun-mount-geometry'
import type { HLGComponentInstance, HLGPartDefinition } from './hlg-system'

interface Box { x: number; y: number; z: number; w: number; l: number; h: number }
export interface GunClearance { body: Box | null; barrels: Box[] }
const SAFETY_MARGIN = .12

export function componentGunGeometry(part: HLGPartDefinition) {
  return part.type && isGunMount(part.type) ? gunMountGeometry(part.partId.replace('part.weapon.', ''), part.type, part.footprint.h * DESIGN_CELL_METERS, part.footprint.w * DESIGN_CELL_METERS) : undefined
}

/** Rest orientation only: height-aware barrel volumes, not an entire traverse circle. */
export function gunClearance(component: HLGComponentInstance, part: HLGPartDefinition): GunClearance {
  if (part.category === 'boiler' || part.category === 'turbine' || part.category === 'armor' || part.allowedZones.includes('internal')) return { body: null, barrels: [] }
  const geometry = componentGunGeometry(part)
  const rotated = component.rotation === 90 || component.rotation === 270
  const width = part.footprint.w * DESIGN_CELL_METERS, length = part.footprint.h * DESIGN_CELL_METERS
  const height = geometry ? normalizedMountHeight(component.mountHeight) : 0
  const bodyHeight = geometry?.bodyHeight ?? (part.category === 'bridge' ? 12 : part.category === 'funnel' ? 10 : 3)
  const x = (component.cell.c + .5) * DESIGN_CELL_METERS, y = (component.cell.r + .5) * DESIGN_CELL_METERS
  const body = { x: x - (rotated ? length : width) / 2, y: y - (rotated ? width : length) / 2,
    z: 0, w: rotated ? length : width, l: rotated ? width : length, h: height + bodyHeight }
  if (!geometry) return { body, barrels: [] }
  const a = component.rotation * Math.PI / 180
  const forward = { x: Math.sin(a), y: -Math.cos(a) }, side = { x: Math.cos(a), y: Math.sin(a) }
  const count = Math.max(1, Math.min(4, component.barrels ?? part.barrels ?? 1))
  const barrels = Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * geometry.barrelSpacing
    const rootX = x + side.x * offset + forward.x * geometry.barrelRoot
    const rootY = y + side.y * offset + forward.y * geometry.barrelRoot
    const tipX = rootX + forward.x * geometry.barrelLength, tipY = rootY + forward.y * geometry.barrelLength
    const r = geometry.barrelRadius + SAFETY_MARGIN
    return { x: Math.min(rootX, tipX) - r, y: Math.min(rootY, tipY) - r,
      z: height + geometry.barrelHeight - r, w: Math.abs(tipX - rootX) + r * 2, l: Math.abs(tipY - rootY) + r * 2, h: r * 2 }
  })
  return { body, barrels }
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w - 1e-6 && a.x + a.w > b.x + 1e-6 && a.y < b.y + b.l - 1e-6 && a.y + a.l > b.y + 1e-6 && a.z < b.z + b.h - 1e-6 && a.z + a.h > b.z + 1e-6
}

export function barrelsInterfere(a: GunClearance, b: GunClearance): boolean {
  return a.barrels.some(barrel => (b.body && intersects(barrel, b.body)) || b.barrels.some(other => intersects(barrel, other))) ||
    b.barrels.some(barrel => a.body && intersects(barrel, a.body))
}
