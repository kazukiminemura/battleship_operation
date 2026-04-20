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

type WeaponConfigOverride = Partial<WeaponConfig>

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

const WEAPON_CONFIG_OVERRIDES: Record<string, WeaponConfigOverride> = {
  'weapon.gun.406mm.twin.forward': {
    speed: 24, damageMin: 85, damageMax: 130, lifetime: 100, cooldown: 24, hitRadius: 18, maxRange: 2200, maxHeight: 430,
  },
  'weapon.gun.406mm.twin.center': {
    speed: 24, damageMin: 85, damageMax: 130, lifetime: 100, cooldown: 24, hitRadius: 18, maxRange: 2200, maxHeight: 430,
  },
  'weapon.gun.406mm.twin.aft': {
    speed: 24, damageMin: 85, damageMax: 130, lifetime: 100, cooldown: 24, hitRadius: 18, maxRange: 2200, maxHeight: 430,
  },
  'weapon.secondary.152mm.twin.port': {
    speed: 24, damageMin: 28, damageMax: 45, lifetime: 75, cooldown: 12, hitRadius: 14, maxRange: 1300, maxHeight: 240,
  },
  'weapon.secondary.152mm.twin.starboard': {
    speed: 24, damageMin: 28, damageMax: 45, lifetime: 75, cooldown: 12, hitRadius: 14, maxRange: 1300, maxHeight: 240,
  },
  'weapon.missile.cruiser.standard': {
    speed: 13, damageMin: 55, damageMax: 85, lifetime: 180, cooldown: 80, hitRadius: 24, maxRange: 2200, maxHeight: 420,
  },
  'weapon.missile.battleship.longrange': {
    speed: 14, damageMin: 80, damageMax: 120, lifetime: 240, cooldown: 110, hitRadius: 30, maxRange: 3200, maxHeight: 560,
  },
  'weapon.boss.460mm.twin.forward': {
    speed: 25, damageMin: 110, damageMax: 165, lifetime: 120, cooldown: 28, hitRadius: 22, maxRange: 2600, maxHeight: 520,
  },
  'weapon.boss.460mm.twin.center': {
    speed: 25, damageMin: 110, damageMax: 165, lifetime: 120, cooldown: 28, hitRadius: 22, maxRange: 2600, maxHeight: 520,
  },
  'weapon.boss.460mm.twin.aft': {
    speed: 25, damageMin: 110, damageMax: 165, lifetime: 120, cooldown: 28, hitRadius: 22, maxRange: 2600, maxHeight: 520,
  },
}

export function getWeaponStrategy(type: WeaponType): WeaponStrategy {
  return WEAPON_STRATEGIES[type]
}

export function getWeaponConfig(weaponId: string, type: WeaponType): WeaponConfig {
  return { ...WEAPON_CONFIGS[type], ...WEAPON_CONFIG_OVERRIDES[weaponId] }
}
