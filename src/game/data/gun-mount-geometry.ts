import { GUN_PROFILES } from '../simulation/gun-profiles'
import type { WeaponType } from '../simulation/types'

export const GUN_MOUNT_HEIGHTS = [0, 2, 4, 6, 8] as const
export const DESIGN_CELL_METERS = 1.25
export interface GunMountGeometry {
  bodyLength: number; bodyWidth: number; bodyHeight: number
  barrelRoot: number; barrelLength: number; barrelHeight: number; barrelRadius: number; barrelSpacing: number
}

export function isGunMount(type?: WeaponType): boolean {
  return type === 'gun' || type === 'secondary' || type === 'aa'
}

export function gunMountGeometry(weaponId: string, type: WeaponType, length: number, width: number): GunMountGeometry {
  const profile = GUN_PROFILES[weaponId]
  const caliber = profile?.caliber ?? (Number(weaponId.match(/(\d+)mm/)?.[1]) || (type === 'aa' ? 40 : 127))
  const bodyHeight = Math.max(1.3, caliber * .0075)
  return { bodyLength: length, bodyWidth: width, bodyHeight,
    barrelRoot: length * .2, barrelLength: Math.max(1.2, caliber / 1000 * (profile?.barrelLength ?? 40)),
    barrelHeight: bodyHeight * .7, barrelRadius: caliber / 2000 + .04, barrelSpacing: width * .18,
  }
}

export function normalizedMountHeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(8, Math.round(value / 2) * 2)) : 0
}
