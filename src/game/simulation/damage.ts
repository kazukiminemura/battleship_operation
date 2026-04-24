import type { BuildingEntity, ShipEntity } from './types'

type DamageableEntity = ShipEntity | BuildingEntity

export function applyDamage<T extends DamageableEntity>(entity: T, amount: number): T {
  const armor = 'armor' in entity ? (entity as ShipEntity).armor : 0
  const mitigation = armor / (armor + 100)
  const effective = amount * (1 - mitigation)
  const newHp = Math.max(0, Math.min(entity.maxHp, entity.hp - effective))
  return { ...entity, hp: newHp }
}

export function checkDestroyed<T extends DamageableEntity>(entity: T): T {
  if (entity.hp <= 0 && !entity.destroyed) {
    return { ...entity, destroyed: true }
  }
  return entity
}
