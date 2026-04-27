import type { PlayerShipType } from '../game/data/masterdata'

/* ── Blueprint colour palette ─────────────────────────────────────────────── */
const G     = '#50c878'   // main structure
const GB    = '#7eeaa0'   // highlight / barrels
const GD    = '#2a6640'   // dim interior
const GA    = '#a8ffc8'   // bright accent
const FILL  = 'rgba(6,20,11,0.94)'
const FILLD = 'rgba(3,11,6,0.98)'

interface Props { shipType: PlayerShipType; scale?: number }

/* Frame stations shared across all ships (viewBox 0 0 600 210) */
const FRAMES = [48, 100, 152, 204, 256, 308, 360, 412, 464, 516, 564]
const WL  = 153   // waterline y
const BL  = 183   // baseline (keel) y

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
          `linear-gradient(rgba(80,200,120,0.06) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(80,200,120,0.06) 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: `${gridPx}px ${gridPx}px`,
      }}
    >
      <svg className="sd-hull-svg" viewBox="0 0 600 210"
        preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <filter id="sbp-glow">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <marker id="arr" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5" fill="none" stroke={GD} strokeWidth="0.8"/>
          </marker>
          <marker id="arrl" markerWidth="5" markerHeight="5" refX="0" refY="2.5" orient="auto">
            <path d="M5,0 L0,2.5 L5,5" fill="none" stroke={GD} strokeWidth="0.8"/>
          </marker>
        </defs>

        {/* ── Blueprint reference lines ──────────────────────────────────── */}
        {/* Baseline */}
        <line x1="20" y1={BL} x2="584" y2={BL}
          stroke={G} strokeWidth="0.5" opacity="0.3" />
        <text x="10" y={BL+1} fontSize="5.5" fill={G} opacity="0.4"
          fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(-90,10,${BL})`}>B.L.</text>

        {/* Design waterline */}
        <line x1="20" y1={WL} x2="584" y2={WL}
          stroke={G} strokeWidth="0.6" opacity="0.25" strokeDasharray="14 5" />
        <text x="10" y={WL+1} fontSize="5.5" fill={G} opacity="0.4"
          fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(-90,10,${WL})`}>D.W.L.</text>

        {/* Frame station lines */}
        {FRAMES.map((x, i) => (
          <g key={x}>
            <line x1={x} y1="82" x2={x} y2={BL+6}
              stroke={G} strokeWidth="0.35" opacity="0.14" strokeDasharray="4 4" />
            <text x={x} y={BL+11} fontSize="5" fill={G} opacity="0.28"
              textAnchor="middle" fontFamily="monospace">{i}</text>
          </g>
        ))}

        {/* LOA dimension line */}
        <line x1="28" y1="78" x2="572" y2="78"
          stroke={GD} strokeWidth="0.5" opacity="0.5"
          markerStart="url(#arrl)" markerEnd="url(#arr)" />
        <text x="300" y="75" fontSize="6" fill={GD} opacity="0.55"
          textAnchor="middle" fontFamily="monospace">L.O.A.</text>

        {/* Draft marks (bow) */}
        <line x1="32" y1={WL} x2="32" y2={BL}
          stroke={GD} strokeWidth="0.6" opacity="0.4" />
        <text x="30" y={(WL+BL)/2} fontSize="5" fill={GD} opacity="0.45"
          textAnchor="end" fontFamily="monospace">d</text>

        {/* BOW / STERN labels */}
        <text x="28"  y="207" fontSize="6.5" fill={G} opacity="0.3" fontFamily="monospace">BOW</text>
        <text x="572" y="207" fontSize="6.5" fill={G} opacity="0.3" fontFamily="monospace" textAnchor="end">STERN</text>

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
    <g filter="url(#sbp-glow)">
      {/* ── Hull form ── */}
      <path
        d="M 48,100 C 42,100 34,114 30,131 C 28,145 33,152 40,154
           L 40,183 L 560,183 L 565,170 L 565,108
           L 470,108 L 454,100 Z"
        fill={FILL} stroke={G} strokeWidth="2" />

      {/* Forecastle sheer */}
      <path d="M 48,100 C 64,97 130,95 200,95 L 454,100"
        fill="none" stroke={G} strokeWidth="0.8" opacity="0.5" />
      {/* Quarterdeck line */}
      <path d="M 470,108 L 565,108" fill="none" stroke={G} strokeWidth="0.6" opacity="0.35" />

      {/* Hull plating seams (horizontal strakes) */}
      <path d="M 40,120 C 100,118 400,118 560,120"
        fill="none" stroke={G} strokeWidth="0.35" opacity="0.18" strokeDasharray="8 5" />
      <path d="M 40,136 L 560,136"
        fill="none" stroke={G} strokeWidth="0.3"  opacity="0.14" strokeDasharray="8 5" />

      {/* Boot topping */}
      <path d="M 40,154 L 560,156 L 560,162 L 40,160 Z"
        fill="rgba(80,200,120,0.04)" stroke={G} strokeWidth="0.3" opacity="0.22" />

      {/* Sonar dome */}
      <ellipse cx="44" cy="183" rx="14" ry="4"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.6" />

      {/* ── A gun (twin 12.7cm) ── */}
      <rect x="65" y="87" width="52" height="15" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      {/* gun shield */}
      <path d="M 65,87 L 78,81 L 115,81 L 117,102 L 65,102 Z"
        fill="none" stroke={G} strokeWidth="0.6" opacity="0.3" />
      <line x1="65"  y1="91" x2="24" y2="82"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="65"  y1="96" x2="24" y2="87"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <text x="91" y="85" fontSize="5" fill={GA} opacity="0.6" textAnchor="middle" fontFamily="monospace">12.7cm×2</text>

      {/* ── Bridge structure ── */}
      {/* Lower bridge */}
      <rect x="186" y="80" width="82" height="22" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      {/* Upper bridge */}
      <rect x="194" y="63" width="65" height="19" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      {/* Compass bridge */}
      <rect x="202" y="50" width="48" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />
      {/* Bridge windows (compass level) */}
      {[206,214,222,230,238,246].map(x => (
        <rect key={x} x={x} y="52" width="5" height="7" rx="0.5"
          fill="rgba(168,255,200,0.1)" stroke={GA} strokeWidth="0.5" opacity="0.7" />
      ))}
      {/* Bridge windows (upper) */}
      {[198,207,216,225,234,243,252].map(x => (
        <rect key={x} x={x} y="65" width="5" height="7" rx="0.5"
          fill="rgba(126,234,160,0.08)" stroke={G} strokeWidth="0.5" opacity="0.6" />
      ))}
      {/* Bridge wings */}
      <rect x="178" y="80" width="9" height="11" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />
      <rect x="268" y="80" width="9" height="11" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />
      {/* Fire control director */}
      <rect x="210" y="42" width="28" height="10" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.9" />
      <line x1="220" y1="42" x2="226" y2="35" stroke={GB} strokeWidth="1.5" />
      <text x="227" y="78" fontSize="5" fill={GA} opacity="0.55" textAnchor="middle" fontFamily="monospace">BRIDGE</text>

      {/* ── Main mast ── */}
      <line x1="226" y1="50" x2="226" y2="15" stroke={GB} strokeWidth="1.4" />
      <line x1="208" y1="26" x2="244" y2="26" stroke={GB} strokeWidth="0.9" opacity="0.7" />
      <line x1="214" y1="20" x2="238" y2="20" stroke={GB} strokeWidth="0.7" opacity="0.55" />
      {/* Radar */}
      <rect x="218" y="11" width="16" height="7" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.9" />
      <line x1="218" y1="14" x2="234" y2="14" stroke={GB} strokeWidth="0.5" opacity="0.4" />

      {/* ── No.1 Funnel ── */}
      <path d="M 300,100 L 298,61 L 323,61 L 322,100 Z"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      {/* funnel cap */}
      <path d="M 296,61 L 301,54 L 321,54 L 325,61 Z"
        fill={FILLD} stroke={G} strokeWidth="0.9" />
      <ellipse cx="311" cy="54" rx="12" ry="3.5"
        fill={FILLD} stroke={GB} strokeWidth="0.9" />
      <text x="311" y="108" fontSize="5" fill={G} opacity="0.4" textAnchor="middle" fontFamily="monospace">No.1</text>

      {/* ── No.2 Funnel ── */}
      <path d="M 342,100 L 341,68 L 362,68 L 362,100 Z"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <path d="M 339,68 L 343,62 L 361,62 L 364,68 Z"
        fill={FILLD} stroke={G} strokeWidth="0.8" />
      <ellipse cx="352" cy="62" rx="11" ry="3"
        fill={FILLD} stroke={GB} strokeWidth="0.8" />
      <text x="352" y="108" fontSize="5" fill={G} opacity="0.4" textAnchor="middle" fontFamily="monospace">No.2</text>

      {/* ── Aft mast ── */}
      <line x1="382" y1="96" x2="382" y2="64" stroke={GB} strokeWidth="1" opacity="0.6" />
      <line x1="370" y1="70" x2="394" y2="70" stroke={GB} strokeWidth="0.7" opacity="0.5" />
      <rect x="374" y="60" width="16" height="6" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.7" opacity="0.7" />

      {/* ── Torpedo tubes (quad bank) ── */}
      <rect x="390" y="93" width="62" height="11" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      {[396,405,414,423,432,441,450].map(x => (
        <line key={x} x1={x} y1="93" x2={x} y2="104"
          stroke={G} strokeWidth="0.5" opacity="0.38" />
      ))}
      <text x="421" y="90" fontSize="5" fill={GA} opacity="0.55" textAnchor="middle" fontFamily="monospace">533mm T.T.×4</text>

      {/* ── Aft deckhouse ── */}
      <rect x="430" y="89" width="48" height="19" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />

      {/* ── Y gun ── */}
      <rect x="474" y="95" width="46" height="15" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <path d="M 520,95 L 532,89 L 532,110 L 520,110 Z"
        fill="none" stroke={G} strokeWidth="0.6" opacity="0.3" />
      <line x1="518" y1="99"  x2="548" y2="91"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="518" y1="104" x2="548" y2="96"  stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <text x="497" y="92" fontSize="5" fill={GA} opacity="0.6" textAnchor="middle" fontFamily="monospace">12.7cm×2</text>

      {/* Hawsepipe */}
      <ellipse cx="44" cy="151" rx="5" ry="3"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.55" />
      {/* Anchor chain */}
      {[52,58,64,70,76].map(x => (
        <rect key={x} x={x-2} y="149" width="4" height="3" rx="0.8"
          fill="none" stroke={G} strokeWidth="0.5" opacity="0.28" />
      ))}

      {/* Propeller shafts */}
      <line x1="548" y1="176" x2="570" y2="176" stroke={G} strokeWidth="1.1" opacity="0.45" />
      <line x1="548" y1="168" x2="570" y2="168" stroke={G} strokeWidth="1.1" opacity="0.45" />
      {/* Rudder */}
      <path d="M 560,167 L 566,165 L 566,181 L 560,183 Z"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.6" />
    </g>
  )
}

/* ──────────────────────────────────────────────────────────────── Cruiser ── */
function CruiserSide() {
  return (
    <g filter="url(#sbp-glow)">
      {/* ── Hull form ── */}
      <path
        d="M 44,95 C 37,95 26,112 24,131 C 22,147 29,153 38,155
           L 40,183 L 558,183 L 565,172 L 565,105
           L 480,105 L 462,95 Z"
        fill={FILL} stroke={G} strokeWidth="2.2" />
      <path d="M 44,95 C 60,92 130,90 210,89 L 462,95"
        fill="none" stroke={G} strokeWidth="0.9" opacity="0.5" />
      <path d="M 480,105 L 565,105" fill="none" stroke={G} strokeWidth="0.5" opacity="0.32" />

      {/* Hull strakes */}
      <path d="M 40,118 C 150,116 420,116 558,118"
        fill="none" stroke={G} strokeWidth="0.35" opacity="0.16" strokeDasharray="9 5" />
      <path d="M 40,135 L 558,135"
        fill="none" stroke={G} strokeWidth="0.3"  opacity="0.13" strokeDasharray="9 5" />
      {/* Boot topping */}
      <path d="M 40,155 L 558,157 L 558,164 L 40,162 Z"
        fill="rgba(80,200,120,0.04)" stroke={G} strokeWidth="0.3" opacity="0.22" />

      <ellipse cx="44" cy="183" rx="17" ry="5"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.6" />

      {/* ── A turret (triple 20.3cm) ── */}
      <rect x="60" y="81" width="54" height="17" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <path d="M 60,81 L 75,74 L 112,74 L 114,98 L 60,98 Z"
        fill="none" stroke={G} strokeWidth="0.7" opacity="0.28" />
      <line x1="60" y1="85" x2="20" y2="75"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="60" y1="90" x2="20" y2="80"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <line x1="60" y1="95" x2="20" y2="85"  stroke={GB} strokeWidth="3.2" strokeLinecap="round" />
      <text x="90" y="79" fontSize="5" fill={GA} opacity="0.6" textAnchor="middle" fontFamily="monospace">20.3cm×3</text>

      {/* ── B turret (superfiring) ── */}
      <rect x="122" y="68" width="54" height="17" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <line x1="122" y1="72" x2="78"  y2="62"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="122" y1="77" x2="78"  y2="67"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="122" y1="82" x2="78"  y2="72"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />

      {/* ── Bridge tower ── */}
      <rect x="206" y="70" width="92" height="26" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <rect x="214" y="52" width="74" height="20" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="222" y="37" width="56" height="17" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="232" y="24" width="36" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />
      {/* Windows */}
      {[219,230,241,252,263,274,285].map(x => (
        <rect key={x} x={x} y="54" width="6" height="9" rx="0.5"
          fill="rgba(168,255,200,0.1)" stroke={GA} strokeWidth="0.5" opacity="0.7" />
      ))}
      {/* Bridge wings */}
      <rect x="196" y="70" width="11" height="13" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />
      <rect x="297" y="70" width="11" height="13" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.7" opacity="0.7" />
      {/* FC director on top */}
      <rect x="233" y="17" width="34" height="9" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="1" />
      <text x="252" y="68" fontSize="5" fill={GA} opacity="0.55" textAnchor="middle" fontFamily="monospace">BRIDGE</text>

      {/* ── Main mast ── */}
      <line x1="250" y1="37" x2="250" y2="5"  stroke={GB} strokeWidth="1.4" />
      <line x1="230" y1="17" x2="270" y2="17" stroke={GB} strokeWidth="0.9" opacity="0.7" />
      <line x1="237" y1="11" x2="263" y2="11" stroke={GB} strokeWidth="0.7" opacity="0.5" />
      <rect x="241" y="2"  width="18" height="7" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.9" />

      {/* ── No.1 Funnel ── */}
      <path d="M 324,95 L 322,50 L 351,50 L 351,95 Z"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <path d="M 320,50 L 325,42 L 349,42 L 353,50 Z"
        fill={FILLD} stroke={G} strokeWidth="0.9" />
      <ellipse cx="337" cy="42" rx="15" ry="4.5"
        fill={FILLD} stroke={GB} strokeWidth="1" />
      <text x="337" y="105" fontSize="5" fill={G} opacity="0.4" textAnchor="middle" fontFamily="monospace">No.1</text>

      {/* ── No.2 Funnel ── */}
      <path d="M 374,95 L 373,58 L 399,58 L 399,95 Z"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <path d="M 371,58 L 375,51 L 397,51 L 401,58 Z"
        fill={FILLD} stroke={G} strokeWidth="0.9" />
      <ellipse cx="386" cy="51" rx="13" ry="4"
        fill={FILLD} stroke={GB} strokeWidth="0.9" />
      <text x="386" y="105" fontSize="5" fill={G} opacity="0.4" textAnchor="middle" fontFamily="monospace">No.2</text>

      {/* ── Aft mast ── */}
      <line x1="428" y1="90" x2="428" y2="58" stroke={GB} strokeWidth="1.1" opacity="0.6" />
      <line x1="416" y1="64" x2="440" y2="64" stroke={GB} strokeWidth="0.8" opacity="0.5" />
      <rect x="418" y="54" width="20" height="7" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.8" opacity="0.7" />

      {/* ── Aft superstructure ── */}
      <rect x="433" y="80" width="54" height="22" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="440" y="66" width="40" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.8" />

      {/* ── X turret ── */}
      <rect x="464" y="82" width="54" height="17" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <path d="M 518,82 L 530,76 L 530,99 L 518,99 Z"
        fill="none" stroke={G} strokeWidth="0.6" opacity="0.28" />
      <line x1="516" y1="86" x2="552" y2="76"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="516" y1="91" x2="552" y2="81"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="516" y1="96" x2="552" y2="86"  stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <text x="490" y="80" fontSize="5" fill={GA} opacity="0.6" textAnchor="middle" fontFamily="monospace">20.3cm×3</text>

      {/* Propeller shafts */}
      <line x1="546" y1="177" x2="570" y2="177" stroke={G} strokeWidth="1.2" opacity="0.45" />
      <line x1="546" y1="169" x2="570" y2="169" stroke={G} strokeWidth="1.2" opacity="0.45" />
      <path d="M 562,166 L 568,164 L 568,182 L 562,184 Z"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.6" />
    </g>
  )
}

/* ─────────────────────────────────────────────────────────────── Battleship ── */
function BattleshipSide() {
  return (
    <g filter="url(#sbp-glow)">
      {/* ── Hull form ── */}
      <path
        d="M 42,88 C 34,88 22,108 20,130 C 18,148 27,153 36,155
           L 38,184 L 556,184 L 563,174 L 563,103
           L 486,103 L 467,88 Z"
        fill={FILL} stroke={G} strokeWidth="2.4" />
      <path d="M 42,88 C 60,85 140,83 230,82 L 467,88"
        fill="none" stroke={G} strokeWidth="1" opacity="0.52" />
      <path d="M 486,103 L 563,103" fill="none" stroke={G} strokeWidth="0.5" opacity="0.3" />

      {/* Anti-torpedo bulge (Puglia) */}
      <path d="M 105,155 C 130,164 220,170 340,170 C 460,170 532,164 556,157"
        fill="none" stroke={G} strokeWidth="1.5" opacity="0.45" />
      <path d="M 105,155 C 130,162 220,168 340,168 C 460,168 532,162 556,157"
        fill="none" stroke={G} strokeWidth="0.4" opacity="0.16" />
      {/* Bulge label */}
      <text x="330" y="174" fontSize="4.5" fill={G} opacity="0.35" textAnchor="middle" fontFamily="monospace">ANTI-TORPEDO BULGE</text>

      {/* Armor belt strakes */}
      <line x1="38" y1="138" x2="556" y2="138"
        stroke={G} strokeWidth="0.4" opacity="0.18" />
      {[85,135,185,235,285,335,385,435,485,535].map(x => (
        <line key={x} x1={x} y1="138" x2={x} y2="155"
          stroke={G} strokeWidth="0.5" opacity="0.16" />
      ))}
      {/* Boot topping */}
      <path d="M 38,155 L 556,157 L 556,166 L 38,164 Z"
        fill="rgba(80,200,120,0.04)" stroke={G} strokeWidth="0.3" opacity="0.22" />

      {/* Hull strakes */}
      <path d="M 38,116 C 200,114 400,114 556,116"
        fill="none" stroke={G} strokeWidth="0.3" opacity="0.14" strokeDasharray="9 5" />

      <ellipse cx="44" cy="184" rx="20" ry="6"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.6" />

      {/* ── No.1 Turret (triple 46cm) ── */}
      <rect x="56" y="72" width="64" height="22" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.6" />
      <path d="M 56,72 L 74,62 L 118,62 L 120,94 L 56,94 Z"
        fill="none" stroke={G} strokeWidth="0.8" opacity="0.26" />
      <line x1="56"  y1="77" x2="8"   y2="66"  stroke={GB} strokeWidth="4.2" strokeLinecap="round" />
      <line x1="56"  y1="83" x2="8"   y2="72"  stroke={GB} strokeWidth="4.2" strokeLinecap="round" />
      <line x1="56"  y1="89" x2="8"   y2="78"  stroke={GB} strokeWidth="4.2" strokeLinecap="round" />
      <text x="90" y="70" fontSize="5" fill={GA} opacity="0.65" textAnchor="middle" fontFamily="monospace">46cm×3</text>

      {/* ── No.2 Turret (superfiring) ── */}
      <rect x="128" y="56" width="64" height="22" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <line x1="128" y1="61"  x2="72"  y2="49"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="128" y1="67"  x2="72"  y2="55"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="128" y1="73"  x2="72"  y2="61"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />

      {/* ── Pagoda tower ── */}
      <rect x="236" y="58" width="102" height="33" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <rect x="248" y="41" width="78" height="19" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <rect x="260" y="27" width="54" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="270" y="13" width="34" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <rect x="278" y="2"  width="18" height="13" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1" />
      {/* Tower windows */}
      {[255,270,285,300,315].map(x => (
        <rect key={x} x={x} y="43" width="8" height="10" rx="0.5"
          fill="rgba(168,255,200,0.1)" stroke={GA} strokeWidth="0.5" opacity="0.7" />
      ))}
      {/* Bridge wings */}
      <rect x="224" y="58" width="13" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.7" />
      <rect x="337" y="58" width="13" height="15" rx="1"
        fill={FILLD} stroke={G} strokeWidth="0.8" opacity="0.7" />
      {/* FC director atop tower */}
      <rect x="270" y="-5" width="34" height="9" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="1" />
      <line x1="280" y1="-5" x2="276" y2="-12" stroke={GB} strokeWidth="1.2" />
      <line x1="294" y1="-5" x2="298" y2="-12" stroke={GB} strokeWidth="1.2" />
      <text x="287" y="101" fontSize="5" fill={GA} opacity="0.55" textAnchor="middle" fontFamily="monospace">PAGODA BRIDGE</text>

      {/* ── Secondary battery (15.5cm) ── */}
      <rect x="183" y="82" width="44" height="14" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.1" opacity="0.85" />
      <line x1="183" y1="86" x2="158" y2="79"  stroke={GB} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="183" y1="90" x2="158" y2="83"  stroke={GB} strokeWidth="2.4" strokeLinecap="round" />
      <text x="205" y="80" fontSize="5" fill={G} opacity="0.5" textAnchor="middle" fontFamily="monospace">15.5cm</text>

      {/* ── No.1 Funnel ── */}
      <path d="M 364,88 L 362,44 L 392,44 L 392,88 Z"
        fill={FILLD} stroke={G} strokeWidth="1.6" />
      <path d="M 360,44 L 365,35 L 390,35 L 395,44 Z"
        fill={FILLD} stroke={G} strokeWidth="1" />
      <ellipse cx="378" cy="35" rx="17" ry="5.5"
        fill={FILLD} stroke={GB} strokeWidth="1.2" />
      <text x="378" y="103" fontSize="5" fill={G} opacity="0.4" textAnchor="middle" fontFamily="monospace">No.1</text>

      {/* ── No.2 Funnel ── */}
      <path d="M 410,88 L 409,52 L 436,52 L 436,88 Z"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <path d="M 407,52 L 411,44 L 434,44 L 438,52 Z"
        fill={FILLD} stroke={G} strokeWidth="1" />
      <ellipse cx="423" cy="44" rx="15" ry="5"
        fill={FILLD} stroke={GB} strokeWidth="1.1" />
      <text x="423" y="103" fontSize="5" fill={G} opacity="0.4" textAnchor="middle" fontFamily="monospace">No.2</text>

      {/* ── Aft superstructure ── */}
      <rect x="450" y="66" width="56" height="26" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="458" y="52" width="40" height="16" rx="1"
        fill={FILLD} stroke={G} strokeWidth="1.1" opacity="0.85" />
      {/* Aft FC director */}
      <rect x="462" y="44" width="30" height="9" rx="1"
        fill={FILLD} stroke={GB} strokeWidth="0.9" opacity="0.8" />

      {/* ── No.3 Turret (aft) ── */}
      <rect x="458" y="70" width="64" height="22" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <path d="M 522,70 L 536,62 L 536,92 L 522,92 Z"
        fill="none" stroke={G} strokeWidth="0.7" opacity="0.26" />
      <line x1="520" y1="75"  x2="564" y2="64"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="520" y1="81"  x2="564" y2="70"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <line x1="520" y1="87"  x2="564" y2="76"  stroke={GB} strokeWidth="4"   strokeLinecap="round" />
      <text x="490" y="68" fontSize="5" fill={GA} opacity="0.65" textAnchor="middle" fontFamily="monospace">46cm×3</text>

      {/* Propeller shafts (4 shaft) */}
      <line x1="538" y1="179" x2="566" y2="179" stroke={G} strokeWidth="1.4" opacity="0.45" />
      <line x1="538" y1="172" x2="566" y2="172" stroke={G} strokeWidth="1.4" opacity="0.45" />
      <line x1="538" y1="165" x2="566" y2="165" stroke={G} strokeWidth="1"   opacity="0.35" />
      <line x1="538" y1="158" x2="566" y2="158" stroke={G} strokeWidth="1"   opacity="0.35" />
      {/* Rudder */}
      <path d="M 558,166 L 566,163 L 566,185 L 558,187 Z"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.65" />
      <text x="556" y="203" fontSize="5" fill={G} opacity="0.3" textAnchor="middle" fontFamily="monospace">4-SHAFT</text>
    </g>
  )
}
