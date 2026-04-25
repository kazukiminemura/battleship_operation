import type { CombatState, ShipEntity, BuildingEntity, Command, Vec3, MapObstacle, WeaponState, WeaponType } from './types'
import { isShip, isBuilding } from './types'
import type { SeededRandom } from './random'
import { getWeaponConfig, WEAPON_CONFIGS } from './weapon-strategies'
import { enemyCanDetectPlayer } from './detection'

const RANGE_MARGIN = 0.85
const ENEMY_AIM_ERROR_BY_WEAPON: Record<WeaponType, number> = {
  gun: 90,
  secondary: 75,
  torpedo: 80,
  aa: 55,
  missile: 130,
}

type AiBehaviorFn = (
  enemy: ShipEntity,
  player: ShipEntity,
  dist: number,
  tick: number,
  rng: SeededRandom,
) => Command[]

function destroyerBehavior(enemy: ShipEntity, player: ShipEntity, dist: number, tick: number, rng: SeededRandom): Command[] {
  const cmds: Command[] = []
  const gun = enemy.weapons.find(w => w.type === 'gun')
  const gunRange = gun ? getWeaponConfig(gun.id, gun.type).maxRange * RANGE_MARGIN : 0

  if (dist > gunRange) {
    cmds.push({ tick, actorId: enemy.id, type: 'move', value: enemy.maxSpeed })
  } else {
    cmds.push({ tick, actorId: enemy.id, type: 'stop' })
    if (gun && gun.cooldownTick === 0 && gun.ammo > 0) {
      cmds.push({
        tick, actorId: enemy.id, type: 'fire.primary',
        target: enemyAimTarget(enemy, player, gun, gunRange, dist, rng),
      })
    }
  }
  return cmds
}

function makeRangeKiteAI(preferredDist: number): AiBehaviorFn {
  return (enemy, player, dist, tick, rng) => {
    const cmds: Command[] = []

    if (dist > preferredDist + 100) {
      cmds.push({ tick, actorId: enemy.id, type: 'move', value: enemy.maxSpeed })
    } else if (dist < preferredDist - 100) {
      cmds.push({ tick, actorId: enemy.id, type: 'move', value: -enemy.maxSpeed * 0.5 })
    } else {
      cmds.push({ tick, actorId: enemy.id, type: 'stop' })
    }

    for (let slot = 0; slot < enemy.weapons.length; slot++) {
      const weapon = enemy.weapons[slot]!
      if (weapon.cooldownTick > 0 || weapon.ammo <= 0) continue
      const range = getWeaponConfig(weapon.id, weapon.type).maxRange * RANGE_MARGIN
      if (dist > range) continue
      cmds.push({
        tick, actorId: enemy.id, type: 'fire.slot', value: slot,
        target: enemyAimTarget(enemy, player, weapon, range, dist, rng),
      })
    }
    return cmds
  }
}

const AI_BEHAVIORS: Record<string, AiBehaviorFn> = {
  'hull.enemy.destroyer.basic': destroyerBehavior,
  'hull.cruiser.basic': makeRangeKiteAI(WEAPON_CONFIGS.torpedo.maxRange * RANGE_MARGIN * 0.7),
  'hull.enemy.boss.dreadnought': makeRangeKiteAI(1900),
}

function defaultAiBehavior(enemy: ShipEntity, _player: ShipEntity, _dist: number, tick: number, _rng: SeededRandom): Command[] {
  return [{ tick, actorId: enemy.id, type: 'stop' }]
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

    if (!enemyCanDetectPlayer(enemy, player)) {
      commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
      continue
    }

    const angleDiff = normalizeAngle(Math.atan2(dy, dx) - enemy.angle)
    if (Math.abs(angleDiff) > 0.05) {
      commands.push({
        tick: state.tick, actorId: enemy.id, type: 'rotate',
        value: Math.sign(angleDiff) * enemy.turnRate,
      })
    }

    const behavior = AI_BEHAVIORS[enemy.templateId] ?? defaultAiBehavior
    commands.push(...behavior(enemy, player, dist, state.tick, rng))
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
  const baseError = ENEMY_AIM_ERROR_BY_WEAPON[weapon.type]
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


function obstacleSteer(ship: ShipEntity, obstacles: readonly MapObstacle[]): number {
  const LOOKAHEAD = 900
  const MARGIN   = 380

  const fx = ship.pos.x + Math.cos(ship.angle) * LOOKAHEAD
  const fy = ship.pos.y + Math.sin(ship.angle) * LOOKAHEAD

  let worstObs: MapObstacle | undefined
  let worstDepth = 0
  for (const obs of obstacles) {
    const nx = (fx - obs.x) / (obs.rx + MARGIN)
    const ny = (fy - obs.y) / (obs.ry + MARGIN)
    const depth = 1 - (nx * nx + ny * ny)
    if (depth > worstDepth) { worstDepth = depth; worstObs = obs }
  }
  if (!worstObs) return 0

  // Turn away from the side the obstacle center is on
  const rel = normalizeAngle(Math.atan2(worstObs.y - ship.pos.y, worstObs.x - ship.pos.x) - ship.angle)
  return rel >= 0 ? -1 : 1
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
