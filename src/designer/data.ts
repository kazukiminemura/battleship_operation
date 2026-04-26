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

// Slot positions for the 160×700px hull wrapper (200×875 SVG viewBox)
// x/y are percent of wrapper; bow is at top (low y), stern at bottom (high y)
export const HULL_SLOTS: SlotDef[] = [
  // ── 主砲 (centerline) ───────────────────────────────────────────────────
  { id: 'main_1', type: 'main',      x: 50, y: 10, label: '第一主砲' },   // bow forward
  { id: 'main_2', type: 'main',      x: 50, y: 22, label: '第二主砲' },   // superfiring
  { id: 'main_3', type: 'main',      x: 50, y: 73, label: '第三主砲' },   // aft
  // ── 副砲 (broadside, mid-ship) ─────────────────────────────────────────
  { id: 'sec_1',  type: 'secondary', x: 22, y: 38, label: '左舷副砲A' },
  { id: 'sec_2',  type: 'secondary', x: 78, y: 38, label: '右舷副砲A' },
  { id: 'sec_3',  type: 'secondary', x: 22, y: 58, label: '左舷副砲B' },
  { id: 'sec_4',  type: 'secondary', x: 78, y: 58, label: '右舷副砲B' },
  // ── 機銃 (corners) ─────────────────────────────────────────────────────
  { id: 'aa_1',   type: 'aa',        x: 32, y: 29, label: '左舷機銃A' },
  { id: 'aa_2',   type: 'aa',        x: 68, y: 29, label: '右舷機銃A' },
  { id: 'aa_3',   type: 'aa',        x: 32, y: 66, label: '左舷機銃B' },
  { id: 'aa_4',   type: 'aa',        x: 68, y: 66, label: '右舷機銃B' },
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
