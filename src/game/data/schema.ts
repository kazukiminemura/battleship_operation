import type { ShipTemplate, StaticData } from './masterdata'

export function validateShipTemplate(t: ShipTemplate): string[] {
  const errors: string[] = []
  if (!t.id) errors.push('template missing id')
  if (t.hp <= 0) errors.push(`${t.id}: hp must be > 0`)
  if (t.maxSpeed <= 0) errors.push(`${t.id}: maxSpeed must be > 0`)
  if (t.turnRate <= 0) errors.push(`${t.id}: turnRate must be > 0`)
  if (!t.weapons.length) errors.push(`${t.id}: must have at least one weapon`)
  return errors
}

export function validateStaticData(data: StaticData): string[] {
  const errors: string[] = []
  for (const template of Object.values(data.ships)) {
    errors.push(...validateShipTemplate(template))
  }
  return errors
}
