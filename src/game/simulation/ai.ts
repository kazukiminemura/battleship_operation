import type { CombatState, ShipEntity, BuildingEntity, Command, Vec3, MapObstacle } from './types'
import type { SeededRandom } from './random'
import { getWeaponConfig, WEAPON_CONFIGS } from './weapon-strategies'
import { enemyCanDetectPlayer } from './detection'

// AI keeps this margin inside weapon maxRange before firing
const RANGE_MARGIN = 0.85

export function generateAiCommands(state: CombatState, rng: SeededRandom): Command[] {
  const commands: Command[] = []

  const player = [...state.entities.values()].find(
    e => e.kind === 'ship' && (e as ShipEntity).team === 'player' && !(e as ShipEntity).destroyed
  ) as ShipEntity | undefined

  if (!player) return commands

  const enemies = [...state.entities.values()].filter(
    e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy' && !(e as ShipEntity).destroyed
  ) as ShipEntity[]

  for (const enemy of enemies) {
    const dx = player.pos.x - enemy.pos.x
    const dy = player.pos.y - enemy.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // If player is outside this enemy's visual range, just hold position
    if (!enemyCanDetectPlayer(enemy, player)) {
      commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
      continue
    }

    const angleToPlayer = Math.atan2(dy, dx)
    const angleDiff = normalizeAngle(angleToPlayer - enemy.angle)

    // always rotate toward player
    if (Math.abs(angleDiff) > 0.05) {
      commands.push({
        tick: state.tick, actorId: enemy.id, type: 'rotate',
        value: Math.sign(angleDiff) * enemy.turnRate,
      })
    }

    if (enemy.templateId === 'hull.enemy.destroyer.basic') {
      const gun = enemy.weapons.find(w => w.type === 'gun')
      const gunRange = gun ? getWeaponConfig(gun.id, gun.type).maxRange * RANGE_MARGIN : 0

      if (dist > gunRange) {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: enemy.maxSpeed })
      } else {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
        if (gun && gun.cooldownTick === 0 && gun.ammo > 0) {
          const spread = rng.nextFloat(-30, 30)
          commands.push({
            tick: state.tick, actorId: enemy.id, type: 'fire.primary',
            target: { x: player.pos.x + spread, y: player.pos.y + spread, z: 0 },
          })
        }
      }
    } else if (enemy.templateId === 'hull.cruiser.basic' || enemy.templateId === 'hull.enemy.boss.dreadnought') {
      const torpRange    = WEAPON_CONFIGS.torpedo.maxRange * RANGE_MARGIN
      const preferredDist = enemy.templateId === 'hull.enemy.boss.dreadnought' ? 1900 : torpRange * 0.7

      if (dist > preferredDist + 100) {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: enemy.maxSpeed })
      } else if (dist < preferredDist - 100) {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: -enemy.maxSpeed * 0.5 })
      } else {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
      }

      for (let slot = 0; slot < enemy.weapons.length; slot++) {
        const weapon = enemy.weapons[slot]!
        if (weapon.cooldownTick > 0 || weapon.ammo <= 0) continue
        const range = getWeaponConfig(weapon.id, weapon.type).maxRange * RANGE_MARGIN
        if (dist > range) continue

        if (weapon.type === 'torpedo') {
          commands.push({
            tick: state.tick, actorId: enemy.id, type: 'fire.slot', value: slot,
            target: { x: player.pos.x, y: player.pos.y, z: 0 },
          })
        } else {
          const spread = enemy.templateId === 'hull.enemy.boss.dreadnought' ? rng.nextFloat(-45, 45) : 0
          commands.push({
            tick: state.tick, actorId: enemy.id, type: 'fire.slot', value: slot,
            target: { x: player.pos.x + spread, y: player.pos.y + spread, z: 0 },
          })
        }
      }
    }
  }

  return commands
}

// Search waypoint: north-center of the map, toward typical enemy positions
const SEARCH_WAYPOINT: Vec3 = { x: 5000, y: 3500, z: 0 }

export function generateAutoPilotCommands(state: CombatState): Command[] {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return []
  const ship = player as ShipEntity
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
  // Auto-pilot treats all enemies as known (full map awareness)
  const enemies = [...state.entities.values()].filter(
    e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy' && !(e as ShipEntity).destroyed
  ) as ShipEntity[]

  if (enemies.length > 0) return nearest(ship.pos, enemies.map(e => e.pos))

  const buildings = [...state.entities.values()].filter(
    e => e.kind === 'building' && !(e as BuildingEntity).destroyed
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
