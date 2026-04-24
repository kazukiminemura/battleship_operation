import type { CombatState, ShipEntity, BuildingEntity, Command, Vec3 } from './types'
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

export function generateAutoPilotCommands(state: CombatState): Command[] {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return []
  const ship = player as ShipEntity
  if (!ship.autoPilot) return []

  const actorId = 'ship.player'
  const tick = state.tick

  // Target priority: detected enemy ships > detected buildings > last known contacts
  const detectedEnemies = [...state.entities.values()].filter(
    e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy' &&
         !(e as ShipEntity).destroyed && state.detectedByPlayer.has(e.id)
  ) as ShipEntity[]

  const detectedBuildings = [...state.entities.values()].filter(
    e => e.kind === 'building' && !(e as BuildingEntity).destroyed &&
         state.detectedByPlayer.has(e.id)
  ) as BuildingEntity[]

  let targetPos: Vec3 | undefined
  if (detectedEnemies.length > 0) {
    targetPos = nearest(ship.pos, detectedEnemies.map(e => e.pos))
  } else if (detectedBuildings.length > 0) {
    targetPos = nearest(ship.pos, detectedBuildings.map(b => b.pos))
  } else if (state.enemyContacts.size > 0) {
    let freshest: Vec3 | undefined
    let maxTick = -1
    for (const contact of state.enemyContacts.values()) {
      if (contact.tick > maxTick) { maxTick = contact.tick; freshest = contact.pos }
    }
    targetPos = freshest
  }

  if (!targetPos) return []

  const dx = targetPos.x - ship.pos.x
  const dy = targetPos.y - ship.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const angleDiff = normalizeAngle(Math.atan2(dy, dx) - ship.angle)

  const cmds: Command[] = []

  if (Math.abs(angleDiff) > 0.05) {
    cmds.push({ tick, actorId, type: 'rotate', value: Math.sign(angleDiff) * ship.turnRate })
  }

  const preferred = 800
  if (dist > preferred + 100) {
    cmds.push({ tick, actorId, type: 'move', value: ship.maxSpeed })
  } else if (dist < preferred - 100) {
    cmds.push({ tick, actorId, type: 'move', value: -ship.maxSpeed * 0.4 })
  } else {
    cmds.push({ tick, actorId, type: 'stop' })
  }

  return cmds
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
