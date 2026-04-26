import type { Weapon, SlotDef, Design, ShipStats } from './types'

export const MAX_WEIGHT = 30000
export const BASE_SPEED = 35
export const BASE_TURN = 100

export const WEAPONS: Weapon[] = [
  {
    id: 'gun46cm',
    name: '46cm三連装砲',
    type: 'main',
    weight: 3000,
    firepower: 120,
    reload: 30,
    accuracy: 0.75,
  },
  {
    id: 'gun20cm',
    name: '20cm連装砲',
    type: 'secondary',
    weight: 700,
    firepower: 45,
    reload: 12,
    accuracy: 0.82,
  },
  {
    id: 'gun127mm',
    name: '12.7cm高角砲',
    type: 'secondary',
    weight: 400,
    firepower: 25,
    antiAir: 40,
    reload: 6,
    accuracy: 0.85,
  },
  {
    id: 'aa25mm',
    name: '25mm三連装機銃',
    type: 'aa',
    weight: 80,
    antiAir: 25,
    reload: 2,
    accuracy: 0.65,
  },
]

export const WEAPON_BY_ID: Record<string, Weapon> = Object.fromEntries(WEAPONS.map(w => [w.id, w]))

// Slot positions tuned to the battleship SVG hull (200×400 viewBox mapped to 100%×100%)
export const HULL_SLOTS: SlotDef[] = [
  // ── 主砲スロット (center-line) ──────────────────────────────────────────
  { id: 'main_1', type: 'main',      x: 50, y: 13, label: '第一主砲' },
  { id: 'main_2', type: 'main',      x: 50, y: 42, label: '第二主砲' },
  { id: 'main_3', type: 'main',      x: 50, y: 68, label: '第三主砲' },
  // ── 副砲スロット (sides) ────────────────────────────────────────────────
  { id: 'sec_1',  type: 'secondary', x: 22, y: 33, label: '左舷副砲A' },
  { id: 'sec_2',  type: 'secondary', x: 78, y: 33, label: '右舷副砲A' },
  { id: 'sec_3',  type: 'secondary', x: 22, y: 55, label: '左舷副砲B' },
  { id: 'sec_4',  type: 'secondary', x: 78, y: 55, label: '右舷副砲B' },
  // ── 機銃スロット (corners) ──────────────────────────────────────────────
  { id: 'aa_1',   type: 'aa',        x: 31, y: 21, label: '左舷機銃A' },
  { id: 'aa_2',   type: 'aa',        x: 69, y: 21, label: '右舷機銃A' },
  { id: 'aa_3',   type: 'aa',        x: 31, y: 62, label: '左舷機銃B' },
  { id: 'aa_4',   type: 'aa',        x: 69, y: 62, label: '右舷機銃B' },
]

export function calcStats(design: Design): ShipStats {
  const equipped = HULL_SLOTS.flatMap(slot => {
    const weaponId = design[slot.id]
    if (!weaponId) return []
    const weapon = WEAPON_BY_ID[weaponId]
    if (!weapon) return []
    return [{ slotId: slot.id, slotLabel: slot.label, weapon }]
  })

  const totalWeight = equipped.reduce((s, e) => s + e.weapon.weight, 0)
  const weightRatio = Math.min(1, totalWeight / MAX_WEIGHT)

  const totalFirepower = equipped.reduce((s, e) => s + (e.weapon.firepower ?? 0), 0)
  const totalAntiAir   = equipped.reduce((s, e) => s + (e.weapon.antiAir ?? 0), 0)
  const avgAccuracy    = equipped.length
    ? equipped.reduce((s, e) => s + e.weapon.accuracy, 0) / equipped.length
    : 0

  const speed    = Math.max(5,  BASE_SPEED * (1 - weightRatio * 0.35))
  const turnRate = Math.max(10, BASE_TURN  * (1 - weightRatio * 0.45))

  return { totalFirepower, totalAntiAir, avgAccuracy, speed, turnRate, totalWeight, weaponList: equipped }
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
