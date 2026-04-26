export type WeaponSlotType = 'gun' | 'secondary' | 'torpedo' | 'aa' | 'missile'

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
  compatibleTypes: WeaponSlotType[]
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
  /** knots (display-ready) */
  speed: number
  /** scaled turn value (display-ready) */
  turnRate: number
  totalWeight: number
  maxWeight: number
  weaponList: Array<{ slotId: string; slotLabel: string; weapon: Weapon }>
}
