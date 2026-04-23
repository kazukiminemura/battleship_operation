export type ShellType = 'AP' | 'HE' | 'SAP'

export interface GunProfile {
  caliber: number       // mm
  barrelLength: number  // 口径倍数 (e.g. 45 = L/45)
  shellType: ShellType
}

/**
 * 散布界の半角（ラジアン）を返す。
 *
 * - 口径大 → 散布大
 * - 砲身長 → 長いほど初速↑・弾道安定 → 散布小
 * - 弾種 AP < SAP < HE の順で散布大
 * - 距離依存: 最大射程に近づくほど散布増大
 */
export function calcDispersionHalfAngle(
  profile: GunProfile,
  range: number,
  maxRange: number,
): number {
  const barrelFactor  = 50 / profile.barrelLength   // 基準 L/50
  const caliberFactor = profile.caliber / 127        // 基準 127mm
  const shellFactor   = profile.shellType === 'AP'  ? 0.8
                      : profile.shellType === 'SAP' ? 1.0
                      : 1.25                          // HE

  const baseAngle  = 0.005 * caliberFactor * barrelFactor * shellFactor
  const rangeFactor = 0.4 + 0.6 * (range / maxRange)

  return baseAngle * rangeFactor
}

// 武器ID → 砲諸元（砲身長は実在艦砲を参考にした代表値）
export const GUN_PROFILES: Record<string, GunProfile> = {
  // 主砲 (gun)
  'weapon.gun.127mm.twin': { caliber: 127, barrelLength: 38, shellType: 'HE' }, // 5"/38 駆逐艦主砲 連装
  'weapon.gun.152mm.twin': { caliber: 152, barrelLength: 55, shellType: 'AP' }, // 6"/55 巡洋艦主砲 連装
  'weapon.gun.152mm.twin.forward': { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.152mm.twin.aft': { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.406mm.twin': { caliber: 406, barrelLength: 45, shellType: 'AP' }, // 16"/45 戦艦主砲 連装
  'weapon.gun.406mm.twin.forward': { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.406mm.twin.center': { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.406mm.twin.aft': { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.boss.460mm.twin.forward': { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.boss.460mm.twin.center': { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.boss.460mm.twin.aft': { caliber: 460, barrelLength: 45, shellType: 'AP' },
  // 副砲 (secondary)
  'weapon.secondary.127mm.twin': { caliber: 127, barrelLength: 38, shellType: 'HE' }, // 5"/38 連装副砲
  'weapon.secondary.152mm.twin': { caliber: 152, barrelLength: 55, shellType: 'AP' }, // 6"/55 連装副砲
  'weapon.secondary.152mm.twin.port': { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.secondary.152mm.twin.starboard': { caliber: 152, barrelLength: 55, shellType: 'AP' },
}
