import type { PlayerShipType } from '../game/data/masterdata'

const G    = '#50c878'
const GB   = '#7eeaa0'
const FILL  = 'rgba(8,26,13,0.92)'
const FILLD = 'rgba(4,14,8,0.97)'

interface Props { shipType: PlayerShipType; scale?: number }

export function HullSideView({ shipType, scale = 1 }: Props) {
  const w      = Math.round(480 * scale)
  const h      = Math.round(210 * scale)
  const gridPx = Math.round(20 * scale)

  return (
    <div
      className="sd-hull-side-wrapper"
      style={{
        width: w, height: h,
        backgroundImage: [
          `linear-gradient(rgba(80,200,120,0.07) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(80,200,120,0.07) 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: `${gridPx}px ${gridPx}px`,
      }}
    >
      <svg className="sd-hull-svg" viewBox="0 0 600 210"
        preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <filter id="side-bp-glow">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="side-dim-glow">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* waterline & labels */}
        <line x1="20" y1="153" x2="582" y2="153"
          stroke={G} strokeWidth="0.5" opacity="0.2" strokeDasharray="14 6" />
        <text x="22" y="149" fontSize="7" fill={G} opacity="0.3" fontFamily="monospace">W.L.</text>
        <text x="22"  y="207" fontSize="7" fill={G} opacity="0.25" fontFamily="monospace">BOW</text>
        <text x="580" y="207" fontSize="7" fill={G} opacity="0.25" fontFamily="monospace" textAnchor="end">STERN</text>

        {shipType === 'destroyer'  && <DestroyerSide />}
        {shipType === 'cruiser'    && <CruiserSide />}
        {shipType === 'battleship' && <BattleshipSide />}
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────── Destroyer ── */
function DestroyerSide() {
  return (
    <g filter="url(#side-bp-glow)">
      {/* Hull — sharp clipper bow, transom stern */}
      <path
        d="M 48,100 C 42,100 33,115 30,133 C 28,147 33,153 40,155
           L 42,180 L 558,180 L 564,170 L 564,108
           L 468,108 L 452,100 Z"
        fill={FILL} stroke={G} strokeWidth="2.2"
      />
      {/* Forecastle deck sheer */}
      <path d="M 48,100 C 60,98 120,96 180,96 L 452,100"
        fill="none" stroke={G} strokeWidth="0.9" opacity="0.6" />
      {/* Hull side detail — waterplane */}
      <path d="M 40,155 L 558,155"
        fill="none" stroke={G} strokeWidth="0.4" opacity="0.18" />
      {/* Sonar bulge bow */}
      <ellipse cx="44" cy="180" rx="15" ry="4.5"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.65" />
      {/* Frame tick marks */}
      {[100,160,220,280,340,400,460,510].map(x => (
        <line key={x} x1={x} y1="153" x2={x} y2="162"
          stroke={G} strokeWidth="0.4" opacity="0.14" />
      ))}
      {/* Hawsepipe */}
      <ellipse cx="42" cy="153" rx="5" ry="3"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.55" />

      {/* A gun — twin 12.7cm */}
      <rect x="68" y="88" width="50" height="14" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <path d="M 68,88 L 80,83 L 116,83 L 118,102 L 68,102 Z"
        fill="none" stroke={G} strokeWidth="0.7" opacity="0.35" />
      <line x1="68" y1="92" x2="28" y2="83"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="68" y1="97" x2="28" y2="88"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />

      {/* Bridge structure */}
      <rect x="185" y="80" width="82" height="22" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <rect x="192" y="64" width="67" height="18" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="200" y="51" width="50" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />
      {/* Bridge windows */}
      {[196,207,218,229,240,251].map(x => (
        <rect key={x} x={x} y="66" width="7" height="8" rx="1"
          fill="rgba(126,234,160,0.14)" stroke={G} strokeWidth="0.6" />
      ))}
      {/* Bridge wings */}
      <rect x="178" y="80" width="8" height="10" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />
      <rect x="267" y="80" width="8" height="10" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />

      {/* Main mast */}
      <line x1="225" y1="51" x2="225" y2="18" stroke={GB} strokeWidth="1.5" />
      <line x1="205" y1="30" x2="245" y2="30" stroke={GB} strokeWidth="1"   opacity="0.7" />
      <line x1="213" y1="24" x2="237" y2="24" stroke={GB} strokeWidth="0.8" opacity="0.5" />
      <rect x="215" y="14" width="20" height="8" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.8" />

      {/* Forward funnel */}
      <path d="M 300,100 L 298,62 L 323,62 L 322,100 Z"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="311" cy="61" rx="13" ry="4.5"
        fill={FILLD} stroke={GB} strokeWidth="1" />
      <line x1="299" y1="76" x2="322" y2="76"
        stroke={GB} strokeWidth="1.2" opacity="0.35" />

      {/* Aft funnel */}
      <path d="M 342,100 L 341,68 L 362,68 L 362,100 Z"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <ellipse cx="352" cy="67" rx="11" ry="4"
        fill={FILLD} stroke={GB} strokeWidth="0.9" />

      {/* Aft mast */}
      <line x1="382" y1="96" x2="382" y2="66" stroke={GB} strokeWidth="1.1" opacity="0.6" />
      <line x1="370" y1="73" x2="394" y2="73" stroke={GB} strokeWidth="0.8" opacity="0.5" />

      {/* Torpedo tubes (quad bank) */}
      <rect x="390" y="94" width="62" height="10" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.1" opacity="0.9" />
      {[396,405,414,423,432,441].map(x => (
        <line key={x} x1={x} y1="94" x2={x} y2="104"
          stroke={G} strokeWidth="0.5" opacity="0.4" />
      ))}
      <text x="421" y="91" fontSize="5.5" fill={G} opacity="0.45"
        textAnchor="middle" fontFamily="monospace">T.T.</text>

      {/* Aft deckhouse */}
      <rect x="430" y="90" width="48" height="18" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />

      {/* Y gun */}
      <rect x="472" y="96" width="46" height="14" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <line x1="516" y1="100" x2="545" y2="92"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="516" y1="105" x2="545" y2="97"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />

      {/* Stern details */}
      <line x1="548" y1="174" x2="570" y2="174" stroke={G} strokeWidth="1.2" opacity="0.45" />
      <line x1="548" y1="166" x2="570" y2="166" stroke={G} strokeWidth="1.2" opacity="0.45" />
      <rect x="560" y="164" width="5" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.55" />
    </g>
  )
}

/* ──────────────────────────────────────────────────────────────── Cruiser ── */
function CruiserSide() {
  return (
    <g filter="url(#side-bp-glow)">
      {/* Hull — heavier, more flare at bow */}
      <path
        d="M 44,96 C 37,96 27,113 25,132 C 23,148 30,153 38,155
           L 40,182 L 558,182 L 565,172 L 565,106
           L 480,106 L 462,96 Z"
        fill={FILL} stroke={G} strokeWidth="2.3"
      />
      <path d="M 44,96 C 56,94 120,92 200,91 L 462,96"
        fill="none" stroke={G} strokeWidth="1" opacity="0.55" />
      <line x1="38" y1="155" x2="558" y2="155"
        fill="none" stroke={G} strokeWidth="0.4" opacity="0.16" />
      <ellipse cx="43" cy="182" rx="18" ry="5.5"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.6" />
      {[100,160,220,280,340,400,460,520].map(x => (
        <line key={x} x1={x} y1="153" x2={x} y2="163"
          stroke={G} strokeWidth="0.4" opacity="0.13" />
      ))}

      {/* A turret (triple) */}
      <rect x="62" y="82" width="52" height="16" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <path d="M 62,82 L 76,76 L 112,76 L 114,98 L 62,98 Z"
        fill="none" stroke={G} strokeWidth="0.8" opacity="0.3" />
      <line x1="62" y1="86" x2="22" y2="76"  stroke={GB} strokeWidth="3.4" strokeLinecap="round" />
      <line x1="62" y1="91" x2="22" y2="81"  stroke={GB} strokeWidth="3.4" strokeLinecap="round" />
      <line x1="62" y1="96" x2="22" y2="86"  stroke={GB} strokeWidth="3.4" strokeLinecap="round" />

      {/* B turret (superfiring) */}
      <rect x="122" y="70" width="52" height="16" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <line x1="122" y1="74" x2="80"  y2="64"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="122" y1="79" x2="80"  y2="69"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="122" y1="84" x2="80"  y2="74"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />

      {/* Bridge tower */}
      <rect x="205" y="72" width="90" height="24" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <rect x="213" y="55" width="74" height="19" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="222" y="40" width="55" height="17" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="232" y="27" width="35" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />
      {/* Bridge windows */}
      {[218,230,242,254,266,278].map(x => (
        <rect key={x} x={x} y="57" width="7" height="9" rx="1"
          fill="rgba(126,234,160,0.14)" stroke={G} strokeWidth="0.6" />
      ))}
      {/* Bridge wings */}
      <rect x="196" y="72" width="10" height="12" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />
      <rect x="294" y="72" width="10" height="12" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />

      {/* Main mast */}
      <line x1="249" y1="27" x2="249" y2="-2" stroke={GB} strokeWidth="1.5" />
      <line x1="228" y1="10" x2="270" y2="10" stroke={GB} strokeWidth="1"   opacity="0.7" />
      <line x1="235" y1="4"  x2="263" y2="4"  stroke={GB} strokeWidth="0.8" opacity="0.5" />
      <rect x="239" y="-3" width="20" height="8" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.8" />

      {/* Forward funnel */}
      <path d="M 324,96 L 322,52 L 350,52 L 350,96 Z"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <ellipse cx="337" cy="51" rx="15" ry="5"
        fill={FILLD} stroke={GB} strokeWidth="1.1" />
      <line x1="323" y1="68" x2="350" y2="68"
        stroke={GB} strokeWidth="1.2" opacity="0.35" />

      {/* Aft funnel */}
      <path d="M 372,96 L 371,60 L 396,60 L 396,96 Z"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="384" cy="59" rx="13" ry="4.5"
        fill={FILLD} stroke={GB} strokeWidth="1" />

      {/* Aft mast */}
      <line x1="425" y1="92" x2="425" y2="60" stroke={GB} strokeWidth="1.1" opacity="0.6" />
      <line x1="413" y1="67" x2="437" y2="67" stroke={GB} strokeWidth="0.8" opacity="0.5" />
      <rect x="415" y="56" width="20" height="7" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.7" opacity="0.7" />

      {/* Rear superstructure */}
      <rect x="432" y="82" width="52" height="20" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="438" y="68" width="38" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.8" />

      {/* X turret */}
      <rect x="464" y="84" width="52" height="16" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <line x1="514" y1="88" x2="550" y2="78"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="514" y1="93" x2="550" y2="83"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="514" y1="98" x2="550" y2="88"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />

      {/* Propeller shafts */}
      <line x1="546" y1="177" x2="570" y2="177" stroke={G} strokeWidth="1.2" opacity="0.45" />
      <line x1="546" y1="169" x2="570" y2="169" stroke={G} strokeWidth="1.2" opacity="0.45" />
      <rect x="562" y="167" width="5" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.55" />
    </g>
  )
}

/* ─────────────────────────────────────────────────────────────── Battleship ── */
function BattleshipSide() {
  return (
    <g filter="url(#side-bp-glow)">
      {/* Hull — massive, heavy freeboard, anti-torpedo bulge */}
      <path
        d="M 42,90 C 34,90 24,108 22,130 C 20,148 28,153 36,155
           L 38,183 L 555,183 L 562,174 L 562,104
           L 488,104 L 468,90 Z"
        fill={FILL} stroke={G} strokeWidth="2.5"
      />
      <path d="M 42,90 C 56,88 130,86 220,85 L 468,90"
        fill="none" stroke={G} strokeWidth="1" opacity="0.55" />
      {/* Anti-torpedo bulge */}
      <path d="M 100,155 C 120,164 200,169 340,169 C 460,169 530,164 555,158"
        fill="none" stroke={G} strokeWidth="1.4" opacity="0.4" />
      <path d="M 100,155 C 120,162 200,167 340,167 C 460,167 530,162 555,158"
        fill="none" stroke={G} strokeWidth="0.5" opacity="0.15" />
      {/* Armor belt */}
      <line x1="38" y1="140" x2="555" y2="140"
        stroke={G} strokeWidth="0.4" opacity="0.15" />
      {/* Armor belt plates */}
      {[80,130,180,230,280,330,380,430,480,530].map(x => (
        <line key={x} x1={x} y1="140" x2={x} y2="155"
          stroke={G} strokeWidth="0.5" opacity="0.18" />
      ))}
      <ellipse cx="42" cy="183" rx="20" ry="6"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.6" />
      {[100,160,220,280,340,400,460,520].map(x => (
        <line key={x} x1={x} y1="153" x2={x} y2="165"
          stroke={G} strokeWidth="0.4" opacity="0.12" />
      ))}

      {/* Turret 1 (forward low, triple 46cm) */}
      <rect x="58" y="74" width="60" height="20" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.6" />
      <path d="M 58,74 L 75,66 L 116,66 L 118,94 L 58,94 Z"
        fill="none" stroke={G} strokeWidth="0.8" opacity="0.28" />
      <line x1="58"  y1="79" x2="10"  y2="68"  stroke={GB} strokeWidth="4.2" strokeLinecap="round" />
      <line x1="58"  y1="84" x2="10"  y2="73"  stroke={GB} strokeWidth="4.2" strokeLinecap="round" />
      <line x1="58"  y1="89" x2="10"  y2="78"  stroke={GB} strokeWidth="4.2" strokeLinecap="round" />

      {/* Turret 2 (forward high, superfiring) */}
      <rect x="126" y="58" width="60" height="20" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <line x1="126" y1="63"  x2="72"  y2="52"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="126" y1="68"  x2="72"  y2="57"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="126" y1="73"  x2="72"  y2="62"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />

      {/* Pagoda command tower */}
      <rect x="234" y="60" width="100" height="30" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <rect x="246" y="44" width="76" height="18" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <rect x="257" y="29" width="54" height="17" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="267" y="15" width="34" height="16" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="275" y="3"  width="18" height="14" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />
      {/* Tower windows */}
      {[252,267,282,298,313].map(x => (
        <rect key={x} x={x} y="46" width="9" height="10" rx="1"
          fill="rgba(126,234,160,0.13)" stroke={G} strokeWidth="0.7" />
      ))}
      {/* Bridge wings */}
      <rect x="224" y="60" width="11" height="14" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.7" />
      <rect x="333" y="60" width="11" height="14" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.7" />

      {/* Mast atop tower */}
      <line x1="284" y1="3"  x2="284" y2="-10" stroke={GB} strokeWidth="1.5" />
      <line x1="272" y1="0"  x2="296" y2="0"   stroke={GB} strokeWidth="1"   opacity="0.6" />
      <rect x="276" y="-11" width="16" height="6" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.8" />

      {/* Secondary 15.5cm battery (midship) */}
      <rect x="184" y="84" width="40" height="12" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.8" />
      <line x1="184" y1="88" x2="162" y2="82"  stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="184" y1="92" x2="162" y2="86"  stroke={GB} strokeWidth="2.2" strokeLinecap="round" />

      {/* Forward funnel */}
      <path d="M 360,90 L 358,46 L 388,46 L 388,90 Z"
        fill={FILLD} stroke={G} strokeWidth="1.6" />
      <ellipse cx="374" cy="45" rx="16" ry="5.5"
        fill={FILLD} stroke={GB} strokeWidth="1.2" />
      <line x1="359" y1="62" x2="388" y2="62"
        stroke={GB} strokeWidth="1.2" opacity="0.3" />

      {/* Aft funnel */}
      <path d="M 408,90 L 407,54 L 434,54 L 434,90 Z"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <ellipse cx="421" cy="53" rx="14" ry="5"
        fill={FILLD} stroke={GB} strokeWidth="1.1" />

      {/* Aft superstructure */}
      <rect x="448" y="70" width="55" height="22" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="456" y="56" width="38" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" opacity="0.85" />

      {/* Turret 3 (aft) */}
      <rect x="456" y="72" width="60" height="20" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <line x1="516" y1="77"  x2="562" y2="66"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="516" y1="82"  x2="562" y2="71"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="516" y1="87"  x2="562" y2="76"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />

      {/* Propeller shafts (4 shafts) */}
      <line x1="538" y1="179" x2="565" y2="179" stroke={G} strokeWidth="1.4" opacity="0.45" />
      <line x1="538" y1="172" x2="565" y2="172" stroke={G} strokeWidth="1.4" opacity="0.45" />
      <line x1="538" y1="165" x2="565" y2="165" stroke={G} strokeWidth="1"   opacity="0.35" />
      <line x1="538" y1="158" x2="565" y2="158" stroke={G} strokeWidth="1"   opacity="0.35" />
      {/* Rudder */}
      <path d="M 558,168 L 564,168 L 564,186 L 558,186 Z"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.6" />
    </g>
  )
}
