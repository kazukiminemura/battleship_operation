import { describe, expect, it } from 'vitest'
import { getWeaponStrategy, WEAPON_CONFIGS } from '../../src/game/simulation/weapon-strategies'
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
})
