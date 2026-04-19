import type { BuildingEntity, ShipEntity } from './types'

type DamageableEntity = ShipEntity | BuildingEntity

export function applyDamage<T extends DamageableEntity>(entity: T, amount: number): T {
  const newHp = Math.max(0, Math.min(entity.maxHp, entity.hp - amount))
  return { ...entity, hp: newHp }
}

export function checkDestroyed<T extends DamageableEntity>(entity: T): T {
  if (entity.hp <= 0 && !entity.destroyed) {
    return { ...entity, destroyed: true }
  }
  return entity
}
