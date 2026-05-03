import type { HLGDesign, HLGStats } from './hlg-system'

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

export interface SavedDesignerState {
  design: HLGDesign
}

export type Design = HLGDesign
export type DesignLayout = Record<string, never>
export type ShipStats = HLGStats
