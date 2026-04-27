import { G, GB, GD, GA, FILL_TOP, FILLD_TOP, FILL_SIDE, FILLD_SIDE } from './colors'

/* ── Battleship — top-down view ────────────────────────────────────────────── */
export function BattleshipTop() {
  const FILL = FILL_TOP, FILLD = FILLD_TOP
  return (
    <g filter="url(#bp-glow)">
      {/* Hull — very wide, heavy battleship form */}
      <path
        d="M 100,38
           C 110,52 128,84 134,155
           L 140,420
           C 140,570 134,672 124,745
           L 120,800 L 100,848
           L 80,800 L 76,745
           C 66,672 60,570 60,420
           L 66,155
           C 72,84 90,52 100,38 Z"
        fill={FILL} stroke={G} strokeWidth="2.2" />
      {/* Anti-torpedo bulge */}
      <path
        d="M 130,200 C 145,260 148,400 145,550 C 142,650 138,720 128,760 L 120,800"
        fill="none" stroke={G} strokeWidth="1.4" opacity="0.38" />
      <path
        d="M 70,200 C 55,260 52,400 55,550 C 58,650 62,720 72,760 L 80,800"
        fill="none" stroke={G} strokeWidth="1.4" opacity="0.38" />
      <path
        d="M 100,50
           C 108,64 124,94 129,160
           L 134,420
           C 134,565 129,662 120,733
           L 100,838
           L 80,733
           C 71,662 66,565 66,420
           L 71,160
           C 76,94 92,64 100,50 Z"
        fill="none" stroke={G} strokeWidth="0.7" strokeDasharray="10 7" opacity="0.25" />

      {[165,240,320,400,480,560,640,720].map(y => {
        const hw = y < 210 ? 22+(y-165)*0.15 : y > 700 ? 34-(y-700)*0.5 : 38
        return <line key={y} x1={100-hw} y1={y} x2={100+hw} y2={y}
          stroke={G} strokeWidth="0.5" opacity="0.12" />
      })}

      {/* Forecastle break */}
      <line x1="67" y1="308" x2="133" y2="308"
        stroke={G} strokeWidth="1.2" opacity="0.42" />

      {/* Turret 1 (forward low, triple 46cm) */}
      <rect x="80" y="108" width="40" height="56" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <ellipse cx="100" cy="136" rx="16" ry="24"
        fill="rgba(4,12,8,0.92)" stroke={G} strokeWidth="1.2" />
      <line x1="94" y1="110" x2="94" y2="86" stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="100" y1="110" x2="100" y2="86" stroke={GB} strokeWidth="3"   strokeLinecap="round" />
      <line x1="106" y1="110" x2="106" y2="86" stroke={GB} strokeWidth="3"   strokeLinecap="round" />

      {/* Turret 2 (superfiring) */}
      <rect x="82" y="176" width="36" height="50" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="100" cy="201" rx="14" ry="21"
        fill="rgba(4,12,8,0.92)" stroke={G} strokeWidth="1.1" />
      <line x1="94" y1="178" x2="94" y2="156" stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="100" y1="178" x2="100" y2="156" stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="106" y1="178" x2="106" y2="156" stroke={GB} strokeWidth="2.8" strokeLinecap="round" />

      {/* Pagoda tower (top view = large block) */}
      <rect x="78" y="254" width="44" height="70" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.5" />
      <rect x="82" y="260" width="36" height="56" rx="1"
        fill="rgba(4,12,8,0.95)" stroke={G} strokeWidth="0.8" />
      {[264,272,280,288,296,304].map(y => (
        <line key={y} x1="84" y1={y} x2="116" y2={y}
          stroke={G} strokeWidth="0.5" opacity="0.25" />
      ))}
      {/* Mainmast (center of tower) */}
      <circle cx="100" cy="338" r="4" fill={FILLD} stroke={GB} strokeWidth="1.1" />

      {/* Secondary batteries (port & starboard) */}
      <rect x="48" y="270" width="26" height="32" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.85" />
      <rect x="126" y="270" width="26" height="32" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.85" />
      <ellipse cx="61"  cy="286" rx="10" ry="13" fill="rgba(4,10,6,0.9)" stroke={G} strokeWidth="0.8" />
      <ellipse cx="139" cy="286" rx="10" ry="13" fill="rgba(4,10,6,0.9)" stroke={G} strokeWidth="0.8" />

      {/* Forward funnel */}
      <rect x="84" y="390" width="32" height="30" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="100" cy="405" rx="13" ry="12"
        fill="rgba(4,10,6,0.98)" stroke={G} strokeWidth="1" />

      {/* Aft funnel */}
      <rect x="86" y="436" width="28" height="26" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <ellipse cx="100" cy="449" rx="11" ry="10"
        fill="rgba(4,10,6,0.98)" stroke={G} strokeWidth="0.9" />

      {/* Aft superstructure */}
      <rect x="79" y="524" width="42" height="50" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <rect x="84" y="530" width="32" height="38" rx="1"
        fill="rgba(4,12,8,0.95)" stroke={G} strokeWidth="0.8" />

      {/* Turret 3 (aft) */}
      <rect x="82" y="590" width="36" height="50" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.4" />
      <ellipse cx="100" cy="615" rx="14" ry="21"
        fill="rgba(4,12,8,0.92)" stroke={G} strokeWidth="1.1" />
      <line x1="94"  y1="638" x2="94"  y2="660" stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="100" y1="638" x2="100" y2="660" stroke={GB} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="106" y1="638" x2="106" y2="660" stroke={GB} strokeWidth="2.8" strokeLinecap="round" />

      {/* Propeller shafts (4 shafts) */}
      <line x1="88" y1="808" x2="82" y2="842" stroke={G} strokeWidth="1.4" opacity="0.45" />
      <line x1="94" y1="810" x2="90" y2="842" stroke={G} strokeWidth="1"   opacity="0.35" />
      <line x1="112" y1="808" x2="118" y2="842" stroke={G} strokeWidth="1.4" opacity="0.45" />
      <line x1="106" y1="810" x2="110" y2="842" stroke={G} strokeWidth="1"   opacity="0.35" />
      <ellipse cx="81"  cy="844" rx="6" ry="3.5" fill="none" stroke={G} strokeWidth="1" opacity="0.4" />
      <ellipse cx="119" cy="844" rx="6" ry="3.5" fill="none" stroke={G} strokeWidth="1" opacity="0.4" />
    </g>
  )
}

/* ── Battleship — side view ────────────────────────────────────────────────── */
export function BattleshipSide() {
  const FILL = FILL_SIDE, FILLD = FILLD_SIDE
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

      {/* ── Hull section compartments ── */}
      {[
        { label: '①',  x1:  20, x2:  65, c: '#3a88c8' },
        { label: '②',  x1:  65, x2: 110, c: '#3a88c8' },
        { label: '③',  x1: 110, x2: 155, c: '#3a88c8' },
        { label: '④',  x1: 155, x2: 201, c: '#c84a4a' },
        { label: '⑤',  x1: 201, x2: 246, c: '#c84a4a' },
        { label: '⑥',  x1: 246, x2: 291, c: '#c84a4a' },
        { label: '⑦',  x1: 291, x2: 337, c: '#c84a4a' },
        { label: '⑧',  x1: 337, x2: 382, c: '#c84a4a' },
        { label: '⑨',  x1: 382, x2: 427, c: '#c84a4a' },
        { label: '⑩',  x1: 427, x2: 472, c: '#c84a4a' },
        { label: '⑪',  x1: 472, x2: 517, c: '#c84a4a' },
        { label: '⑫',  x1: 517, x2: 563, c: '#c84a4a' },
      ].map(({ label, x1, x2, c }) => (
        <g key={label}>
          <rect x={x1 + 1} y={213} width={x2 - x1 - 2} height={16}
            fill="rgba(0,0,0,0.5)" stroke={c} strokeWidth="0.9" opacity="0.85" />
          <text x={(x1 + x2) / 2} y={224} fontSize="7" fill={c} opacity="0.9"
            textAnchor="middle" fontFamily="monospace">{label}</text>
        </g>
      ))}
    </g>
  )
}
