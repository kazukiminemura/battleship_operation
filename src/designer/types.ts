import type { PlayerShipType, WeaponTemplate } from '../game/data/masterdata'
import type { HLGDesign } from './hlg-system'

export interface SavedDesignerState {
  design: HLGDesign
}

export interface PrepResult {
  templateId?: string
  shipType: PlayerShipType
  loadout: WeaponTemplate[]
  armorBonus: number
  towerMount?: { x: number; y: number }
  hlgDesign?: HLGDesign
}
