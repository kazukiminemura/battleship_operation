import type { CombatState, ShipEntity, Command } from './types'
import type { SeededRandom } from './random'
import { WEAPON_CONFIGS } from './weapons'

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
      const gunRange = WEAPON_CONFIGS.gun.maxRange * RANGE_MARGIN

      if (dist > gunRange) {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: enemy.maxSpeed })
      } else {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
        const gun = enemy.weapons.find(w => w.type === 'gun')
        if (gun && gun.cooldownTick === 0 && gun.ammo > 0) {
          const spread = rng.nextFloat(-30, 30)
          commands.push({
            tick: state.tick, actorId: enemy.id, type: 'fire.primary',
            target: { x: player.pos.x + spread, y: player.pos.y + spread, z: 0 },
          })
        }
      }
    } else if (enemy.templateId === 'hull.cruiser.basic') {
      const torpRange    = WEAPON_CONFIGS.torpedo.maxRange * RANGE_MARGIN
      const preferredDist = torpRange * 0.7  // preferred combat distance

      if (dist > preferredDist + 100) {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: enemy.maxSpeed })
      } else if (dist < preferredDist - 100) {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'move', value: -enemy.maxSpeed * 0.5 })
      } else {
        commands.push({ tick: state.tick, actorId: enemy.id, type: 'stop' })
      }

      if (dist <= torpRange) {
        const torpedo = enemy.weapons.find(w => w.type === 'torpedo')
        if (torpedo && torpedo.cooldownTick === 0 && torpedo.ammo > 0) {
          commands.push({
            tick: state.tick, actorId: enemy.id, type: 'fire.torpedo',
            target: { x: player.pos.x, y: player.pos.y, z: 0 },
          })
        }
      }
      const gunRange = WEAPON_CONFIGS.gun.maxRange * RANGE_MARGIN
      if (dist <= gunRange) {
        const gun = enemy.weapons.find(w => w.type === 'gun')
        if (gun && gun.cooldownTick === 0 && gun.ammo > 0) {
          commands.push({
            tick: state.tick, actorId: enemy.id, type: 'fire.primary',
            target: { x: player.pos.x, y: player.pos.y, z: 0 },
          })
        }
      }
    }
  }

  return commands
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}
