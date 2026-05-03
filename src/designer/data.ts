import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { getHullsByClass } from '../game/data/hull-catalog'
import type { PlayerShipType, WeaponTemplate } from '../game/data/masterdata'
import { WEAPON_SHOP } from '../game/data/weapon-shop'
import type { PrepResult } from '../game/ui/prepscreen'
import {
  calculateHLGStats,
  cloneHLGDesign,
  defaultHLGDesign,
  hlgDesignToLoadout,
  migrateLegacyDesignerState,
  normalizeHLGDesign,
  towerMountFromHLG,
  type HLGDesign,
} from './hlg-system'
import type { SavedDesignerState, Weapon } from './types'

export { getHullsByClass }

export const STORAGE_KEY = 'battleship-freeform-designer-v1'
export const PREVIOUS_STORAGE_KEY = 'battleship-hlg-designer-v1'
export const LEGACY_STORAGE_KEY = 'battleship-designer-v1'
export const DESIGN_SAVE_SLOTS = [1, 2, 3, 4] as const
export type DesignSaveSlot = typeof DESIGN_SAVE_SLOTS[number]

export const WEAPONS: Weapon[] = WEAPON_SHOP.map(weapon => ({
  id: weapon.id,
  name: weapon.name,
  type: weapon.type,
  weight: Math.max(40, Math.round(weapon.cost * 0.42)),
  firepower: weapon.type === 'gun' || weapon.type === 'torpedo' || weapon.type === 'missile' ? Math.max(10, Math.round(weapon.cost * 0.08)) : undefined,
  antiAir: weapon.type === 'aa' || weapon.type === 'secondary' ? Math.max(8, Math.round(weapon.cost * 0.09)) : undefined,
  reload: weapon.type === 'aa' ? 0.8 : weapon.type === 'torpedo' ? 75 : weapon.type === 'missile' ? 25 : weapon.type === 'secondary' ? 6 : 10,
  accuracy: weapon.type === 'missile' ? 0.9 : weapon.type === 'torpedo' ? 0.84 : 0.76,
}))

export function createDesignForHull(hull: HullCatalogEntry, preferred?: HLGDesign | null): HLGDesign {
  if (preferred && preferred.hullTemplateId === hull.templateId) return normalizeHLGDesign(hull, preferred)
  return defaultHLGDesign(hull)
}

export function createDesignFromPrepResult(result: PrepResult | null | undefined): HLGDesign | null {
  if (!result) return null
  if (result.hlgDesign) {
    const hull = getHullsByClass(result.shipType).find(h => h.templateId === result.templateId)
    return hull ? normalizeHLGDesign(hull, result.hlgDesign) : cloneHLGDesign(result.hlgDesign)
  }
  const hull = getHullsByClass(result.shipType).find(h => h.templateId === result.templateId)
  if (!hull) return null
  return defaultHLGDesign(hull)
}

export function calcStats(design: HLGDesign, hull: HullCatalogEntry) {
  return calculateHLGStats(hull, design)
}

export function designToLoadout(design: HLGDesign, hull: HullCatalogEntry): WeaponTemplate[] {
  return hlgDesignToLoadout(hull, design)
}

export function designTowerMount(hull: HullCatalogEntry, design: HLGDesign): { x: number; y: number } {
  return towerMountFromHLG(hull, design)
}

export function saveDesign(design: HLGDesign, slot: DesignSaveSlot = 1): void {
  localStorage.setItem(storageKeyForSlot(slot), JSON.stringify({ design }))
}

export function loadDesignerState(hull: HullCatalogEntry, slot: DesignSaveSlot = 1): SavedDesignerState {
  try {
    const raw = readRawDesignSlot(slot)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedDesignerState>
      if (parsed.design?.hullTemplateId === hull.templateId) return { design: normalizeHLGDesign(hull, parsed.design) }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) return { design: migrateLegacyDesignerState(hull, JSON.parse(legacyRaw)) }
  } catch {
    // Fall back below.
  }
  return { design: defaultHLGDesign(hull) }
}

function storageKeyForSlot(slot: DesignSaveSlot): string {
  return slot === 1 ? STORAGE_KEY : `${STORAGE_KEY}:slot-${slot}`
}

function readRawDesignSlot(slot: DesignSaveSlot): string | null {
  const current = localStorage.getItem(storageKeyForSlot(slot))
  if (current || slot !== 1) return current
  return localStorage.getItem(PREVIOUS_STORAGE_KEY)
}

export function hullIndexForTemplate(shipType: PlayerShipType, templateId: string): number {
  const hulls = getHullsByClass(shipType)
  return Math.max(0, hulls.findIndex(h => h.templateId === templateId))
}
