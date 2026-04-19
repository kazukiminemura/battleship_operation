import type { CombatState, ShipEntity, Command, SpeedLevel } from './types'

export const WORLD_SIZE = 10000
export const KNOTS_PER_UNIT = 10  // 1 game unit/tick = 10 knots for display
export const ISLAND_COLLIDER = { x: 5000, y: 5050, rx: 620, ry: 430 }

// speed level order from slowest to fastest
export const SPEED_LEVEL_ORDER: SpeedLevel[] = ['reverse', 'stop', 'slow', 'cruise', 'full']

// target speed (game units/tick) for each level
// full = 5 units/tick → displayed as 50 kt
export const SPEED_LEVEL_TARGET: Record<SpeedLevel, number> = {
  full:    5.0,
  cruise:  3.5,
  slow:    1.5,
  stop:    0.0,
  reverse: -1.5,
}

export const SPEED_LEVEL_LABEL: Record<SpeedLevel, string> = {
  full:    '全速力',
  cruise:  '巡航',
  slow:    '微速',
  stop:    '停止',
  reverse: '後退',
}

// acceleration toward targetSpeed per tick
const ACCEL_RATE = 0.08
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

    let px = ship.pos.x + vx * dt
    let py = ship.pos.y + vy * dt
    let finalSpeed = newSpeed
    let finalTargetSpeed = ship.targetSpeed

    if (px < 0)          { px = 0;          finalSpeed = 0; finalTargetSpeed = 0 }
    if (px > WORLD_SIZE) { px = WORLD_SIZE;  finalSpeed = 0; finalTargetSpeed = 0 }
    if (py < 0)          { py = 0;           finalSpeed = 0; finalTargetSpeed = 0 }
    if (py > WORLD_SIZE) { py = WORLD_SIZE;  finalSpeed = 0; finalTargetSpeed = 0 }

    if (isOnLand(px, py)) {
      const pushed = pushOutOfLand(px, py)
      px = pushed.x
      py = pushed.y
      finalSpeed = 0
      finalTargetSpeed = 0
    }

    entities.set(id, {
      ...ship,
      speed: finalSpeed,
      targetSpeed: finalTargetSpeed,
      vel: { x: Math.cos(ship.angle) * finalSpeed, y: Math.sin(ship.angle) * finalSpeed, z: 0 },
      pos: { x: px, y: py, z: 0 },
    })
  }

  return { ...state, entities }
}

export function isOnLand(x: number, y: number): boolean {
  const nx = (x - ISLAND_COLLIDER.x) / ISLAND_COLLIDER.rx
  const ny = (y - ISLAND_COLLIDER.y) / ISLAND_COLLIDER.ry
  return nx * nx + ny * ny < 1
}

function pushOutOfLand(x: number, y: number): { x: number; y: number } {
  const dx = x - ISLAND_COLLIDER.x
  const dy = y - ISLAND_COLLIDER.y
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: ISLAND_COLLIDER.x, y: ISLAND_COLLIDER.y + ISLAND_COLLIDER.ry + SHORE_PUSHOUT }
  }

  const angle = Math.atan2(dy / ISLAND_COLLIDER.ry, dx / ISLAND_COLLIDER.rx)
  return {
    x: ISLAND_COLLIDER.x + Math.cos(angle) * (ISLAND_COLLIDER.rx + SHORE_PUSHOUT),
    y: ISLAND_COLLIDER.y + Math.sin(angle) * (ISLAND_COLLIDER.ry + SHORE_PUSHOUT),
  }
}

export function applySpeedUpCommand(ship: ShipEntity): ShipEntity {
  const idx = SPEED_LEVEL_ORDER.indexOf(ship.speedLevel)
  const newIdx = Math.min(idx + 1, SPEED_LEVEL_ORDER.length - 1)
  const newLevel = SPEED_LEVEL_ORDER[newIdx]!
  return { ...ship, speedLevel: newLevel, targetSpeed: SPEED_LEVEL_TARGET[newLevel] }
}

export function applySpeedDownCommand(ship: ShipEntity): ShipEntity {
  const idx = SPEED_LEVEL_ORDER.indexOf(ship.speedLevel)
  const newIdx = Math.max(idx - 1, 0)
  const newLevel = SPEED_LEVEL_ORDER[newIdx]!
  return { ...ship, speedLevel: newLevel, targetSpeed: SPEED_LEVEL_TARGET[newLevel] }
}

export function applyRotateCommand(ship: ShipEntity, cmd: Command): ShipEntity {
  if (cmd.type !== 'rotate') return ship
  const delta = cmd.value ?? 0
  const clamped = Math.max(-ship.turnRate, Math.min(ship.turnRate, delta))
  const angle = ship.angle + clamped
  return { ...ship, angle }
}

// used by AI: directly sets targetSpeed without changing speedLevel label
export function applyMoveCommand(ship: ShipEntity, cmd: Command): ShipEntity {
  if (cmd.type !== 'move') return ship
  const speed = cmd.value ?? ship.maxSpeed
  const clamped = Math.min(Math.abs(speed), ship.maxSpeed) * Math.sign(speed)
  return { ...ship, targetSpeed: clamped }
}

export function applyStopCommand(ship: ShipEntity): ShipEntity {
  return { ...ship, targetSpeed: 0, speedLevel: 'stop' }
}
