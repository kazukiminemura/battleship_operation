import type { CombatState, ShipEntity, Command, MapObstacle, SpeedLevel, CombatEvent } from './types'
import { pointInCoast } from '../data/coastlines'
import { shipContact, shipContactDimensions } from './ship-contact'
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
    const step = Math.min(Math.abs(diff), ACCEL_RATE * dt) * Math.sign(diff)
    const newSpeed = ship.speed + step
    // Integrate acceleration exactly so another ship's substep count cannot alter this ship's motion.
    const acceleratingFor = Math.min(dt, Math.abs(diff) / ACCEL_RATE)
    const distance = ship.speed * acceleratingFor + Math.sign(diff) * ACCEL_RATE * acceleratingFor ** 2 / 2 + newSpeed * (dt - acceleratingFor)
    let px = ship.pos.x + Math.cos(ship.angle) * distance * MOVEMENT_SCALE
    let py = ship.pos.y + Math.sin(ship.angle) * distance * MOVEMENT_SCALE
    let finalSpeed = newSpeed
    let finalTargetSpeed = ship.targetSpeed

    if (px < 0)          { px = 0;          finalSpeed = 0 }
    if (px > WORLD_SIZE) { px = WORLD_SIZE;  finalSpeed = 0 }
    if (py < 0)          { py = 0;           finalSpeed = 0 }
    if (py > WORLD_SIZE) { py = WORLD_SIZE;  finalSpeed = 0 }

    if (isOnLand(px, py, state.mapObstacles)) {
      // Reject a move onto shore; only repair positions that were already on land.
      const safe = isOnLand(ship.pos.x, ship.pos.y, state.mapObstacles)
        ? pushOutOfLand(px, py, state.mapObstacles) : ship.pos
      px = safe.x
      py = safe.y
      finalSpeed = 0
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
  if (land.points && land.points.length >= 3) {
    let closest = { x: land.x, y: land.y }, best = Infinity
    for (let i = 0; i < land.points.length; i++) {
      const a = land.points[i]!, b = land.points[(i + 1) % land.points.length]!
      const dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(1e-9, dx * dx + dy * dy)))
      const p = { x: a.x + t * dx, y: a.y + t * dy }
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < best) { best = d; closest = p }
    }
    const length = Math.max(0.001, best)
    return { x: closest.x + (closest.x - x) / length * SHORE_PUSHOUT, y: closest.y + (closest.y - y) / length * SHORE_PUSHOUT }
  }
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
    if (obstacle.points && obstacle.points.length >= 3) return pointInCoast(x, y, obstacle.points)
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

const COLLISION_DAMAGE_SCALE = 80

export function stepCollisions(state: CombatState): CombatState {
  const entities = new Map(state.entities)
  let metrics = { ...state.metrics }
  const events: CombatEvent[] = []

  const ships = [...entities.values()].filter(
    e => e.kind === 'ship' && !e.destroyed,
  ) as ShipEntity[]

  ships.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const damagedPairs = new Set<string>()
  // Revisit contacts displaced by a third ship in a packed formation.
  for (let pass = 0; pass < 16; pass++) {
    let corrected = false
    for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) {
      const a = entities.get(ships[i]!.id) as ShipEntity
      const b = entities.get(ships[j]!.id) as ShipEntity
      if (a.destroyed || b.destroyed) continue
      const contact = shipContact(a, b)
      if (!contact) continue
      corrected = true
      const { nx, ny, overlap } = contact
      const massA = Math.max(1, a.maxHp), massB = Math.max(1, b.maxHp)
      const total = massA + massB
      const closing = Math.max(0, -((b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny))
      const pair = `${i}:${j}`
      const damaging = a.team !== b.team && !damagedPairs.has(pair) && closing > 0.1
      const damageA = damaging ? closing * massB / total * COLLISION_DAMAGE_SCALE : 0
      const damageB = damaging ? closing * massA / total * COLLISION_DAMAGE_SCALE : 0
      let updatedA = checkDestroyed(applyDamage(a, damageA))
      let updatedB = checkDestroyed(applyDamage(b, damageB))
      const position = (ship: ShipEntity, sign: number, ratio: number) => {
        let x = Math.max(0, Math.min(WORLD_SIZE, ship.pos.x + sign * nx * (overlap + .1) * ratio))
        let y = Math.max(0, Math.min(WORLD_SIZE, ship.pos.y + sign * ny * (overlap + .1) * ratio))
        if (isOnLand(x, y, state.mapObstacles)) ({ x, y } = pushOutOfLand(x, y, state.mapObstacles))
        return { x, y, z: 0 }
      }
      updatedA = { ...updatedA, pos: position(a, -1, massB / total) }
      updatedB = { ...updatedB, pos: position(b, 1, massA / total) }
      if (closing > 0) {
        const an = a.vel.x * nx + a.vel.y * ny
        const bn = b.vel.x * nx + b.vel.y * ny
        const slow = (ship: ShipEntity, normal: number, allowed: number): ShipEntity => {
          if (normal <= 0) return ship
          const incidence = Math.cos(ship.angle) * nx + Math.sin(ship.angle) * ny
          const factor = Math.max(0, 1 - Math.max(0, normal - allowed) / normal * incidence * incidence)
          const speed = ship.speed * factor
          return { ...ship, speed, vel: { x: Math.cos(ship.angle) * speed * MOVEMENT_SCALE, y: Math.sin(ship.angle) * speed * MOVEMENT_SCALE, z: 0 } }
        }
        updatedA = slow(updatedA, an, Math.max(0, bn))
        updatedB = slow(updatedB, -bn, Math.max(0, -an))
      }
      entities.set(a.id, updatedA); entities.set(b.id, updatedB)
      if (!damaging) continue
      damagedPairs.add(pair)
      events.push(
        { tick: state.tick, type: 'ship.collision', sourceId: a.id, targetId: b.id, damage: damageA, position: { ...updatedA.pos }, hitSection: collisionHitSection(a, nx, ny) },
        { tick: state.tick, type: 'ship.collision', sourceId: b.id, targetId: a.id, damage: damageB, position: { ...updatedB.pos }, hitSection: collisionHitSection(b, -nx, -ny) },
      )
      if (a.team === 'player') metrics.playerDamageTaken += a.hp - updatedA.hp
      if (b.team === 'player') metrics.playerDamageTaken += b.hp - updatedB.hp
      for (const ship of [updatedA, updatedB]) if (ship.destroyed) {
        if (ship.team === 'enemy') metrics.enemiesDestroyed++
        events.push({ tick: state.tick, type: 'entity.destroyed', targetId: ship.id, position: { ...ship.pos } })
      }
    }
    if (!corrected) break
  }

  return { ...state, entities, eventLog: [...state.eventLog, ...events], metrics }
}

/** Substeps prevent fast ships crossing a narrow hull between fixed ticks. */
export function stepMovementAndCollisions(state: CombatState): CombatState {
  const ships = [...state.entities.values()].filter(e => e.kind === 'ship' && !e.destroyed) as ShipEntity[]
  const speed = Math.max(0, ...ships.map(s => Math.max(Math.abs(s.speed), Math.abs(s.targetSpeed))))
  const beam = Math.min(Infinity, ...ships.map(s => shipContactDimensions(s).beam))
  const steps = Math.max(1, Math.ceil(speed * MOVEMENT_SCALE * 2 / Math.max(4, beam * .45)))
  let next = state
  for (let i = 0; i < steps; i++) next = stepCollisions(stepMovement(next, 1 / steps))
  return next
}

function collisionHitSection(ship: ShipEntity, nx: number, ny: number): string {
  const dot = nx * Math.cos(ship.angle) + ny * Math.sin(ship.angle)
  if (dot > 0.6) return 'bow'
  if (dot < -0.6) return 'stern'
  return 'superstructure'
}
