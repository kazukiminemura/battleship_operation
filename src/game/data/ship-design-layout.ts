import type { WeaponType } from '../simulation/types'

export interface DesignedWeapon {
  id: string
  instanceId?: string
  name: string
  type: WeaponType
  mount: { x: number; y: number }
  rotation?: number
  barrels?: number
  selected: boolean
}

export interface DesignedStructure {
  instanceId: string
  partId: string
  name: string
  category: 'bridge' | 'funnel' | 'boiler' | 'turbine' | 'aux' | 'armor'
  mount: { x: number; y: number }
  rotation: number
  footprint: { length: number; beam: number }
  internal: boolean
}

/** Immutable-at-launch, normalized appearance contract shared by designer and combat. */
export interface ShipDesignLayout {
  weapons: DesignedWeapon[]
  structures: DesignedStructure[]
}
