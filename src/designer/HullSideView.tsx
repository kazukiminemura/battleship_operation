import type { PlayerShipType } from '../game/data/masterdata'

const G    = '#50c878'
const GB   = '#7eeaa0'
const FILL = 'rgba(10,30,16,0.85)'
const FILLD = 'rgba(6,18,10,0.95)'

interface Props {
  shipType: PlayerShipType
  scale?: number
}

export function HullSideView({ shipType, scale = 1 }: Props) {
  const w       = Math.round(480 * scale)
  const h       = Math.round(210 * scale)
  const gridPx  = Math.round(20 * scale)

  return (
    <div
      className="sd-hull-side-wrapper"
      style={{
        width: w,
        height: h,
        backgroundImage: [
          `linear-gradient(rgba(80,200,120,0.07) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(80,200,120,0.07) 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: `${gridPx}px ${gridPx}px`,
      }}
    >
      <svg
        className="sd-hull-svg"
        viewBox="0 0 600 210"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <filter id="side-bp-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* waterline */}
        <line x1="20" y1="155" x2="580" y2="155"
          stroke={G} strokeWidth="0.6" opacity="0.25" strokeDasharray="10 5" />
        <text x="22" y="150" fontSize="8" fill={G} opacity="0.35" fontFamily="monospace">W.L.</text>
        <text x="22"  y="206" fontSize="8" fill={G} opacity="0.3" fontFamily="monospace">BOW</text>
        <text x="578" y="206" fontSize="8" fill={G} opacity="0.3" fontFamily="monospace" textAnchor="end">STERN</text>

        {shipType === 'destroyer'  && <DestroyerSide />}
        {shipType === 'cruiser'    && <CruiserSide />}
        {shipType === 'battleship' && <BattleshipSide />}
      </svg>
    </div>
  )
}

/* ── Destroyer ─────────────────────────────────────────────────────────────── */
function DestroyerSide() {
  return (
    <g filter="url(#side-bp-glow)">
      {/* Hull */}
      <path
        d="M55,152 C62,142 72,108 92,102 L532,107 C542,109 550,125 556,152
           L553,175 Q535,184 520,184 L80,184 Q63,184 52,175 Z"
        fill={FILL} stroke={G} strokeWidth="2"
      />
      <line x1="62" y1="152" x2="556" y2="152" stroke={G} strokeWidth="0.5" opacity="0.3" />

      {/* A gun */}
      <rect x="92" y="90" width="32" height="13" rx="2" fill={FILLD} stroke={G} strokeWidth="1.2" />
      <line x1="92" y1="95"  x2="64" y2="88"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="92" y1="100" x2="64" y2="93"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />

      {/* Bridge */}
      <rect x="200" y="82" width="70" height="25" rx="2" fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="210" y="70" width="50" height="14" rx="1" fill={FILLD} stroke={G} strokeWidth="1" />
      {[217, 230, 243].map(x => (
        <rect key={x} x={x} y="72" width="7" height="7" rx="1"
          fill="rgba(126,234,160,0.12)" stroke={G} strokeWidth="0.6" />
      ))}

      {/* Mast */}
      <line x1="235" y1="70" x2="235" y2="38" stroke={GB} strokeWidth="1.5" />
      <line x1="220" y1="48" x2="250" y2="48" stroke={GB} strokeWidth="1" opacity="0.6" />
      <ellipse cx="235" cy="37" rx="8" ry="3" fill="none" stroke={GB} strokeWidth="1" />

      {/* Funnel */}
      <rect x="300" y="65" width="22" height="42" rx="3" fill={FILLD} stroke={G} strokeWidth="1.3" />
      <ellipse cx="311" cy="64" rx="11" ry="3.5" fill={FILLD} stroke={GB} strokeWidth="1" />

      {/* Torpedo tubes */}
      <rect x="345" y="100" width="68" height="10" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.9" />
      {[352, 362, 372, 382, 392, 402].map(x => (
        <line key={x} x1={x} y1="100" x2={x} y2="110"
          stroke={G} strokeWidth="0.5" opacity="0.5" />
      ))}

      {/* Aft deckhouse */}
      <rect x="440" y="90" width="38" height="18" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.8" />

      {/* Y gun */}
      <rect x="475" y="92" width="32" height="13" rx="2" fill={FILLD} stroke={G} strokeWidth="1.2" />
      <line x1="507" y1="96"  x2="533" y2="89"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="507" y1="101" x2="533" y2="94"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />

      {/* Sonar dome */}
      <ellipse cx="60" cy="182" rx="13" ry="5" fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.6" />

      {/* Propeller */}
      <line x1="542" y1="180" x2="558" y2="180" stroke={G} strokeWidth="1.2" opacity="0.5" />
      <line x1="556" y1="175" x2="560" y2="185" stroke={G} strokeWidth="1" opacity="0.5" />
      <line x1="558" y1="173" x2="562" y2="187" stroke={G} strokeWidth="1" opacity="0.5" />
    </g>
  )
}

/* ── Cruiser ───────────────────────────────────────────────────────────────── */
function CruiserSide() {
  return (
    <g filter="url(#side-bp-glow)">
      {/* Hull */}
      <path
        d="M50,152 C57,140 68,100 94,94 L528,98 C540,100 550,118 558,152
           L556,176 Q538,187 522,187 L78,187 Q60,187 48,176 Z"
        fill={FILL} stroke={G} strokeWidth="2"
      />
      <line x1="58" y1="152" x2="556" y2="152" stroke={G} strokeWidth="0.5" opacity="0.3" />
      {[100, 150, 200, 250, 300, 350, 400, 450, 500].map(x => (
        <line key={x} x1={x} y1="152" x2={x} y2="162"
          stroke={G} strokeWidth="0.4" opacity="0.18" />
      ))}

      {/* A turret (triple) */}
      <rect x="95" y="83" width="40" height="16" rx="2" fill={FILLD} stroke={G} strokeWidth="1.4" />
      <line x1="95" y1="88"  x2="62" y2="80"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="95" y1="93"  x2="62" y2="85"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="95" y1="98"  x2="62" y2="90"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />

      {/* B turret (triple, superfiring) */}
      <rect x="148" y="72" width="40" height="16" rx="2" fill={FILLD} stroke={G} strokeWidth="1.3" />
      <line x1="148" y1="77"  x2="114" y2="69"  stroke={GB} strokeWidth="3" strokeLinecap="round" />
      <line x1="148" y1="82"  x2="114" y2="74"  stroke={GB} strokeWidth="3" strokeLinecap="round" />
      <line x1="148" y1="87"  x2="114" y2="79"  stroke={GB} strokeWidth="3" strokeLinecap="round" />

      {/* Bridge tower */}
      <rect x="205" y="62" width="90" height="35" rx="2" fill={FILLD} stroke={G} strokeWidth="1.3" />
      <rect x="215" y="49" width="70" height="15" rx="2" fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="225" y="37" width="50" height="14" rx="2" fill={FILLD} stroke={G} strokeWidth="1" />
      {[222, 238, 254, 270].map(x => (
        <rect key={x} x={x} y="51" width="8" height="8" rx="1"
          fill="rgba(126,234,160,0.12)" stroke={G} strokeWidth="0.6" />
      ))}

      {/* Mast */}
      <line x1="250" y1="37" x2="250" y2="10" stroke={GB} strokeWidth="1.5" />
      <line x1="233" y1="20" x2="267" y2="20" stroke={GB} strokeWidth="1" opacity="0.7" />
      <ellipse cx="250" cy="10" rx="10" ry="4" fill="none" stroke={GB} strokeWidth="1" />

      {/* Forward funnel */}
      <rect x="322" y="52" width="26" height="46" rx="3" fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="335" cy="51" rx="13" ry="4" fill={FILLD} stroke={GB} strokeWidth="1.1" />

      {/* Aft funnel */}
      <rect x="370" y="58" width="24" height="40" rx="3" fill={FILLD} stroke={G} strokeWidth="1.3" />
      <ellipse cx="382" cy="57" rx="12" ry="4" fill={FILLD} stroke={GB} strokeWidth="1" />

      {/* Rear superstructure */}
      <rect x="415" y="78" width="50" height="22" rx="2" fill={FILLD} stroke={G} strokeWidth="1" opacity="0.85" />
      <rect x="425" y="66" width="30" height="14" rx="1" fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.7" />

      {/* X turret (aft, triple) */}
      <rect x="462" y="80" width="40" height="16" rx="2" fill={FILLD} stroke={G} strokeWidth="1.3" />
      <line x1="502" y1="85"  x2="535" y2="77"  stroke={GB} strokeWidth="3" strokeLinecap="round" />
      <line x1="502" y1="90"  x2="535" y2="82"  stroke={GB} strokeWidth="3" strokeLinecap="round" />
      <line x1="502" y1="95"  x2="535" y2="87"  stroke={GB} strokeWidth="3" strokeLinecap="round" />

      {/* Sonar dome */}
      <ellipse cx="57" cy="184" rx="15" ry="5.5" fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.65" />

      {/* Propeller shafts */}
      <line x1="538" y1="183" x2="558" y2="183" stroke={G} strokeWidth="1.2" opacity="0.5" />
      <line x1="538" y1="177" x2="558" y2="177" stroke={G} strokeWidth="1.2" opacity="0.5" />
    </g>
  )
}

/* ── Battleship ────────────────────────────────────────────────────────────── */
function BattleshipSide() {
  return (
    <g filter="url(#side-bp-glow)">
      {/* Hull */}
      <path
        d="M45,152 C52,138 64,92 96,86 L522,89 C536,91 548,113 558,152
           L558,178 Q542,192 525,192 L75,192 Q58,192 45,178 Z"
        fill={FILL} stroke={G} strokeWidth="2.2"
      />
      <line x1="52" y1="152" x2="556" y2="152" stroke={G} strokeWidth="0.6" opacity="0.35" />
      {/* Armor belt plates */}
      <path d="M55,140 L556,140" stroke={G} strokeWidth="0.4" opacity="0.2" />
      {[90, 140, 190, 240, 290, 340, 390, 440, 490, 535].map(x => (
        <line key={x} x1={x} y1="140" x2={x} y2="162"
          stroke={G} strokeWidth="0.5" opacity="0.22" />
      ))}

      {/* Turret 1 (forward low, triple) */}
      <rect x="96" y="74" width="52" height="18" rx="3" fill={FILLD} stroke={G} strokeWidth="1.5" />
      <line x1="96" y1="79"  x2="54" y2="70"  stroke={GB} strokeWidth="4" strokeLinecap="round" />
      <line x1="96" y1="84"  x2="54" y2="75"  stroke={GB} strokeWidth="4" strokeLinecap="round" />
      <line x1="96" y1="89"  x2="54" y2="80"  stroke={GB} strokeWidth="4" strokeLinecap="round" />

      {/* Turret 2 (forward high, triple) */}
      <rect x="158" y="60" width="52" height="18" rx="3" fill={FILLD} stroke={G} strokeWidth="1.5" />
      <line x1="158" y1="65"  x2="112" y2="55"  stroke={GB} strokeWidth="4" strokeLinecap="round" />
      <line x1="158" y1="70"  x2="112" y2="60"  stroke={GB} strokeWidth="4" strokeLinecap="round" />
      <line x1="158" y1="75"  x2="112" y2="65"  stroke={GB} strokeWidth="4" strokeLinecap="round" />

      {/* Pagoda command tower */}
      <rect x="240" y="58" width="95" height="32" rx="2" fill={FILLD} stroke={G} strokeWidth="1.4" />
      <rect x="252" y="43" width="71" height="17" rx="2" fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="263" y="29" width="49" height="16" rx="2" fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="272" y="17" width="31" height="14" rx="2" fill={FILLD} stroke={G} strokeWidth="1" />
      <rect x="280" y="6"  width="15" height="13" rx="2" fill={FILLD} stroke={G} strokeWidth="0.9" />
      {[258, 277, 296, 314].map(x => (
        <rect key={x} x={x} y="45" width="9" height="9" rx="1"
          fill="rgba(126,234,160,0.12)" stroke={G} strokeWidth="0.7" />
      ))}
      {/* Mast atop tower */}
      <line x1="287" y1="6"  x2="287" y2="-4"  stroke={GB} strokeWidth="1.5" />

      {/* Forward funnel */}
      <rect x="362" y="46" width="30" height="44" rx="3" fill={FILLD} stroke={G} strokeWidth="1.5" />
      <ellipse cx="377" cy="45" rx="15" ry="5" fill={FILLD} stroke={GB} strokeWidth="1.2" />

      {/* Aft funnel */}
      <rect x="410" y="52" width="28" height="38" rx="3" fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="424" cy="51" rx="14" ry="5" fill={FILLD} stroke={GB} strokeWidth="1.1" />

      {/* Aft superstructure */}
      <rect x="452" y="68" width="55" height="22" rx="2" fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="460" y="55" width="39" height="15" rx="2" fill={FILLD} stroke={G} strokeWidth="1" />

      {/* Turret 3 (aft, triple) */}
      <rect x="460" y="72" width="52" height="18" rx="3" fill={FILLD} stroke={G} strokeWidth="1.5" />
      <line x1="512" y1="77"  x2="554" y2="68"  stroke={GB} strokeWidth="4" strokeLinecap="round" />
      <line x1="512" y1="82"  x2="554" y2="73"  stroke={GB} strokeWidth="4" strokeLinecap="round" />
      <line x1="512" y1="87"  x2="554" y2="78"  stroke={GB} strokeWidth="4" strokeLinecap="round" />

      {/* Anti-torpedo bulge */}
      <path d="M120,158 Q200,170 380,170 Q460,170 538,161"
        fill="none" stroke={G} strokeWidth="1.2" opacity="0.35" />

      {/* Sonar dome */}
      <ellipse cx="58" cy="190" rx="18" ry="6" fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.65" />

      {/* Propeller shafts */}
      <line x1="536" y1="188" x2="560" y2="188" stroke={G} strokeWidth="1.5" opacity="0.5" />
      <line x1="536" y1="180" x2="560" y2="180" stroke={G} strokeWidth="1.5" opacity="0.5" />
      {/* Rudder */}
      <path d="M558,170 L562,170 L562,196 L558,196 Z"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.6" />
    </g>
  )
}
