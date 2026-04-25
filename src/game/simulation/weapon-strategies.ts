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
    speed: 20, damageMin: 30, damageMax: 50, lifetime: 60, cooldown: 15, hitRadius: 18, maxRange: 1200, maxHeight: 220,
  }),
  secondary: new SecondaryGunWeaponStrategy({
    speed: 22, damageMin: 20, damageMax: 32, lifetime: 55, cooldown: 10, hitRadius: 18, maxRange: 900, maxHeight: 180,
  }),
  torpedo: new TorpedoWeaponStrategy({
    speed: 8, damageMin: 80, damageMax: 120, lifetime: 150, cooldown: 60, hitRadius: 30, maxRange: 1200, maxHeight: 0,
  }),
  aa: new MachineGunWeaponStrategy({
    speed: 25, damageMin: 15, damageMax: 25, lifetime: 40, cooldown: 8, hitRadius: 15, maxRange: 1000, maxHeight: 130,
  }),
  missile: new MissileWeaponStrategy({
    speed: 12, damageMin: 60, damageMax: 90, lifetime: 200, cooldown: 90, hitRadius: 38, maxRange: 2400, maxHeight: 450,
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
  // ── 雪村 専用武器 ────────────────────────────────────────────────────
  'weapon.torpedo.yukimura.yukidaru': {
    speed: 5.5, damageMin: 75, damageMax: 115, lifetime: 180, cooldown: 55, hitRadius: 34, maxRange: 990, maxHeight: 0,
  },
  // ── 駆逐艦 追加武器 ──────────────────────────────────────────────────
  'weapon.gun.127mm.ap': {
    speed: 23, damageMin: 45, damageMax: 72, lifetime: 68, cooldown: 18, hitRadius: 20, maxRange: 1380, maxHeight: 230,
  },
  'weapon.torpedo.610mm.dd': {
    speed: 7, damageMin: 130, damageMax: 190, lifetime: 170, cooldown: 80, hitRadius: 33, maxRange: 1190, maxHeight: 0,
  },
  'weapon.aa.20mm.dd': {
    speed: 30, damageMin: 7, damageMax: 13, lifetime: 32, cooldown: 4, hitRadius: 12, maxRange: 650, maxHeight: 95,
  },
  'weapon.missile.antiship.dd': {
    speed: 11, damageMin: 50, damageMax: 80, lifetime: 160, cooldown: 75, hitRadius: 33, maxRange: 1760, maxHeight: 380,
  },
  'weapon.missile.sam.dd': {
    speed: 19, damageMin: 30, damageMax: 50, lifetime: 95, cooldown: 48, hitRadius: 30, maxRange: 1805, maxHeight: 520,
  },
  // ── 巡洋艦 追加武器 ──────────────────────────────────────────────────
  'weapon.gun.203mm.forward': {
    speed: 22, damageMin: 60, damageMax: 95, lifetime: 90, cooldown: 22, hitRadius: 24, maxRange: 1980, maxHeight: 380,
  },
  'weapon.gun.203mm.aft': {
    speed: 22, damageMin: 60, damageMax: 95, lifetime: 90, cooldown: 22, hitRadius: 24, maxRange: 1980, maxHeight: 380,
  },
  'weapon.secondary.100mm.cl': {
    speed: 25, damageMin: 18, damageMax: 28, lifetime: 48, cooldown: 7, hitRadius: 17, maxRange: 960, maxHeight: 200,
  },
  'weapon.torpedo.610mm.cl': {
    speed: 7, damageMin: 130, damageMax: 190, lifetime: 170, cooldown: 85, hitRadius: 33, maxRange: 1190, maxHeight: 0,
  },
  'weapon.aa.sam.cl': {
    speed: 20, damageMin: 45, damageMax: 70, lifetime: 200, cooldown: 100, hitRadius: 42, maxRange: 3200, maxHeight: 620,
  },
  'weapon.missile.cruise.cl': {
    speed: 10, damageMin: 90, damageMax: 140, lifetime: 320, cooldown: 140, hitRadius: 48, maxRange: 3200, maxHeight: 600,
  },
  // ── 戦艦 追加武器 ─────────────────────────────────────────────────────
  'weapon.gun.406mm.he.forward': {
    speed: 21, damageMin: 65, damageMax: 100, lifetime: 105, cooldown: 20, hitRadius: 30, maxRange: 2000, maxHeight: 400,
  },
  'weapon.gun.406mm.he.center': {
    speed: 21, damageMin: 65, damageMax: 100, lifetime: 105, cooldown: 20, hitRadius: 30, maxRange: 2000, maxHeight: 400,
  },
  'weapon.gun.406mm.he.aft': {
    speed: 21, damageMin: 65, damageMax: 100, lifetime: 105, cooldown: 20, hitRadius: 30, maxRange: 2000, maxHeight: 400,
  },
  'weapon.gun.460mm.forward': {
    speed: 23, damageMin: 130, damageMax: 195, lifetime: 130, cooldown: 36, hitRadius: 36, maxRange: 2600, maxHeight: 580,
  },
  'weapon.gun.460mm.center': {
    speed: 23, damageMin: 130, damageMax: 195, lifetime: 130, cooldown: 36, hitRadius: 36, maxRange: 2600, maxHeight: 580,
  },
  'weapon.gun.460mm.aft': {
    speed: 23, damageMin: 130, damageMax: 195, lifetime: 130, cooldown: 36, hitRadius: 36, maxRange: 2600, maxHeight: 580,
  },
  'weapon.secondary.127mm.bb.port': {
    speed: 24, damageMin: 22, damageMax: 35, lifetime: 58, cooldown: 9, hitRadius: 18, maxRange: 1000, maxHeight: 190,
  },
  'weapon.secondary.127mm.bb.starboard': {
    speed: 24, damageMin: 22, damageMax: 35, lifetime: 58, cooldown: 9, hitRadius: 18, maxRange: 1000, maxHeight: 190,
  },
  'weapon.torpedo.610mm.bb': {
    speed: 7, damageMin: 130, damageMax: 190, lifetime: 170, cooldown: 80, hitRadius: 33, maxRange: 1190, maxHeight: 0,
  },
  'weapon.aa.ciws.bb': {
    speed: 36, damageMin: 10, damageMax: 18, lifetime: 26, cooldown: 4, hitRadius: 14, maxRange: 600, maxHeight: 160,
  },
  'weapon.missile.antiship.bb': {
    speed: 12, damageMin: 65, damageMax: 95, lifetime: 190, cooldown: 90, hitRadius: 42, maxRange: 2280, maxHeight: 480,
  },
  'weapon.gun.406mm.twin.forward': {
    speed: 24, damageMin: 85, damageMax: 130, lifetime: 100, cooldown: 24, hitRadius: 27, maxRange: 2200, maxHeight: 430,
  },
  'weapon.gun.406mm.twin.center': {
    speed: 24, damageMin: 85, damageMax: 130, lifetime: 100, cooldown: 24, hitRadius: 27, maxRange: 2200, maxHeight: 430,
  },
  'weapon.gun.406mm.twin.aft': {
    speed: 24, damageMin: 85, damageMax: 130, lifetime: 100, cooldown: 24, hitRadius: 27, maxRange: 2200, maxHeight: 430,
  },
  'weapon.secondary.152mm.twin.port': {
    speed: 24, damageMin: 28, damageMax: 45, lifetime: 75, cooldown: 12, hitRadius: 21, maxRange: 1300, maxHeight: 240,
  },
  'weapon.secondary.152mm.twin.starboard': {
    speed: 24, damageMin: 28, damageMax: 45, lifetime: 75, cooldown: 12, hitRadius: 21, maxRange: 1300, maxHeight: 240,
  },
  'weapon.missile.cruiser.standard': {
    speed: 13, damageMin: 55, damageMax: 85, lifetime: 180, cooldown: 80, hitRadius: 36, maxRange: 2200, maxHeight: 420,
  },
  'weapon.missile.battleship.longrange': {
    speed: 14, damageMin: 80, damageMax: 120, lifetime: 240, cooldown: 110, hitRadius: 45, maxRange: 3200, maxHeight: 560,
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
