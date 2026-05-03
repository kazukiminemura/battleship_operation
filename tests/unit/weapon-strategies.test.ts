import { describe, expect, it } from 'vitest'
import { getWeaponConfig, getWeaponStrategy, WEAPON_CONFIGS } from '../../src/game/simulation/weapon-strategies'
import { TICKS_PER_SECOND } from '../../src/game/simulation/ticker'
import type { BuildingEntity } from '../../src/game/simulation/types'

function building(team: BuildingEntity['team'] = 'enemy'): BuildingEntity {
  return {
    kind: 'building',
    id: 'building.test',
    pos: { x: 0, y: 0, z: 0 },
    hp: 100,
    maxHp: 100,
    radius: 40,
    team,
    destroyed: false,
    templateId: 'building.test',
  }
}

describe('weapon strategies', () => {
  it('exposes range config for every weapon type', () => {
    expect(WEAPON_CONFIGS.gun.maxRange).toBeGreaterThan(0)
    expect(WEAPON_CONFIGS.aa.maxRange).toBeGreaterThan(0)
    expect(WEAPON_CONFIGS.missile.maxRange).toBeGreaterThan(0)
    expect(WEAPON_CONFIGS.torpedo.maxRange).toBeGreaterThan(0)
  })

  it('keeps torpedoes from targeting buildings', () => {
    expect(getWeaponStrategy('torpedo').canTargetBuilding(building())).toBe(false)
    expect(getWeaponStrategy('gun').canTargetBuilding(building())).toBe(true)
  })

  it('uses the larger of hit radius and building radius', () => {
    expect(getWeaponStrategy('aa').buildingHitRadius(building())).toBe(40)
    expect(getWeaponStrategy('missile').buildingHitRadius({ ...building(), radius: 5 })).toBe(25)
  })

  it('supports long-range battleship weapon overrides', () => {
    expect(getWeaponConfig('weapon.gun.406mm.twin.forward', 'gun').maxRange)
      .toBeGreaterThan(WEAPON_CONFIGS.gun.maxRange)
    expect(getWeaponConfig('weapon.missile.battleship.longrange', 'missile').maxRange)
      .toBeGreaterThan(WEAPON_CONFIGS.missile.maxRange)
  })

  it('uses realistic reload windows for representative weapons', () => {
    expect(getWeaponConfig('weapon.gun.406mm.twin', 'gun').cooldown).toBe(32 * TICKS_PER_SECOND)
    expect(getWeaponConfig('weapon.gun.460mm', 'gun').cooldown).toBe(40 * TICKS_PER_SECOND)
    expect(getWeaponConfig('weapon.torpedo.610mm.dd', 'torpedo').cooldown).toBe(80 * TICKS_PER_SECOND)
    expect(getWeaponConfig('weapon.aa.ciws.bb', 'aa').cooldown).toBeLessThan(TICKS_PER_SECOND)
  })
})
