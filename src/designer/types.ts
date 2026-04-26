export type WeaponSlotType = 'main' | 'secondary' | 'aa'

export interface Weapon {
  id: string
  name: string
  type: WeaponSlotType
  weight: number
  firepower?: number
  antiAir?: number
  reload: number
  accuracy: number
}

export interface SlotDef {
  id: string
  type: WeaponSlotType
  /** % from left of hull container */
  x: number
  /** % from top of hull container */
  y: number
  label: string
}

/** slotId → weaponId */
export type Design = Record<string, string>

export interface ShipStats {
  totalFirepower: number
  totalAntiAir: number
  avgAccuracy: number
  speed: number
  turnRate: number
  totalWeight: number
  weaponList: Array<{ slotId: string; slotLabel: string; weapon: Weapon }>
}
