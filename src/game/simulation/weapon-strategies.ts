import type { BuildingEntity, ShipEntity, WeaponType } from './types'

export interface WeaponConfig {
  speed: number
  damageMin: number
  damageMax: number
  lifetime: number
  cooldown: number
  hitRadius: number
  maxRange: number
  maxHeight: number
}

export interface WeaponStrategy {
  readonly type: WeaponType
  readonly config: WeaponConfig
  canTargetBuilding(building: BuildingEntity): boolean
  canDamageShip(ship: ShipEntity): boolean
  buildingHitRadius(building: BuildingEntity): number
}

abstract class BaseWeaponStrategy implements WeaponStrategy {
  abstract readonly type: WeaponType

  constructor(readonly config: WeaponConfig) {}

  canTargetBuilding(_building: BuildingEntity): boolean {
    return true
  }

  canDamageShip(_ship: ShipEntity): boolean {
    return true
  }

  buildingHitRadius(building: BuildingEntity): number {
    return Math.max(this.config.hitRadius, building.radius)
  }
}

class CannonWeaponStrategy extends BaseWeaponStrategy {
  readonly type = 'gun' as const
}

class MachineGunWeaponStrategy extends BaseWeaponStrategy {
  readonly type = 'aa' as const
}

class MissileWeaponStrategy extends BaseWeaponStrategy {
  readonly type = 'missile' as const
}

class TorpedoWeaponStrategy extends BaseWeaponStrategy {
  readonly type = 'torpedo' as const

  canTargetBuilding(_building: BuildingEntity): boolean {
    return false
  }
}

class SecondaryGunWeaponStrategy extends BaseWeaponStrategy {
  readonly type = 'secondary' as const
}

export const WEAPON_STRATEGIES: Record<WeaponType, WeaponStrategy> = {
  gun: new CannonWeaponStrategy({
    speed: 20, damageMin: 30, damageMax: 50, lifetime: 60, cooldown: 15, hitRadius: 12, maxRange: 1200, maxHeight: 220,
  }),
  secondary: new SecondaryGunWeaponStrategy({
    speed: 22, damageMin: 20, damageMax: 32, lifetime: 55, cooldown: 10, hitRadius: 12, maxRange: 900, maxHeight: 180,
  }),
  torpedo: new TorpedoWeaponStrategy({
    speed: 8, damageMin: 80, damageMax: 120, lifetime: 150, cooldown: 60, hitRadius: 20, maxRange: 1200, maxHeight: 0,
  }),
  aa: new MachineGunWeaponStrategy({
    speed: 25, damageMin: 15, damageMax: 25, lifetime: 40, cooldown: 8, hitRadius: 10, maxRange: 1000, maxHeight: 130,
  }),
  missile: new MissileWeaponStrategy({
    speed: 12, damageMin: 60, damageMax: 90, lifetime: 200, cooldown: 90, hitRadius: 25, maxRange: 2400, maxHeight: 450,
  }),
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  gun: WEAPON_STRATEGIES.gun.config,
  secondary: WEAPON_STRATEGIES.secondary.config,
  torpedo: WEAPON_STRATEGIES.torpedo.config,
  aa: WEAPON_STRATEGIES.aa.config,
  missile: WEAPON_STRATEGIES.missile.config,
}

export function getWeaponStrategy(type: WeaponType): WeaponStrategy {
  return WEAPON_STRATEGIES[type]
}
