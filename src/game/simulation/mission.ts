import type { CombatState, ShipEntity } from './types'

export function evaluateMission(state: CombatState): 'none' | 'completed' | 'failed' {
  const player = state.entities.get('ship.player') as ShipEntity | undefined

  // mission failed if player is destroyed
  if (player && player.destroyed) return 'failed'

  const enemies = [...state.entities.values()].filter(
    e => e.kind === 'ship' && (e as ShipEntity).team === 'enemy'
  ) as ShipEntity[]

  if (enemies.length === 0) return 'none'

  const allEnemiesDestroyed = enemies.every(e => e.destroyed)
  if (allEnemiesDestroyed) return 'completed'

  return 'none'
}
