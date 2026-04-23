import { WEAPON_CATALOG } from './weapon-catalog'
import { WEAPON_SHOP } from './weapon-shop'

const WEAPON_NAME_BY_ID = new Map<string, string>([
  ...WEAPON_SHOP.map(w => [w.id, w.name] as const),
  ...Object.values(WEAPON_CATALOG).flatMap(slots =>
    slots.flatMap(slot => slot.options.map(opt => [opt.id, opt.name] as const))
  ),
])

const TYPE_LABELS: Record<string, string> = {
  gun: '主砲',
  secondary: '副砲',
  torpedo: '魚雷',
  aa: '対空砲',
  missile: 'ミサイル',
}

const POSITION_LABELS: Record<string, string> = {
  forward: '前部',
  center: '中央',
  aft: '後部',
  port: '左舷',
  starboard: '右舷',
}

const AMMO_LABELS: Record<string, string> = {
  ap: 'AP',
  he: 'HE',
}

const SPECIAL_LABELS: Record<string, string> = {
  basic: '標準',
  twin: '連装',
  single: '単装',
  longrange: '長射程',
  antiship: '対艦',
  cruise: '巡航',
  sam: 'SAM',
  ciws: 'CIWS',
  heavy: '重',
  dd: '軽',
  cl: '巡洋艦',
  bb: '戦艦',
}

export function displayWeaponName(id: string): string {
  const catalogName = WEAPON_NAME_BY_ID.get(id)
  if (catalogName) return catalogName

  if (!id.startsWith('weapon.')) return id

  const parts = id.split('.')
  const type = parts[1]
  const details = parts.slice(2)
  const caliber = details.find(p => /^\d+mm$/.test(p))
  const position = details.find(p => POSITION_LABELS[p])
  const ammo = details.find(p => AMMO_LABELS[p])
  const specials = details
    .filter(p => p !== caliber && p !== position && p !== ammo)
    .map(p => SPECIAL_LABELS[p])
    .filter((label): label is string => Boolean(label))

  const tokens = [
    position ? POSITION_LABELS[position] : undefined,
    caliber ? formatCaliber(caliber) : undefined,
    ammo ? AMMO_LABELS[ammo] : undefined,
    ...specials,
    TYPE_LABELS[type ?? ''],
  ].filter((label): label is string => Boolean(label))

  return tokens.length > 0 ? tokens.join(' ') : id
}

function formatCaliber(value: string): string {
  const mm = Number(value.replace('mm', ''))
  if (!Number.isFinite(mm)) return value
  if (mm >= 100) return `${(mm / 10).toFixed(1).replace(/\.0$/, '')}cm`
  return `${mm}mm`
}
