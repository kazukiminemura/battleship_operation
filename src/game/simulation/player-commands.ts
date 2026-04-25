import type { CombatState, ShipEntity, WeaponState } from './types'

export function selectedWeapon(state: CombatState, weaponSlot: number): WeaponState | undefined {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return undefined
  return (player as ShipEntity).weapons[weaponSlot]
}

export function isBossStage(state: CombatState): boolean {
  return [...state.entities.values()].some(
    e => e.kind === 'ship' && !e.destroyed && (e as ShipEntity).templateId === 'hull.enemy.boss.dreadnought',
  )
}

export function toggleWeaponAutoFire(state: CombatState, weaponSlot: number): CombatState {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return state
  const ship = player as ShipEntity
  const weapons = ship.weapons.map((w, i) =>
    i === weaponSlot ? { ...w, autoFire: !w.autoFire } : w,
  )
  const entities = new Map(state.entities)
  entities.set('ship.player', { ...ship, weapons })
  return { ...state, entities }
}

export function toggleAutoPilot(state: CombatState): CombatState {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return state
  const ship = player as ShipEntity
  const entities = new Map(state.entities)
  entities.set('ship.player', { ...ship, autoPilot: !ship.autoPilot })
  return { ...state, entities }
}

export function toggleAllAutoFire(state: CombatState): CombatState {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return state
  const ship = player as ShipEntity
  const allAuto = ship.weapons.every(w => w.autoFire)
  const weapons = ship.weapons.map(w => ({ ...w, autoFire: !allAuto }))
  const entities = new Map(state.entities)
  entities.set('ship.player', { ...ship, weapons })
  return { ...state, entities }
}
