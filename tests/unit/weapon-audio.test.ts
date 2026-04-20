import { describe, expect, it } from 'vitest'
import { inferWeaponSoundClass, inferWeaponType } from '../../src/game/audio/weapon-audio'

describe('weapon audio classification', () => {
  it('maps ids to weapon types used by splash sounds', () => {
    expect(inferWeaponType('weapon.torpedo.533mm.basic')).toBe('torpedo')
    expect(inferWeaponType('weapon.aa.basic')).toBe('aa')
    expect(inferWeaponType('weapon.missile.basic')).toBe('missile')
    expect(inferWeaponType('weapon.gun.127mm.single')).toBe('gun')
  })

  it('maps ids to distinct sound classes', () => {
    expect(inferWeaponSoundClass('weapon.aa.basic')).toBe('machineGun')
    expect(inferWeaponSoundClass('weapon.gun.406mm.single')).toBe('cannon')
    expect(inferWeaponSoundClass('weapon.missile.basic')).toBe('missile')
    expect(inferWeaponSoundClass('weapon.laser.prototype')).toBe('laser')
    expect(inferWeaponSoundClass('weapon.torpedo.533mm.basic')).toBe('torpedo')
  })
})
