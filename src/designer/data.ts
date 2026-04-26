import type { Weapon, SlotDef, Design, ShipStats, WeaponSlotType } from './types'
import type { WeaponTemplate, PlayerShipType } from '../game/data/masterdata'
import { getHullsByClass } from '../game/data/hull-catalog'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { WEAPON_SHOP } from '../game/data/weapon-shop'

export { getHullsByClass }

/** Weights for speed/turn penalty calculation per class */
export const CLASS_MAX_WEIGHT: Record<PlayerShipType, number> = {
  destroyer:  3500,
  cruiser:    10000,
  battleship: 30000,
}

/** Weapons available in the designer — ids match game weapon IDs */
export const WEAPONS: Weapon[] = [
  // Guns
  { id: 'weapon.gun.127mm.twin',  name: '12.7cm 連装砲',  type: 'gun', weight: 300,  firepower: 20,  reload: 3,  accuracy: 0.80 },
  { id: 'weapon.gun.152mm.twin',  name: '15.2cm 連装砲',  type: 'gun', weight: 520,  firepower: 38,  reload: 5,  accuracy: 0.78 },
  { id: 'weapon.gun.203mm',       name: '20.3cm 重砲',    type: 'gun', weight: 850,  firepower: 65,  reload: 8,  accuracy: 0.75 },
  { id: 'weapon.gun.406mm.twin',  name: '40.6cm 連装砲',  type: 'gun', weight: 1600, firepower: 105, reload: 18, accuracy: 0.72 },
  { id: 'weapon.gun.460mm',       name: '46cm 超重砲',    type: 'gun', weight: 2400, firepower: 145, reload: 26, accuracy: 0.70 },
  // Secondaries
  { id: 'weapon.secondary.127mm.twin', name: '12.7cm 速射副砲', type: 'secondary', weight: 200, firepower: 14, antiAir: 18, reload: 2, accuracy: 0.82 },
  { id: 'weapon.secondary.100mm.cl',   name: '10cm 高角砲',     type: 'secondary', weight: 180, firepower: 11, antiAir: 32, reload: 2, accuracy: 0.85 },
  { id: 'weapon.secondary.152mm.twin', name: '15.2cm 重副砲',   type: 'secondary', weight: 600, firepower: 48, antiAir: 8,  reload: 6, accuracy: 0.76 },
  // Torpedoes
  { id: 'weapon.torpedo.533mm.basic', name: '53.3cm 魚雷',   type: 'torpedo', weight: 120, firepower: 80,  reload: 15, accuracy: 0.88 },
  { id: 'weapon.torpedo.610mm.dd',    name: '61cm 重魚雷',   type: 'torpedo', weight: 200, firepower: 135, reload: 22, accuracy: 0.85 },
  { id: 'weapon.torpedo.610mm.bb',    name: '61cm 戦艦魚雷', type: 'torpedo', weight: 280, firepower: 160, reload: 25, accuracy: 0.83 },
  // AA
  { id: 'weapon.aa.20mm.dd',  name: '20mm 機銃',   type: 'aa', weight: 30,  antiAir: 30, reload: 0.5, accuracy: 0.70 },
  { id: 'weapon.aa.cruiser',  name: '40mm 対空砲', type: 'aa', weight: 65,  antiAir: 50, reload: 1.0, accuracy: 0.72 },
  { id: 'weapon.aa.heavy',    name: '重対空砲',    type: 'aa', weight: 120, antiAir: 72, reload: 2.0, accuracy: 0.75 },
  { id: 'weapon.aa.ciws.bb',  name: 'CIWS',        type: 'aa', weight: 90,  antiAir: 65, reload: 0.3, accuracy: 0.68 },
  // Missiles
  { id: 'weapon.missile.antiship.dd',          name: '対艦ミサイル(軽)',  type: 'missile', weight: 160, firepower: 90,  reload: 10, accuracy: 0.92 },
  { id: 'weapon.missile.sam.dd',               name: '短距離 SAM',       type: 'missile', weight: 90,  antiAir: 85,    reload: 5,  accuracy: 0.90 },
  { id: 'weapon.missile.battleship.longrange', name: '長射程ミサイル',   type: 'missile', weight: 350, firepower: 160, reload: 18, accuracy: 0.88 },
]

export const WEAPON_BY_ID: Record<string, Weapon> = Object.fromEntries(WEAPONS.map(w => [w.id, w]))

const GAME_AMMO: Record<string, number> = Object.fromEntries(WEAPON_SHOP.map(w => [w.id, w.ammo]))

/** Convert a hull-catalog entry into designer slot definitions */
export function getDesignerSlots(hull: HullCatalogEntry): SlotDef[] {
  return hull.slots.map(slot => ({
    id: slot.id,
    type: slot.compatibleTypes[0]! as WeaponSlotType,
    compatibleTypes: slot.compatibleTypes as WeaponSlotType[],
    // hull.x/y ∈ [-1, 1] → designer x ∈ [20, 80]%, y ∈ [11, 89]%
    x: Math.round((slot.x + 1) / 2 * 60 + 20),
    y: Math.round((slot.y + 1) / 2 * 78 + 11),
    label: slot.label,
  }))
}

export function calcStats(design: Design, hull: HullCatalogEntry, slots: SlotDef[]): ShipStats {
  const maxWeight = CLASS_MAX_WEIGHT[hull.shipType]
  const equipped = slots.flatMap(slot => {
    const weaponId = design[slot.id]
    if (!weaponId) return []
    const weapon = WEAPON_BY_ID[weaponId]
    if (!weapon) return []
    return [{ slotId: slot.id, slotLabel: slot.label, weapon }]
  })

  const totalWeight  = equipped.reduce((s, e) => s + e.weapon.weight, 0)
  const weightRatio  = Math.min(1, totalWeight / maxWeight)
  const totalFirepower = equipped.reduce((s, e) => s + (e.weapon.firepower ?? 0), 0)
  const totalAntiAir   = equipped.reduce((s, e) => s + (e.weapon.antiAir   ?? 0), 0)
  const avgAccuracy    = equipped.length
    ? equipped.reduce((s, e) => s + e.weapon.accuracy, 0) / equipped.length
    : 0

  // speed: hull.maxSpeed × 10 = knots; apply weight penalty
  const speed    = Math.max(5,   hull.maxSpeed * 10 * (1 - weightRatio * 0.35))
  // turnRate: scaled to ≈10–50 range for display
  const turnRate = Math.max(0.5, hull.turnRate * 1000 * (1 - weightRatio * 0.45))

  return { totalFirepower, totalAntiAir, avgAccuracy, speed, turnRate, totalWeight, maxWeight, weaponList: equipped }
}

/** Convert the designer's slot assignments into a game-ready WeaponTemplate array */
export function designToLoadout(design: Design, hull: HullCatalogEntry): WeaponTemplate[] {
  return hull.slots
    .filter(slot => design[slot.id])
    .map(slot => ({
      id:    design[slot.id]!,
      type:  slot.compatibleTypes[0]!,
      ammo:  GAME_AMMO[design[slot.id]!] ?? 100,
      mount: { x: slot.x, y: slot.y },
    }))
}

export const STORAGE_KEY = 'battleship-designer-v1'

export function saveDesign(design: Design): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
}

export function loadDesign(): Design {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Design) : {}
  } catch {
    return {}
  }
}
