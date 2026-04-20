export type Vec3 = { x: number; y: number; z: number }

export type WeaponType = 'gun' | 'secondary' | 'torpedo' | 'aa' | 'missile'

export type EntityType = 'ship' | 'projectile' | 'torpedo' | 'objective' | 'building'

export type SpeedLevel = 'full' | 'cruise' | 'slow' | 'stop' | 'reverse'

export interface WeaponState {
  id: string
  type: WeaponType
  cooldownTick: number
  ammo: number
  maxAmmo: number
  autoFire: boolean
}

export interface ShipEntity {
  kind: 'ship'
  id: string
  pos: Vec3
  vel: Vec3
  angle: number
  hp: number
  maxHp: number
  speed: number        // current speed (units/tick)
  targetSpeed: number  // acceleration target (units/tick)
  speedLevel: SpeedLevel
  maxSpeed: number
  turnRate: number
  weapons: WeaponState[]
  team: 'player' | 'enemy'
  destroyed: boolean
  templateId: string
}

export interface ProjectileEntity {
  kind: 'projectile'
  id: string
  pos: Vec3
  vel: Vec3
  ownerId: string
  weaponType: WeaponType
  damage: number
  lifetime: number
  initialLifetime: number
  maxHeight: number
  destroyed: boolean
}

export interface BuildingEntity {
  kind: 'building'
  id: string
  pos: Vec3
  hp: number
  maxHp: number
  radius: number
  team: 'enemy' | 'neutral'
  destroyed: boolean
  templateId: string
}

export interface ObjectiveEntity {
  kind: 'objective'
  id: string
  completed: boolean
}

export type Entity = ShipEntity | ProjectileEntity | ObjectiveEntity | BuildingEntity

export interface CombatState {
  tick: number
  entities: Map<string, Entity>
  eventLog: CombatEvent[]
  missionResult: 'none' | 'completed' | 'failed'
  metrics: Metrics
}

export type CommandType =
  | 'move' | 'rotate' | 'stop'
  | 'speed.up' | 'speed.down'
  | 'fire.primary' | 'fire.secondary' | 'fire.torpedo' | 'fire.aa' | 'fire.missile'

export interface Command {
  tick: number
  actorId: string
  type: CommandType
  target?: Vec3
  value?: number
}

export type EventType =
  | 'weapon.fired'
  | 'weapon.hit'
  | 'weapon.missed'
  | 'entity.spawned'
  | 'entity.destroyed'
  | 'damage.taken'
  | 'objective.completed'
  | 'mission.completed'
  | 'mission.failed'

export interface CombatEvent {
  tick: number
  type: EventType
  sourceId?: string
  targetId?: string
  weaponId?: string
  damage?: number
  position?: Vec3
}

export interface Metrics {
  result: 'none' | 'completed' | 'failed'
  durationTicks: number
  playerDamageTaken: number
  playerAmmoSpent: number
  hitCountByWeapon: Record<string, number>
  shotCountByWeapon: Record<string, number>
  damageByWeapon: Record<string, number>
  enemiesDestroyed: number
}
