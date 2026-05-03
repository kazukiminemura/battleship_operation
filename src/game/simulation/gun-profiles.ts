export type ShellType = 'AP' | 'HE' | 'SAP'

export interface GunProfile {
  caliber: number       // mm
  barrelLength: number  // 口径倍数 (e.g. 45 = L/45)
  shellType: ShellType
}

/**
 * 散布界の半角（ラジアン）を返す。
 *
 * - 口径大 → 散布大。ただし口径へ線形比例させず、平方根で穏やかに増やす
 * - 砲身長 → 長いほど初速↑・弾道安定 → 散布小
 * - 弾種 AP < SAP < HE の順で散布大
 * - 距離依存: 最大射程に近づくほど散布増大
 *
 * 返す値は「照準線からの半角」。このゲームの交戦距離は実距離より
 * 圧縮されているため、画面上で読める程度に数十m級の散布へ換算する。
 */
export function calcDispersionHalfAngle(
  profile: GunProfile,
  range: number,
  maxRange: number,
): number {
  const barrelFactor  = 45 / profile.barrelLength
  const caliberFactor = Math.sqrt(profile.caliber / 127)
  const shellFactor   = profile.shellType === 'AP'  ? 0.90
                      : profile.shellType === 'SAP' ? 1.00
                      : 1.12

  const baseAngle = 0.046 * caliberFactor * barrelFactor * shellFactor
  const ratio = Math.max(0, Math.min(1, range / Math.max(1, maxRange)))
  const rangeFactor = 0.35 + 0.65 * Math.pow(ratio, 1.25)

  return baseAngle * rangeFactor
}

// 武器ID → 砲諸元（砲身長は実在艦砲を参考にした代表値）
export const GUN_PROFILES: Record<string, GunProfile> = {
  // 主砲 — 正規ID（位置情報なし）
  'weapon.gun.127mm.twin':  { caliber: 127, barrelLength: 38, shellType: 'HE' },
  'weapon.gun.127mm.ap':    { caliber: 127, barrelLength: 38, shellType: 'AP' },
  'weapon.gun.152mm.twin':  { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.203mm':       { caliber: 203, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.406mm.twin':  { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.406mm.he':    { caliber: 406, barrelLength: 45, shellType: 'HE' },
  'weapon.gun.460mm':       { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.1000mm.hyper': { caliber: 1000, barrelLength: 35, shellType: 'HE' },
  'weapon.gun.rail.ultimate': { caliber: 320, barrelLength: 80, shellType: 'AP' },
  // 副砲 — 正規ID
  'weapon.secondary.127mm.twin':  { caliber: 127, barrelLength: 38, shellType: 'HE' },
  'weapon.secondary.152mm.twin':  { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.secondary.127mm.bb':    { caliber: 127, barrelLength: 38, shellType: 'HE' },
  // 位置別エイリアス（ships.json の敵艦互換）
  'weapon.gun.152mm.twin.forward': { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.152mm.twin.aft':     { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.406mm.twin.forward': { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.406mm.twin.center':  { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.406mm.twin.aft':     { caliber: 406, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.203mm.forward':      { caliber: 203, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.203mm.aft':          { caliber: 203, barrelLength: 55, shellType: 'AP' },
  'weapon.gun.406mm.he.forward':   { caliber: 406, barrelLength: 45, shellType: 'HE' },
  'weapon.gun.406mm.he.center':    { caliber: 406, barrelLength: 45, shellType: 'HE' },
  'weapon.gun.406mm.he.aft':       { caliber: 406, barrelLength: 45, shellType: 'HE' },
  'weapon.gun.460mm.forward':      { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.460mm.center':       { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.gun.460mm.aft':          { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.boss.460mm.twin.forward': { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.boss.460mm.twin.center':  { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.boss.460mm.twin.aft':     { caliber: 460, barrelLength: 45, shellType: 'AP' },
  'weapon.secondary.152mm.twin.port':      { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.secondary.152mm.twin.starboard': { caliber: 152, barrelLength: 55, shellType: 'AP' },
  'weapon.secondary.127mm.bb.port':        { caliber: 127, barrelLength: 38, shellType: 'HE' },
  'weapon.secondary.127mm.bb.starboard':   { caliber: 127, barrelLength: 38, shellType: 'HE' },
}
