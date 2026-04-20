import type { WeaponType } from '../simulation/types'

export type WeaponSoundClass = 'machineGun' | 'cannon' | 'missile' | 'laser' | 'torpedo'

export function inferWeaponType(weaponId: string): WeaponType {
  if (weaponId === 'torpedo' || weaponId.includes('torpedo')) return 'torpedo'
  if (weaponId === 'aa'      || weaponId.includes('aa'))      return 'aa'
  if (weaponId === 'missile' || weaponId.includes('missile')) return 'missile'
  return 'gun'
}

export function inferWeaponSoundClass(weaponId: string): WeaponSoundClass {
  const id = weaponId.toLowerCase()
  if (id.includes('torpedo')) return 'torpedo'
  if (id.includes('missile') || id.includes('rocket')) return 'missile'
  if (id.includes('laser') || id.includes('beam')) return 'laser'
  if (id.includes('aa') || id.includes('machine') || id.includes('mg')) return 'machineGun'
  return 'cannon'
}
