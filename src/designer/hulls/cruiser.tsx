import { G, GB, GD, GA, FILL_TOP, FILLD_TOP, FILL_SIDE, FILLD_SIDE } from './colors'

/* ── Cruiser — top-down view ───────────────────────────────────────────────── */
export function CruiserTop() {
  const FILL = FILL_TOP, FILLD = FILLD_TOP
  return (
    <g filter="url(#bp-glow)">
      {/* Hull — wider, cruiser form */}
      <path
        d="M 100,40
           C 108,55 122,88 126,158
           L 130,420
           C 130,565 124,668 116,738
           L 112,796 L 100,842
           L 88,796 L 84,738
           C 76,668 70,565 70,420
           L 74,158
           C 78,88 92,55 100,40 Z"
        fill={FILL} stroke={G} strokeWidth="2" />
      <path
        d="M 100,52
           C 106,66 118,96 121,162
           L 124,420
           C 124,558 119,655 112,723
           L 100,832
           L 88,723
           C 81,655 76,558 76,420
           L 79,162
           C 82,96 94,66 100,52 Z"
        fill="none" stroke={G} strokeWidth="0.7" strokeDasharray="10 7" opacity="0.28" />

      {[160,240,320,400,480,560,640,715].map(y => {
        const hw = y < 200 ? 18+(y-160)*0.1 : y > 680 ? 26-(y-680)*0.5 : 28
        return <line key={y} x1={100-hw} y1={y} x2={100+hw} y2={y}
          stroke={G} strokeWidth="0.5" opacity="0.13" />
      })}

      {/* Forecastle break */}
      <line x1="76" y1="295" x2="124" y2="295"
        stroke={G} strokeWidth="1.1" opacity="0.45" />

      {/* A turret (triple) */}
      <rect x="84" y="116" width="32" height="42" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <ellipse cx="100" cy="137" rx="12" ry="18"
        fill="rgba(4,12,8,0.9)" stroke={G} strokeWidth="1" />
      <line x1="96" y1="118" x2="96" y2="98" stroke={GB} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="100" y1="118" x2="100" y2="98" stroke={GB} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="104" y1="118" x2="104" y2="98" stroke={GB} strokeWidth="2.4" strokeLinecap="round" />

      {/* B turret (superfiring) */}
      <rect x="85" y="172" width="30" height="38" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <ellipse cx="100" cy="191" rx="11" ry="16"
        fill="rgba(4,12,8,0.9)" stroke={G} strokeWidth="0.9" />
      <line x1="96" y1="174" x2="96" y2="156" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="100" y1="174" x2="100" y2="156" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="104" y1="174" x2="104" y2="156" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />

      {/* Bridge tower */}
      <rect x="82" y="228" width="36" height="58" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      {[234,244,254,264,274].map(y => (
        <rect key={y} x="84" y={y} width="6" height="6" rx="1"
          fill="rgba(126,234,160,0.16)" stroke={G} strokeWidth="0.6" />
      ))}
      {[234,244,254,264,274].map(y => (
        <rect key={y+'r'} x="110" y={y} width="6" height="6" rx="1"
          fill="rgba(126,234,160,0.16)" stroke={G} strokeWidth="0.6" />
      ))}
      <rect x="88" y="236" width="24" height="38" rx="1"
        fill="rgba(4,12,8,0.95)" stroke={G} strokeWidth="0.8" />

      {/* Mainmast */}
      <circle cx="100" cy="316" r="5" fill={FILLD} stroke={GB} strokeWidth="1.1" />
      <circle cx="100" cy="316" r="2" fill={GB} opacity="0.7" />

      {/* Forward funnel */}
      <rect x="86" y="376" width="28" height="26" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.3" />
      <ellipse cx="100" cy="389" rx="11" ry="10"
        fill="rgba(4,10,6,0.98)" stroke={G} strokeWidth="0.9" />

      {/* Aft funnel */}
      <rect x="88" y="420" width="24" height="22" rx="4"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <ellipse cx="100" cy="431" rx="9" ry="8"
        fill="rgba(4,10,6,0.98)" stroke={G} strokeWidth="0.8" />

      {/* Aft superstructure */}
      <rect x="84" y="510" width="32" height="44" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" />

      {/* X turret */}
      <rect x="85" y="574" width="30" height="38" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <ellipse cx="100" cy="593" rx="11" ry="16"
        fill="rgba(4,12,8,0.9)" stroke={G} strokeWidth="0.9" />
      <line x1="96"  y1="612" x2="96"  y2="630" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="100" y1="612" x2="100" y2="630" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="104" y1="612" x2="104" y2="630" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />

      {/* Propeller shafts */}
      <line x1="92" y1="806" x2="87" y2="836" stroke={G} strokeWidth="1.3" opacity="0.45" />
      <line x1="108" y1="806" x2="113" y2="836" stroke={G} strokeWidth="1.3" opacity="0.45" />
      <ellipse cx="86" cy="838" rx="6" ry="3.5" fill="none" stroke={G} strokeWidth="1" opacity="0.4" />
      <ellipse cx="114" cy="838" rx="6" ry="3.5" fill="none" stroke={G} strokeWidth="1" opacity="0.4" />
    </g>
  )
}

/* ── Cruiser — side view ───────────────────────────────────────────────────── */
export function CruiserSide() {
  const FILL = FILL_SIDE, FILLD = FILLD_SIDE
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

      {/* ── Hull section compartments ── */}
      {[
        { label: '①', x1:  24, x2:  78, c: '#3a88c8' },
        { label: '②', x1:  78, x2: 132, c: '#3a88c8' },
        { label: '③', x1: 132, x2: 186, c: '#c84a4a' },
        { label: '④', x1: 186, x2: 241, c: '#c84a4a' },
        { label: '⑤', x1: 241, x2: 295, c: '#c84a4a' },
        { label: '⑥', x1: 295, x2: 349, c: '#c84a4a' },
        { label: '⑦', x1: 349, x2: 403, c: '#c84a4a' },
        { label: '⑧', x1: 403, x2: 458, c: '#c84a4a' },
        { label: '⑨', x1: 458, x2: 512, c: '#c84a4a' },
        { label: '⑩', x1: 512, x2: 565, c: '#c84a4a' },
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
