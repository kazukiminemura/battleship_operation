export type Vec3 = { x: number; y: number; z: number }

export const MAX_WEAPON_SLOTS = 8

export interface MapObstacle {
  id: string
  x: number
  y: number
  rx: number
  ry: number
  points?: { x: number; y: number }[]  // polygon coastline for rendering (collision still uses rx/ry ellipse)
}

export type WeaponType = 'gun' | 'secondary' | 'torpedo' | 'aa' | 'missile'

export type EntityType = 'ship' | 'projectile' | 'torpedo' | 'objective' | 'building'

export type SpeedLevel = 'full' | 'cruise' | 'slow' | 'stop' | 'reverse'

export type WeatherCondition = 'clear' | 'rain' | 'night'

export interface WeaponState {
  id: string
  name: string
  type: WeaponType
  mount?: { x: number; y: number }
  barrels?: number
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
  detectionRange: number  // visual detection radius in world units
  weapons: WeaponState[]
  armor: number
  armorBonus?: number
  towerMount?: { x: number; y: number }
  team: 'player' | 'enemy'
  destroyed: boolean
  templateId: string
  autoPilot?: boolean
}

export interface ProjectileEntity {
  kind: 'projectile'
  id: string
  pos: Vec3
  vel: Vec3
  ownerId: string
  weaponId?: string
  weaponType: WeaponType
  launchPos?: Vec3
  targetPos?: Vec3
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

export function isShip(e: Entity): e is ShipEntity        { return e.kind === 'ship' }
export function isProjectile(e: Entity): e is ProjectileEntity { return e.kind === 'projectile' }
export function isBuilding(e: Entity): e is BuildingEntity { return e.kind === 'building' }
export function isObjective(e: Entity): e is ObjectiveEntity  { return e.kind === 'objective' }

export interface EnemyContact {
  pos: Vec3
  tick: number  // tick when last detected
}

export interface CombatState {
  tick: number
  stage: number
  stageName: string
  maxStage: number
  weather: WeatherCondition
  mapObstacles: MapObstacle[]
  entities: Map<string, Entity>
  eventLog: CombatEvent[]
  missionResult: 'none' | 'completed' | 'failed'
  metrics: Metrics
  detectedByPlayer: Set<string>                // entity IDs currently visible to player
  enemyContacts: Map<string, EnemyContact>     // last known positions of enemy ships
}

export type CommandType =
  | 'move' | 'rotate' | 'stop'
  | 'speed.up' | 'speed.down'
  | 'fire.slot'
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
  | 'ship.collision'
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
  targetPosition?: Vec3
  salvoCount?: number
  muzzlePositions?: Vec3[]
  hitSection?: string
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
