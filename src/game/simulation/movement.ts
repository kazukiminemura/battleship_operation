import type { CombatState, ShipEntity, Command, MapObstacle, SpeedLevel, CombatEvent } from './types'
import { applyDamage, checkDestroyed } from './damage'

export const WORLD_SIZE = 16000
export const KNOTS_PER_UNIT = 10  // 1 game unit/tick = 10 knots for display
export const MOVEMENT_SCALE = 1.5  // visual movement multiplier (knot display is unaffected)
export const ISLAND_COLLIDER: MapObstacle = { id: 'island.central', x: 5000, y: 5050, rx: 620, ry: 430 }

// speed level order from slowest to fastest
export const SPEED_LEVEL_ORDER: SpeedLevel[] = ['reverse', 'stop', 'slow', 'cruise', 'full']

// target speed ratio for each level. The actual target is based on ship.maxSpeed.
export const SPEED_LEVEL_TARGET_RATIO: Record<SpeedLevel, number> = {
  full:    1.0,
  cruise:  0.7,
  slow:    0.3,
  stop:    0.0,
  reverse: -0.3,
}

export const SPEED_LEVEL_LABEL: Record<SpeedLevel, string> = {
  full:    '全速力',
  cruise:  '巡航',
  slow:    '微速',
  stop:    '停止',
  reverse: '後退',
}

// acceleration toward targetSpeed per tick
const ACCEL_RATE = 0.11
const SHORE_PUSHOUT = 28

export function stepMovement(state: CombatState, dt = 1): CombatState {
  const entities = new Map(state.entities)

  for (const [id, entity] of entities) {
    if (entity.kind !== 'ship' || entity.destroyed) continue

    const ship = entity as ShipEntity

    // accelerate speed toward targetSpeed
    const diff = ship.targetSpeed - ship.speed
    const step = Math.min(Math.abs(diff), ACCEL_RATE) * Math.sign(diff)
    const newSpeed = Math.abs(diff) < 0.001 ? ship.targetSpeed : ship.speed + step

    const vx = Math.cos(ship.angle) * newSpeed
    const vy = Math.sin(ship.angle) * newSpeed

    let px = ship.pos.x + vx * dt * MOVEMENT_SCALE
    let py = ship.pos.y + vy * dt * MOVEMENT_SCALE
    let finalSpeed = newSpeed
    let finalTargetSpeed = ship.targetSpeed

    if (px < 0)          { px = 0;          finalSpeed = 0; finalTargetSpeed = 0 }
    if (px > WORLD_SIZE) { px = WORLD_SIZE;  finalSpeed = 0; finalTargetSpeed = 0 }
    if (py < 0)          { py = 0;           finalSpeed = 0; finalTargetSpeed = 0 }
    if (py > WORLD_SIZE) { py = WORLD_SIZE;  finalSpeed = 0; finalTargetSpeed = 0 }

    if (isOnLand(px, py, state.mapObstacles)) {
      const pushed = pushOutOfLand(px, py, state.mapObstacles)
      px = pushed.x
      py = pushed.y
      finalSpeed = 0
      finalTargetSpeed = 0
    }

    entities.set(id, {
      ...ship,
      speed: finalSpeed,
      targetSpeed: finalTargetSpeed,
      vel: { x: Math.cos(ship.angle) * finalSpeed * MOVEMENT_SCALE, y: Math.sin(ship.angle) * finalSpeed * MOVEMENT_SCALE, z: 0 },
      pos: { x: px, y: py, z: 0 },
    })
  }

  return { ...state, entities }
}

export function isOnLand(x: number, y: number, obstacles: readonly MapObstacle[] = [ISLAND_COLLIDER]): boolean {
  return findLandObstacle(x, y, obstacles) !== undefined
}

function pushOutOfLand(x: number, y: number, obstacles: readonly MapObstacle[]): { x: number; y: number } {
  const land = findLandObstacle(x, y, obstacles) ?? ISLAND_COLLIDER
  const dx = x - land.x
  const dy = y - land.y
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: land.x, y: land.y + land.ry + SHORE_PUSHOUT }
  }

  const angle = Math.atan2(dy / land.ry, dx / land.rx)
  return {
    x: land.x + Math.cos(angle) * (land.rx + SHORE_PUSHOUT),
    y: land.y + Math.sin(angle) * (land.ry + SHORE_PUSHOUT),
  }
}

function findLandObstacle(x: number, y: number, obstacles: readonly MapObstacle[]): MapObstacle | undefined {
  return obstacles.find(obstacle => {
    const nx = (x - obstacle.x) / obstacle.rx
    const ny = (y - obstacle.y) / obstacle.ry
    return nx * nx + ny * ny < 1
  })
}

export function applySpeedUpCommand(ship: ShipEntity): ShipEntity {
  const idx = SPEED_LEVEL_ORDER.indexOf(ship.speedLevel)
  const newIdx = Math.min(idx + 1, SPEED_LEVEL_ORDER.length - 1)
  const newLevel = SPEED_LEVEL_ORDER[newIdx]!
  return { ...ship, speedLevel: newLevel, targetSpeed: targetSpeedForLevel(ship, newLevel) }
}

export function applySpeedDownCommand(ship: ShipEntity): ShipEntity {
  const idx = SPEED_LEVEL_ORDER.indexOf(ship.speedLevel)
  const newIdx = Math.max(idx - 1, 0)
  const newLevel = SPEED_LEVEL_ORDER[newIdx]!
  return { ...ship, speedLevel: newLevel, targetSpeed: targetSpeedForLevel(ship, newLevel) }
}

export function applyRotateCommand(ship: ShipEntity, cmd: Command): ShipEntity {
  if (cmd.type !== 'rotate') return ship
  const delta = cmd.value ?? 0
  const clamped = Math.max(-ship.turnRate, Math.min(ship.turnRate, delta))
  const angle = ship.angle + clamped
  return { ...ship, angle }
}

export function applyMoveCommand(ship: ShipEntity, cmd: Command): ShipEntity {
  if (cmd.type !== 'move') return ship
  const speed = cmd.value ?? ship.maxSpeed
  const clamped = Math.min(Math.abs(speed), ship.maxSpeed) * Math.sign(speed)
  const speedLevel = inferSpeedLevel(clamped, ship.maxSpeed)
  return { ...ship, targetSpeed: clamped, speedLevel }
}

function inferSpeedLevel(target: number, max: number): SpeedLevel {
  if (target < 0) return 'reverse'
  if (max === 0 || target === 0) return 'stop'
  const r = target / max
  if (r < 0.15) return 'stop'
  if (r < 0.50) return 'slow'
  if (r < 0.85) return 'cruise'
  return 'full'
}

export function applyStopCommand(ship: ShipEntity): ShipEntity {
  return { ...ship, targetSpeed: 0, speedLevel: 'stop' }
}

export function targetSpeedForLevel(ship: ShipEntity, level: SpeedLevel): number {
  return ship.maxSpeed * SPEED_LEVEL_TARGET_RATIO[level]
}

const SHIP_COLLISION_RADII: Record<string, number> = {
  'hull.destroyer.basic':        55,
  'hull.dd.improved':            58,
  'hull.dd.elite':               62,
  'hull.enemy.destroyer.basic':  40,
  'hull.cruiser.player':         75,
  'hull.cl.heavy':               88,
  'hull.ca.elite':               92,
  'hull.cruiser.basic':          65,
  'hull.battleship.basic':       110,
  'hull.bb.fast':                112,
  'hull.bb.super':               120,
  'hull.bb.yukimura':            108,
  'hull.enemy.boss.dreadnought': 130,
}
const DEFAULT_COLLISION_RADIUS = 60
const COLLISION_DAMAGE_SCALE = 80

export function stepCollisions(state: CombatState): CombatState {
  const entities = new Map(state.entities)
  let metrics = { ...state.metrics }
  const events: CombatEvent[] = []

  const ships = [...entities.values()].filter(
    e => e.kind === 'ship' && !e.destroyed,
  ) as ShipEntity[]

  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = entities.get(ships[i]!.id) as ShipEntity | undefined
      const b = entities.get(ships[j]!.id) as ShipEntity | undefined
      if (!a || !b || a.destroyed || b.destroyed) continue
      if (a.team === b.team) continue

      const radA = SHIP_COLLISION_RADII[a.templateId] ?? DEFAULT_COLLISION_RADIUS
      const radB = SHIP_COLLISION_RADII[b.templateId] ?? DEFAULT_COLLISION_RADIUS
      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const minDist = radA + radB

      if (dist >= minDist || dist < 0.001) continue

      const nx = dx / dist
      const ny = dy / dist
      const relVel = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny

      if (relVel > 0) continue  // already separating

      const impactSpeed = Math.abs(relVel)
      const massA = a.maxHp
      const massB = b.maxHp
      const totalMass = massA + massB

      const damageToA = impactSpeed * massB / totalMass * COLLISION_DAMAGE_SCALE
      const damageToB = impactSpeed * massA / totalMass * COLLISION_DAMAGE_SCALE
      const overlap = minDist - dist

      let updatedA = checkDestroyed(applyDamage(a, damageToA))
      let updatedB = checkDestroyed(applyDamage(b, damageToB))
      updatedA = { ...updatedA, pos: { x: a.pos.x - nx * overlap * (massB / totalMass), y: a.pos.y - ny * overlap * (massB / totalMass), z: 0 } }
      updatedB = { ...updatedB, pos: { x: b.pos.x + nx * overlap * (massA / totalMass), y: b.pos.y + ny * overlap * (massA / totalMass), z: 0 } }

      entities.set(a.id, updatedA)
      entities.set(b.id, updatedB)

      events.push(
        { tick: state.tick, type: 'ship.collision', sourceId: a.id, targetId: b.id, damage: damageToA, position: { ...a.pos }, hitSection: collisionHitSection(a, nx, ny) },
        { tick: state.tick, type: 'ship.collision', sourceId: b.id, targetId: a.id, damage: damageToB, position: { ...b.pos }, hitSection: collisionHitSection(b, -nx, -ny) },
      )

      if (a.team === 'player') metrics = { ...metrics, playerDamageTaken: metrics.playerDamageTaken + damageToA }
      if (b.team === 'player') metrics = { ...metrics, playerDamageTaken: metrics.playerDamageTaken + damageToB }

      if (updatedA.destroyed && !a.destroyed && a.team === 'enemy') {
        metrics = { ...metrics, enemiesDestroyed: metrics.enemiesDestroyed + 1 }
        events.push({ tick: state.tick, type: 'entity.destroyed', targetId: a.id, position: { ...a.pos } })
      }
      if (updatedB.destroyed && !b.destroyed && b.team === 'enemy') {
        metrics = { ...metrics, enemiesDestroyed: metrics.enemiesDestroyed + 1 }
        events.push({ tick: state.tick, type: 'entity.destroyed', targetId: b.id, position: { ...b.pos } })
      }
    }
  }

  return { ...state, entities, eventLog: [...state.eventLog, ...events], metrics }
}

function collisionHitSection(ship: ShipEntity, nx: number, ny: number): string {
  const dot = nx * Math.cos(ship.angle) + ny * Math.sin(ship.angle)
  if (dot > 0.6) return 'bow'
  if (dot < -0.6) return 'stern'
  return 'superstructure'
}
