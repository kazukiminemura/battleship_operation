import type { CombatState, ShipEntity, EnemyContact } from './types'

// Contact persistence: ticks to keep last-known position after losing detection
export const CONTACT_PERSIST_TICKS = 180

export function stepDetection(state: CombatState): CombatState {
  const player = state.entities.get('ship.player') as ShipEntity | undefined
  if (!player || player.destroyed) {
    return { ...state, detectedByPlayer: new Set(), enemyContacts: new Map(state.enemyContacts) }
  }

  const newDetected = new Set<string>()
  const newContacts = new Map<string, EnemyContact>(state.enemyContacts)

  for (const entity of state.entities.values()) {
    if (entity.kind !== 'ship' && entity.kind !== 'building') continue
    if (entity.team !== 'enemy' || entity.destroyed) continue

    const dx = entity.pos.x - player.pos.x
    const dy = entity.pos.y - player.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= player.detectionRange) {
      newDetected.add(entity.id)
      if (entity.kind === 'ship') {
        newContacts.set(entity.id, { pos: { ...entity.pos }, tick: state.tick })
      }
    }
  }

  // Expire stale contacts
  for (const [id, contact] of newContacts) {
    const entity = state.entities.get(id)
    if (!entity || (entity as ShipEntity).destroyed || state.tick - contact.tick > CONTACT_PERSIST_TICKS) {
      newContacts.delete(id)
    }
  }

  return { ...state, detectedByPlayer: newDetected, enemyContacts: newContacts }
}

// Returns true if the enemy ship can detect the player this tick
export function enemyCanDetectPlayer(enemy: ShipEntity, player: ShipEntity): boolean {
  const dx = player.pos.x - enemy.pos.x
  const dy = player.pos.y - enemy.pos.y
  return Math.sqrt(dx * dx + dy * dy) <= enemy.detectionRange
}
