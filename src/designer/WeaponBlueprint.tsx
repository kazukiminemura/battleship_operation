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
      width={size * 0.72}
      height={size * 0.72}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      {BLUEPRINTS[type]({ color })}
    </svg>
  )
}

type DrawProps = { color: string }

const BLUEPRINTS: Record<WeaponSlotType, (p: DrawProps) => React.ReactNode> = {
  gun: ({ color }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* barrel */}
      <rect x="17" y="3" width="6" height="20" rx="2" strokeWidth="1.4" fill={color + '18'} />
      {/* turret base */}
      <rect x="9" y="21" width="22" height="13" rx="3" strokeWidth="1.4" fill={color + '18'} />
      {/* rangefinder bumps */}
      <rect x="8" y="24" width="4" height="4" rx="1" strokeWidth="1" />
      <rect x="28" y="24" width="4" height="4" rx="1" strokeWidth="1" />
      {/* detail cross-line */}
      <line x1="9" y1="28" x2="31" y2="28" strokeWidth="0.7" strokeDasharray="3 2" opacity="0.6" />
      {/* muzzle */}
      <line x1="17" y1="3" x2="23" y2="3" strokeWidth="2" strokeLinecap="butt" />
    </g>
  ),

  secondary: ({ color }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* twin barrels */}
      <rect x="13" y="4" width="5" height="17" rx="1.5" strokeWidth="1.3" fill={color + '18'} />
      <rect x="22" y="4" width="5" height="17" rx="1.5" strokeWidth="1.3" fill={color + '18'} />
      {/* turret base */}
      <rect x="10" y="19" width="20" height="12" rx="3" strokeWidth="1.3" fill={color + '18'} />
      {/* detail */}
      <line x1="10" y1="25" x2="30" y2="25" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.6" />
      {/* muzzle caps */}
      <line x1="13" y1="4" x2="18" y2="4" strokeWidth="1.8" strokeLinecap="butt" />
      <line x1="22" y1="4" x2="27" y2="4" strokeWidth="1.8" strokeLinecap="butt" />
    </g>
  ),

  torpedo: ({ color }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* left tube */}
      <rect x="7" y="8" width="10" height="26" rx="4" strokeWidth="1.3" fill={color + '18'} />
      {/* right tube */}
      <rect x="23" y="8" width="10" height="26" rx="4" strokeWidth="1.3" fill={color + '18'} />
      {/* nose caps */}
      <ellipse cx="12" cy="9" rx="4.5" ry="2.5" strokeWidth="1.1" fill={color + '30'} />
      <ellipse cx="28" cy="9" rx="4.5" ry="2.5" strokeWidth="1.1" fill={color + '30'} />
      {/* fins */}
      <polyline points="7,30 4,34 7,33" strokeWidth="1" />
      <polyline points="17,30 20,34 17,33" strokeWidth="1" />
      <polyline points="23,30 20,34 23,33" strokeWidth="1" />
      <polyline points="33,30 36,34 33,33" strokeWidth="1" />
      {/* warhead detail */}
      <line x1="7" y1="14" x2="17" y2="14" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.55" />
      <line x1="23" y1="14" x2="33" y2="14" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.55" />
    </g>
  ),

  aa: ({ color }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* left barrel */}
      <line x1="13" y1="5" x2="10" y2="22" strokeWidth="2.2" strokeLinecap="round" />
      {/* right barrel */}
      <line x1="27" y1="5" x2="30" y2="22" strokeWidth="2.2" strokeLinecap="round" />
      {/* muzzle brakes */}
      <line x1="11" y1="6" x2="15" y2="6" strokeWidth="1.2" />
      <line x1="25" y1="6" x2="29" y2="6" strokeWidth="1.2" />
      {/* pivot yoke */}
      <path d="M10,22 Q20,18 30,22" strokeWidth="1.3" fill={color + '18'} />
      {/* base ring */}
      <ellipse cx="20" cy="30" rx="10" ry="5" strokeWidth="1.3" fill={color + '18'} />
      {/* base post */}
      <line x1="20" y1="22" x2="20" y2="26" strokeWidth="1.5" />
      {/* detail tick on base */}
      <line x1="12" y1="30" x2="28" y2="30" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.55" />
    </g>
  ),

  missile: ({ color }) => (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* launcher box */}
      <rect x="6" y="22" width="28" height="14" rx="3" strokeWidth="1.3" fill={color + '18'} />
      {/* three missiles */}
      {[10, 20, 30].map(cx => (
        <g key={cx}>
          <rect x={cx - 3} y="8" width="6" height="16" rx="2" strokeWidth="1.2" fill={color + '22'} />
          {/* nose cone */}
          <polygon
            points={`${cx - 3},8 ${cx},3 ${cx + 3},8`}
            strokeWidth="1"
            fill={color + '35'}
          />
          {/* fin */}
          <line x1={cx - 3} y1="22" x2={cx - 5} y2="26" strokeWidth="1" />
          <line x1={cx + 3} y1="22" x2={cx + 5} y2="26" strokeWidth="1" />
        </g>
      ))}
      {/* cell dividers */}
      <line x1="17" y1="22" x2="17" y2="36" strokeWidth="0.8" opacity="0.5" />
      <line x1="23" y1="22" x2="23" y2="36" strokeWidth="0.8" opacity="0.5" />
    </g>
  ),
}
