import type { WeaponSlotType } from './types'

interface Props {
  type: WeaponSlotType
  color: string
  size: number
}

/** Top-down blueprint silhouette of each weapon type. */
export function WeaponBlueprint({ type, color, size }: Props) {
  const sw = 1.2  // base stroke width (scaled by SVG)
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {BLUEPRINTS[type]({ color, sw })}
    </svg>
  )
}

type DrawProps = { color: string; sw: number }

const BLUEPRINTS: Record<WeaponSlotType, (p: DrawProps) => React.ReactNode> = {

  /* ── 主砲 ── 単砲塔、太い単一バレル ──────────────────────────────────── */
  gun: ({ color, sw }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* turret ring */}
      <circle cx="20" cy="22" r="11" strokeWidth={sw * 1.3} fill={color + '20'} />
      {/* barrel */}
      <rect x="17.5" y="4" width="5" height="20" rx="1.5" strokeWidth={sw * 1.4} fill={color + '28'} />
      {/* muzzle brake */}
      <rect x="15.5" y="4" width="9" height="3" rx="0.8" strokeWidth={sw} fill={color + '30'} />
      {/* rangefinder arms */}
      <rect x="8" y="18" width="6" height="3.5" rx="1" strokeWidth={sw * 0.9} fill={color + '18'} />
      <rect x="26" y="18" width="6" height="3.5" rx="1" strokeWidth={sw * 0.9} fill={color + '18'} />
      {/* pivot point */}
      <circle cx="20" cy="22" r="2.5" strokeWidth={sw * 0.8} fill={color + '40'} />
      {/* detail circle */}
      <circle cx="20" cy="22" r="7" strokeWidth={sw * 0.6} strokeDasharray="3 2" opacity="0.45" />
    </g>
  ),

  /* ── 副砲 ── 双連砲塔 ────────────────────────────────────────────────── */
  secondary: ({ color, sw }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* turret ring */}
      <circle cx="20" cy="23" r="9" strokeWidth={sw * 1.2} fill={color + '20'} />
      {/* twin barrels */}
      <rect x="15" y="5" width="4" height="20" rx="1.2" strokeWidth={sw * 1.2} fill={color + '28'} />
      <rect x="21" y="5" width="4" height="20" rx="1.2" strokeWidth={sw * 1.2} fill={color + '28'} />
      {/* muzzle caps */}
      <rect x="14" y="5" width="6" height="2.5" rx="0.6" strokeWidth={sw * 0.9} fill={color + '30'} />
      <rect x="20" y="5" width="6" height="2.5" rx="0.6" strokeWidth={sw * 0.9} fill={color + '30'} />
      {/* pivot */}
      <circle cx="20" cy="23" r="2" strokeWidth={sw * 0.8} fill={color + '40'} />
      <circle cx="20" cy="23" r="6" strokeWidth={sw * 0.5} strokeDasharray="2.5 2" opacity="0.4" />
    </g>
  ),

  /* ── 魚雷 ── 双発発射管（上面視） ───────────────────────────────────── */
  torpedo: ({ color, sw }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* left tube */}
      <rect x="7" y="5" width="10" height="30" rx="4" strokeWidth={sw * 1.2} fill={color + '20'} />
      {/* right tube */}
      <rect x="23" y="5" width="10" height="30" rx="4" strokeWidth={sw * 1.2} fill={color + '20'} />
      {/* warhead caps */}
      <ellipse cx="12" cy="7" rx="4" ry="2.5" strokeWidth={sw} fill={color + '35'} />
      <ellipse cx="28" cy="7" rx="4" ry="2.5" strokeWidth={sw} fill={color + '35'} />
      {/* connecting yoke */}
      <rect x="10" y="17" width="20" height="4" rx="1.5" strokeWidth={sw * 0.9} fill={color + '18'} />
      {/* detail lines on tubes */}
      <line x1="7" y1="14" x2="17" y2="14" strokeWidth={sw * 0.6} strokeDasharray="2 2" opacity="0.5" />
      <line x1="23" y1="14" x2="33" y2="14" strokeWidth={sw * 0.6} strokeDasharray="2 2" opacity="0.5" />
      {/* tail fins */}
      <polyline points="7,33 4,37 10,35" strokeWidth={sw * 0.8} />
      <polyline points="17,33 20,37 14,35" strokeWidth={sw * 0.8} />
      <polyline points="23,33 20,37 26,35" strokeWidth={sw * 0.8} />
      <polyline points="33,33 36,37 30,35" strokeWidth={sw * 0.8} />
    </g>
  ),

  /* ── 対空砲 ── 旋回台座 + 放射バレル ────────────────────────────────── */
  aa: ({ color, sw }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* base ring */}
      <circle cx="20" cy="20" r="11" strokeWidth={sw * 1.1} fill={color + '18'} />
      <circle cx="20" cy="20" r="7" strokeWidth={sw * 0.8} fill={color + '10'} strokeDasharray="3 2" opacity="0.5" />
      {/* four barrels at 45° angles */}
      {[45, 135, 225, 315].map(deg => {
        const r = deg * Math.PI / 180
        const x1 = 20 + Math.cos(r) * 7
        const y1 = 20 + Math.sin(r) * 7
        const x2 = 20 + Math.cos(r) * 16
        const y2 = 20 + Math.sin(r) * 16
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={sw * 1.6} strokeLinecap="round" />
      })}
      {/* center pivot */}
      <circle cx="20" cy="20" r="3" strokeWidth={sw * 0.9} fill={color + '50'} />
    </g>
  ),

  /* ── ミサイル ── 3×1 セル ランチャー（上面視） ──────────────────────── */
  missile: ({ color, sw }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* outer launcher box */}
      <rect x="5" y="6" width="30" height="28" rx="3" strokeWidth={sw * 1.2} fill={color + '15'} />
      {/* three missile cells */}
      {[10, 20, 30].map(cx => (
        <g key={cx}>
          {/* missile body (top-down = thin oval) */}
          <ellipse cx={cx} cy="20" rx="3.5" ry="10" strokeWidth={sw * 1.1} fill={color + '28'} />
          {/* nose tip */}
          <ellipse cx={cx} cy="10.5" rx="2" ry="1.5" strokeWidth={sw * 0.9} fill={color + '45'} />
          {/* fin cross */}
          <line x1={cx - 3.5} y1="28" x2={cx - 5.5} y2="32" strokeWidth={sw * 0.8} />
          <line x1={cx + 3.5} y1="28" x2={cx + 5.5} y2="32" strokeWidth={sw * 0.8} />
        </g>
      ))}
      {/* cell dividers */}
      <line x1="15" y1="7" x2="15" y2="33" strokeWidth={sw * 0.7} opacity="0.5" />
      <line x1="25" y1="7" x2="25" y2="33" strokeWidth={sw * 0.7} opacity="0.5" />
    </g>
  ),
}
