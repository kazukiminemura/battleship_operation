import type { CombatState, ShipEntity, EnemyContact, WeatherCondition } from './types'

// Contact persistence: ticks to keep last-known position after losing detection
export const CONTACT_PERSIST_TICKS = 180

// Base visibility ranges in world units (approximately 20km clear, 10km rain, current distance at night)
const VISIBILITY_CLEAR = 20000
const VISIBILITY_RAIN = 10000

// Get effective detection range based on weather condition
function effectiveDetectionRange(baseRange: number, weather: WeatherCondition): number {
  // For night, use the ship's base detection range as-is (current distance)
  if (weather === 'night') {
    return baseRange
  }
  // For clear weather: ~20km
  if (weather === 'clear') {
    return Math.min(baseRange, VISIBILITY_CLEAR)
  }
  // For rain: ~10km
  if (weather === 'rain') {
    return Math.min(baseRange, VISIBILITY_RAIN)
  }
  return baseRange
}

export function stepDetection(state: CombatState): CombatState {
  const player = state.entities.get('ship.player') as ShipEntity | undefined
  if (!player || player.destroyed) {
    return { ...state, detectedByPlayer: new Set(), enemyContacts: new Map(state.enemyContacts) }
  }

  // Calculate effective detection range based on weather
  const effectiveRange = effectiveDetectionRange(player.detectionRange, state.weather)

  const newDetected = new Set<string>()
  const newContacts = new Map<string, EnemyContact>(state.enemyContacts)

  for (const entity of state.entities.values()) {
    if (entity.kind !== 'ship' && entity.kind !== 'building') continue
    if (entity.team !== 'enemy' || entity.destroyed) continue

    const dx = entity.pos.x - player.pos.x
    const dy = entity.pos.y - player.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= effectiveRange) {
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
export function enemyCanDetectPlayer(enemy: ShipEntity, player: ShipEntity, weather: WeatherCondition = 'clear'): boolean {
  const dx = player.pos.x - enemy.pos.x
  const dy = player.pos.y - enemy.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const effectiveRange = effectiveDetectionRange(enemy.detectionRange, weather)
  return dist <= effectiveRange
}
