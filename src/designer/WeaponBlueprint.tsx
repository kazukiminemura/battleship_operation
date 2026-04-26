import type { WeaponSlotType } from './types'

interface Props {
  type: WeaponSlotType
  color: string
  size: number
}

export function WeaponBlueprint({ type, color, size }: Props) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {BLUEPRINTS[type](color)}
    </svg>
  )
}

const BLUEPRINTS: Record<WeaponSlotType, (c: string) => React.ReactNode> = {

  /* ── 主砲: 三連装砲塔（46cm三連装）────────────────────────────────────── */
  gun: (c) => (
    <g stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Barbette ring */}
      <circle cx="20" cy="27" r="12.5" strokeWidth="1.5" fill={c + '14'} />
      {/* Turret roof (octagonal) */}
      <path d="M9,24 L10,17 L15,11 L25,11 L30,17 L31,24 L26,28 L14,28 Z"
        strokeWidth="1.3" fill={c + '22'} />
      {/* Front slope face */}
      <path d="M12,16 L14,11 L26,11 L28,16 Z" strokeWidth="0.9" fill={c + '30'} />
      {/* Left barrel */}
      <rect x="11.5" y="2" width="4.5" height="21" rx="1.8" strokeWidth="1.3" fill={c + '28'} />
      {/* Center barrel (slightly longer) */}
      <rect x="17.75" y="0" width="4.5" height="23" rx="1.8" strokeWidth="1.3" fill={c + '28'} />
      {/* Right barrel */}
      <rect x="24" y="2" width="4.5" height="21" rx="1.8" strokeWidth="1.3" fill={c + '28'} />
      {/* Muzzle brakes */}
      <rect x="10.5" y="1.5" width="6.5" height="2.8" rx="0.7" strokeWidth="1" fill={c + '45'} />
      <rect x="16.75" y="-0.5" width="6.5" height="2.8" rx="0.7" strokeWidth="1" fill={c + '45'} />
      <rect x="23" y="1.5" width="6.5" height="2.8" rx="0.7" strokeWidth="1" fill={c + '45'} />
      {/* Rangefinder arms */}
      <rect x="5.5" y="19.5" width="7" height="3.5" rx="1.2" strokeWidth="1" fill={c + '20'} />
      <rect x="27.5" y="19.5" width="7" height="3.5" rx="1.2" strokeWidth="1" fill={c + '20'} />
      {/* Rangefinder end caps */}
      <rect x="4.5" y="19.5" width="2" height="3.5" rx="0.5" strokeWidth="0.8" fill={c + '30'} />
      <rect x="33.5" y="19.5" width="2" height="3.5" rx="0.5" strokeWidth="0.8" fill={c + '30'} />
      {/* Pivot / gun housing center */}
      <circle cx="20" cy="24" r="3.5" strokeWidth="1" fill={c + '35'} />
      <circle cx="20" cy="24" r="1.5" strokeWidth="0.8" fill={c + '55'} />
      {/* Detail dash ring */}
      <circle cx="20" cy="27" r="8.5" strokeWidth="0.6" strokeDasharray="3 2.5" opacity="0.4" />
    </g>
  ),

  /* ── 副砲: 連装砲塔（12.7cm連装）───────────────────────────────────────── */
  secondary: (c) => (
    <g stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Barbette */}
      <circle cx="20" cy="28" r="10" strokeWidth="1.4" fill={c + '14'} />
      {/* Turret roof */}
      <path d="M11,25 L12,19 L17,13 L23,13 L28,19 L29,25 L24,29 L16,29 Z"
        strokeWidth="1.2" fill={c + '22'} />
      {/* Front slope */}
      <path d="M14,18 L17,13 L23,13 L26,18 Z" strokeWidth="0.9" fill={c + '30'} />
      {/* Left barrel */}
      <rect x="13" y="3" width="4" height="20" rx="1.5" strokeWidth="1.2" fill={c + '28'} />
      {/* Right barrel */}
      <rect x="23" y="3" width="4" height="20" rx="1.5" strokeWidth="1.2" fill={c + '28'} />
      {/* Muzzle brakes */}
      <rect x="12" y="2.5" width="6" height="2.5" rx="0.6" strokeWidth="0.9" fill={c + '45'} />
      <rect x="22" y="2.5" width="6" height="2.5" rx="0.6" strokeWidth="0.9" fill={c + '45'} />
      {/* Pivot */}
      <circle cx="20" cy="25" r="3" strokeWidth="0.9" fill={c + '35'} />
      <circle cx="20" cy="25" r="1.3" strokeWidth="0.8" fill={c + '55'} />
      {/* Detail dash ring */}
      <circle cx="20" cy="28" r="6.5" strokeWidth="0.6" strokeDasharray="3 2" opacity="0.38" />
    </g>
  ),

  /* ── 魚雷: 五連装魚雷発射管（九三式）────────────────────────────────────── */
  torpedo: (c) => (
    <g stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Mounting frame base */}
      <rect x="2" y="15" width="36" height="11" rx="2.5" strokeWidth="1.1" fill={c + '14'} />
      {/* 5 torpedo tubes (pointing up = bow) */}
      {[3, 9.5, 16, 22.5, 29].map((x, i) => (
        <g key={i}>
          {/* Tube cylinder */}
          <rect x={x} y="2" width="6" height="28" rx="3" strokeWidth="1.2" fill={c + '20'} />
          {/* Nose cap */}
          <ellipse cx={x + 3} cy="3.5" rx="2.8" ry="2" strokeWidth="1" fill={c + '40'} />
          {/* Torpedo outline inside tube */}
          <ellipse cx={x + 3} cy="16" rx="2" ry="9" strokeWidth="0.7" fill={c + '12'} strokeDasharray="2 1.5" opacity="0.6" />
        </g>
      ))}
      {/* Cross bracing */}
      <line x1="2" y1="20.5" x2="38" y2="20.5" strokeWidth="0.8" opacity="0.5" />
      {/* Mounting pivot circle */}
      <circle cx="20" cy="20.5" r="4" strokeWidth="0.9" fill={c + '20'} />
      <circle cx="20" cy="20.5" r="1.5" strokeWidth="0.7" fill={c + '45'} />
    </g>
  ),

  /* ── 対空砲: 三連装25mm機銃───────────────────────────────────────────── */
  aa: (c) => (
    <g stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Shield (D-shaped gun shield from above) */}
      <path d="M8,32 L8,20 C8,10 12,7 20,6 C28,7 32,10 32,20 L32,32 Z"
        strokeWidth="1.2" fill={c + '16'} />
      {/* Inner shield edge */}
      <path d="M11,30 L11,20 C11,13 14,10 20,9 C26,10 29,13 29,20 L29,30 Z"
        strokeWidth="0.8" fill={c + '10'} opacity="0.7" />
      {/* Left barrel */}
      <rect x="11.5" y="2" width="3.5" height="22" rx="1.5" strokeWidth="1.1" fill={c + '28'} />
      {/* Center barrel (longer) */}
      <rect x="18.25" y="0" width="3.5" height="24" rx="1.5" strokeWidth="1.1" fill={c + '28'} />
      {/* Right barrel */}
      <rect x="25" y="2" width="3.5" height="22" rx="1.5" strokeWidth="1.1" fill={c + '28'} />
      {/* Muzzle flash guards */}
      <rect x="10.5" y="1.5" width="5.5" height="2" rx="0.5" strokeWidth="0.9" fill={c + '45'} />
      <rect x="17.25" y="-0.5" width="5.5" height="2" rx="0.5" strokeWidth="0.9" fill={c + '45'} />
      <rect x="24" y="1.5" width="5.5" height="2" rx="0.5" strokeWidth="0.9" fill={c + '45'} />
      {/* Rotating platform */}
      <ellipse cx="20" cy="30" rx="9" ry="4.5" strokeWidth="1" fill={c + '18'} />
      {/* Pivot pin */}
      <circle cx="20" cy="30" r="2.5" strokeWidth="0.9" fill={c + '40'} />
      <circle cx="20" cy="30" r="1" strokeWidth="0.7" fill={c + '60'} />
    </g>
  ),

  /* ── ミサイル: 4連装箱型ランチャー（ハープーン式）──────────────────────── */
  missile: (c) => (
    <g stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Launcher outer box */}
      <rect x="4" y="4" width="32" height="32" rx="3" strokeWidth="1.3" fill={c + '10'} />
      {/* 4 missile canisters: 2×2 grid */}
      {([[5, 5], [21, 5], [5, 21], [21, 21]] as [number, number][]).map(([x, y], i) => (
        <g key={i}>
          {/* Canister box */}
          <rect x={x} y={y} width="14" height="14" rx="2" strokeWidth="1.1" fill={c + '1a'} />
          {/* Missile cross-section (circle) */}
          <circle cx={x + 7} cy={y + 7} r="4.5" strokeWidth="1" fill={c + '22'} />
          {/* Missile inner detail */}
          <circle cx={x + 7} cy={y + 7} r="2.2" strokeWidth="0.7" fill={c + '38'} />
          {/* Nose indicator */}
          <line x1={x + 7} y1={y + 1} x2={x + 7} y2={y + 4} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ))}
      {/* Center cross divider */}
      <line x1="4" y1="20" x2="36" y2="20" strokeWidth="0.8" opacity="0.55" />
      <line x1="20" y1="4" x2="20" y2="36" strokeWidth="0.8" opacity="0.55" />
      {/* Aiming sight (center cross) */}
      <circle cx="20" cy="20" r="3" strokeWidth="0.8" fill="none" opacity="0.5" />
    </g>
  ),
}
