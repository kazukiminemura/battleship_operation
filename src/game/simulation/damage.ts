import type { ShipEntity } from './types'

export function applyDamage(ship: ShipEntity, amount: number): ShipEntity {
  const newHp = Math.max(0, Math.min(ship.maxHp, ship.hp - amount))
  return { ...ship, hp: newHp }
}

export function checkDestroyed(ship: ShipEntity): ShipEntity {
  if (ship.hp <= 0 && !ship.destroyed) {
    return { ...ship, destroyed: true }
  }
  return ship
}
