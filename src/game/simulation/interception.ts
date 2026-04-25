import type { ProjectileEntity } from './types'

const INTERCEPTABLE_ID_PARTS = ['torpedo', 'mine', 'rocket', 'missile']

export function isInterceptableProjectile(projectile: ProjectileEntity): boolean {
  if (projectile.destroyed) return false
  if (projectile.weaponType === 'torpedo' || projectile.weaponType === 'missile') return true
  const id = projectile.weaponId ?? projectile.id
  return INTERCEPTABLE_ID_PARTS.some(part => id.includes(part))
}

export function projectileInterceptRadius(projectile: ProjectileEntity): number {
  const id = projectile.weaponId ?? projectile.id
  if (id.includes('mine')) return 34
  if (id.includes('rocket')) return 28
  if (projectile.weaponType === 'torpedo' || id.includes('torpedo')) return 32
  if (projectile.weaponType === 'missile' || id.includes('missile')) return 26
  return 24
}
