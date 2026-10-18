import type { CombatState, ShipEntity, BuildingEntity, Command, Vec3, MapObstacle, WeaponState } from './types'
import { isShip, isBuilding } from './types'
import type { SeededRandom } from './random'
import { getWeaponConfig, WEAPON_CONFIGS, WEAPON_AIM_ERRORS } from './weapon-strategies'
import { isOnLand } from './movement'
import { shipContactDimensions } from './ship-contact'
import { enemyCanDetectPlayer } from './detection'
import { planGunRun } from './naval-tactics'

const RANGE_MARGIN = 0.85

const ENGAGEMENT_RANGES: Record<string, (enemy: ShipEntity) => number> = {
  'hull.enemy.destroyer.basic': enemy => {
    const gun = enemy.weapons.find(weapon => weapon.type === 'gun')
    return (gun ? getWeaponConfig(gun.id, gun.type).maxRange : WEAPON_CONFIGS.gun.maxRange) * .72
  },
  'hull.cruiser.basic': () => WEAPON_CONFIGS.torpedo.maxRange * RANGE_MARGIN * .7,
  'hull.enemy.boss.dreadnought': () => 1900,
}

export function generateAiCommands(state: CombatState, rng: SeededRandom): Command[] {
  const commands: Command[] = []

  const player = [...state.entities.values()].find(
    e => isShip(e) && e.team === 'player' && !e.destroyed,
  ) as ShipEntity | undefined

  if (!player) return commands

  const enemies = [...state.entities.values()].filter(
    e => isShip(e) && e.team === 'enemy' && !e.destroyed,
  ) as ShipEntity[]

  for (const enemy of enemies) {
    const dx = player.pos.x - enemy.pos.x
    const dy = player.pos.y - enemy.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (!enemyCanDetectPlayer(enemy, player, state.weather)) {
      commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
      continue
    }

    const preferredRange = ENGAGEMENT_RANGES[enemy.templateId]?.(enemy)
    if (preferredRange === undefined) {
      commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
      continue
    }
    const maneuver = planGunRun(enemy, player.pos, preferredRange)
    const avoidance = shipCollisionAvoidance(enemy, state)
    const shore = obstacleSteer(enemy, state.mapObstacles)
    const angleDiff = normalizeAngle(maneuver.heading - enemy.angle)
    const steer = shore || avoidance?.steer || (Math.abs(angleDiff) > .05 ? Math.sign(angleDiff) : 0)
    if (steer) commands.push({ tick: state.tick, actorId: enemy.id, type: 'rotate', value: steer * enemy.turnRate })
    commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: maneuver.speed * (shore ? 1 : avoidance?.speedFactor ?? 1) })
    for (let slot = 0; slot < enemy.weapons.length; slot++) {
      const weapon = enemy.weapons[slot]!
      if (weapon.cooldownTick > 0 || weapon.ammo <= 0) continue
      const range = getWeaponConfig(weapon.id, weapon.type).maxRange * RANGE_MARGIN
      if (dist > range) continue
      commands.push({ tick: state.tick, actorId: enemy.id, type: 'fire.slot', value: slot,
        target: enemyAimTarget(enemy, player, weapon, range, dist, rng),
      })
    }
  }

  return commands
}

function enemyAimTarget(
  enemy: ShipEntity,
  player: ShipEntity,
  weapon: WeaponState,
  effectiveRange: number,
  dist: number,
  rng: SeededRandom,
): Vec3 {
  const baseError = WEAPON_AIM_ERRORS[weapon.type]
  const shipFactor = enemy.templateId === 'hull.enemy.boss.dreadnought'
    ? 1.45
    : enemy.templateId === 'hull.cruiser.basic'
      ? 1.18
      : 1.0
  const distanceFactor = 0.55 + Math.min(1, dist / Math.max(1, effectiveRange)) * 0.75
  const radius = baseError * shipFactor * distanceFactor
  const angle = rng.nextFloat(0, Math.PI * 2)
  const offset = radius * Math.sqrt(rng.nextFloat(0, 1))

  return {
    x: player.pos.x + Math.cos(angle) * offset,
    y: player.pos.y + Math.sin(angle) * offset,
    z: 0,
  }
}

// Search waypoint: north-center of the map, toward typical enemy positions
const SEARCH_WAYPOINT: Vec3 = { x: 5000, y: 3500, z: 0 }

export function generateAutoPilotCommands(state: CombatState): Command[] {
  const player = state.entities.get('ship.player')
  if (!player || !isShip(player)) return []
  const ship = player
  if (!ship.autoPilot) return []

  const actorId = 'ship.player'
  const tick = state.tick
  const cmds: Command[] = []

  const collisionAvoidance = shipCollisionAvoidance(ship, state)
  if (collisionAvoidance) {
    cmds.push({ tick, actorId, type: 'rotate', value: collisionAvoidance.steer * ship.turnRate })
    cmds.push({ tick, actorId, type: 'move', value: ship.maxSpeed * collisionAvoidance.speedFactor })
    return cmds
  }

  // Obstacle avoidance has top priority
  const steer = obstacleSteer(ship, state.mapObstacles)
  if (steer !== 0) {
    cmds.push({ tick, actorId, type: 'rotate', value: steer * ship.turnRate })
    cmds.push({ tick, actorId, type: 'move', value: ship.maxSpeed })
    return cmds
  }

  const targetPos = findTarget(state, ship) ?? SEARCH_WAYPOINT

  const dx = targetPos.x - ship.pos.x
  const dy = targetPos.y - ship.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const angleDiff = normalizeAngle(Math.atan2(dy, dx) - ship.angle)

  if (Math.abs(angleDiff) > 0.05) {
    cmds.push({ tick, actorId, type: 'rotate', value: Math.sign(angleDiff) * ship.turnRate })
  }

  // Slow down while turning hard to keep arc tight; always advance toward target
  const factor = Math.abs(angleDiff) > Math.PI / 2 ? 0.4 : 1.0
  cmds.push({ tick, actorId, type: 'move', value: ship.maxSpeed * factor })

  return cmds
}

function findTarget(state: CombatState, ship: ShipEntity): Vec3 | undefined {
  const enemies = [...state.entities.values()].filter(
    e => isShip(e) && e.team === 'enemy' && !e.destroyed,
  ) as ShipEntity[]

  if (enemies.length > 0) return nearest(ship.pos, enemies.map(e => e.pos))

  const buildings = [...state.entities.values()].filter(
    e => isBuilding(e) && !e.destroyed,
  ) as BuildingEntity[]

  if (buildings.length > 0) return nearest(ship.pos, buildings.map(b => b.pos))

  return undefined
}

function shipCollisionAvoidance(ship: ShipEntity, state: CombatState): { steer: number; speedFactor: number } | null {
  const own = shipContactDimensions(ship)
  const fx = Math.cos(ship.angle), fy = Math.sin(ship.angle)
  let nearest = Infinity, side = -1
  for (const entity of state.entities.values()) {
    if (!isShip(entity) || entity.id === ship.id || entity.destroyed) continue
    const dx = entity.pos.x - ship.pos.x, dy = entity.pos.y - ship.pos.y
    const ahead = dx * fx + dy * fy
    if (ahead <= 0) continue
    const other = shipContactDimensions(entity)
    const relative = entity.angle - ship.angle
    const clearance = own.beam / 2 + Math.abs(Math.sin(relative)) * other.length / 2 + Math.abs(Math.cos(relative)) * other.beam / 2 + 45
    const lateral = dx * -fy + dy * fx
    const gap = ahead - own.length / 2 - other.length / 2
    if (gap > 340 || Math.abs(lateral) > clearance || gap >= nearest) continue
    nearest = gap
    side = lateral >= 0 ? -1 : 1
  }
  return nearest < Infinity ? { steer: side, speedFactor: nearest < 80 ? .25 : .6 } : null
}

function obstacleSteer(ship: ShipEntity, obstacles: readonly MapObstacle[]): number {
  const dimensions = shipContactDimensions(ship)
  const lookahead = dimensions.length / 2 + Math.max(180, Math.abs(ship.speed) * 45)
  const margin = dimensions.beam / 2 + 35
  const fx = Math.cos(ship.angle), fy = Math.sin(ship.angle)
  for (const fraction of [.4, .7, 1]) for (const offset of [-margin, 0, margin]) {
    const x = ship.pos.x + fx * lookahead * fraction - fy * offset
    const y = ship.pos.y + fy * lookahead * fraction + fx * offset
    const coast = obstacles.find(obstacle => isOnLand(x, y, [obstacle]))
    if (!coast) continue
    const rel = normalizeAngle(Math.atan2(coast.y - ship.pos.y, coast.x - ship.pos.x) - ship.angle)
    return rel >= 0 ? -1 : 1
  }
  return 0
}


function nearest(from: Vec3, positions: Vec3[]): Vec3 {
  return positions.reduce((best, p) => {
    const d1 = (p.x - from.x) ** 2 + (p.y - from.y) ** 2
    const d2 = (best.x - from.x) ** 2 + (best.y - from.y) ** 2
    return d1 < d2 ? p : best
  })
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}
