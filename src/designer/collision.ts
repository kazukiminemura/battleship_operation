import type { WeaponSlotType } from './types'
import type { SlotDef } from './types'

/** Hull canvas base dimensions (scale=1). */
const HULL_W = 160
const HULL_H = 700

/**
 * Physical collision radius for each weapon type, in hull pixels (scale=1).
 * Derived from the real-world footprint of each mount.
 */
export const WEAPON_RADIUS: Record<WeaponSlotType, number> = {
  gun:       30,   // triple turret + barbette ring
  secondary: 22,   // twin turret, smaller barbette
  torpedo:   25,   // quintuple tube frame, wide
  aa:        16,   // triple 25mm, compact platform
  missile:   21,   // 4-cell box launcher
}

function toPx(slot: SlotDef): { x: number; y: number } {
  return { x: HULL_W * slot.x / 100, y: HULL_H * slot.y / 100 }
}

/** Returns true if the two weapon mounts physically overlap. */
function overlaps(
  slotA: SlotDef, typeA: WeaponSlotType,
  slotB: SlotDef, typeB: WeaponSlotType,
): boolean {
  const a = toPx(slotA)
  const b = toPx(slotB)
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist < WEAPON_RADIUS[typeA] + WEAPON_RADIUS[typeB]
}

/**
 * Returns true if placing `weaponType` at `targetSlot` would physically
 * interfere with any weapon already in `design`.
 * The slot being replaced (`targetSlot.id`) is excluded from the check.
 */
export function wouldInterfere(
  targetSlot: SlotDef,
  weaponType: WeaponSlotType,
  slots: SlotDef[],
  design: Record<string, string>,            // slotId → weaponId
  getType: (weaponId: string) => WeaponSlotType | undefined,
): boolean {
  for (const [slotId, weaponId] of Object.entries(design)) {
    if (slotId === targetSlot.id) continue   // replacing same slot — ok
    const existingType = getType(weaponId)
    if (!existingType) continue
    const otherSlot = slots.find(s => s.id === slotId)
    if (!otherSlot) continue
    if (overlaps(targetSlot, weaponType, otherSlot, existingType)) return true
  }
  return false
}
