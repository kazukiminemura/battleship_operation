import { G, GB, GD, GA, FILL_TOP, FILLD_TOP, FILL_SIDE, FILLD_SIDE } from './colors'

/* ── Destroyer — top-down view ─────────────────────────────────────────────── */
export function DestroyerTop() {
  const FILL = FILL_TOP, FILLD = FILLD_TOP
  return (
    <g filter="url(#bp-glow)">
      {/* Hull outline — narrow, clipper bow */}
      <path
        d="M 100,42
           C 106,55 116,90 118,160
           L 120,420
           C 120,560 116,660 110,730
           L 108,790 L 100,838
           L 92,790 L 90,730
           C 84,660 80,560 80,420
           L 82,160
           C 84,90 94,55 100,42 Z"
        fill={FILL} stroke={G} strokeWidth="1.8" />
      {/* Inner hull line (strake) */}
      <path
        d="M 100,52
           C 104,64 112,96 113,165
           L 115,420
           C 115,555 111,652 106,720
           L 100,828
           L 94,720
           C 89,652 85,555 85,420
           L 87,165
           C 88,96 96,64 100,52 Z"
        fill="none" stroke={G} strokeWidth="0.6" strokeDasharray="10 7" opacity="0.3" />

      {/* Frame section lines */}
      {[160,240,320,400,480,560,640,710].map(y => {
        const hw = y < 200 ? 14 + (y-160)*0.1 : y > 680 ? 18-(y-680)*0.4 : 20
        return <line key={y} x1={100-hw} y1={y} x2={100+hw} y2={y}
          stroke={G} strokeWidth="0.5" opacity="0.15" />
      })}

      {/* Forecastle break */}
      <line x1="82" y1="280" x2="118" y2="280"
        stroke={G} strokeWidth="1" opacity="0.45" />
      <line x1="82" y1="282" x2="118" y2="282"
        stroke={G} strokeWidth="0.4" opacity="0.2" />

      {/* A gun platform */}
      <rect x="87" y="120" width="26" height="34" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <ellipse cx="100" cy="137" rx="10" ry="14"
        fill="rgba(4,12,8,0.9)" stroke={G} strokeWidth="0.9" />
      {/* Gun barrel (twin, pointing bow) */}
      <line x1="97" y1="122" x2="97" y2="105" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="103" y1="122" x2="103" y2="105" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />

      {/* Bridge structure */}
      <rect x="84" y="210" width="32" height="52" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      {/* Bridge windows */}
      {[218,228,238,248].map(y => (
        <rect key={y} x="86" y={y} width="5" height="5" rx="1"
          fill="rgba(126,234,160,0.18)" stroke={G} strokeWidth="0.6" />
      ))}
      {[218,228,238,248].map(y => (
        <rect key={y+'r'} x="109" y={y} width="5" height="5" rx="1"
          fill="rgba(126,234,160,0.18)" stroke={G} strokeWidth="0.6" />
      ))}
      {/* CIC inner */}
      <rect x="90" y="220" width="20" height="30" rx="1"
        fill="rgba(4,12,8,0.95)" stroke={G} strokeWidth="0.7" opacity="0.8" />

      {/* Mainmast (top view = circle) */}
      <circle cx="100" cy="300" r="4"
        fill={FILLD} stroke={GB} strokeWidth="1" />
      <circle cx="100" cy="300" r="1.5"
        fill={GB} opacity="0.7" />

      {/* Forward funnel */}
      <rect x="88" y="360" width="24" height="22" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.2" />
      <ellipse cx="100" cy="371" rx="9" ry="8"
        fill="rgba(4,10,6,0.98)" stroke={G} strokeWidth="0.8" opacity="0.9" />

      {/* Aft funnel */}
      <rect x="90" y="400" width="20" height="18" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <ellipse cx="100" cy="409" rx="7" ry="6.5"
        fill="rgba(4,10,6,0.98)" stroke={G} strokeWidth="0.7" opacity="0.85" />

      {/* Torpedo tube banks (port & starboard) */}
      <rect x="62" y="450" width="28" height="14" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.85" />
      <rect x="110" y="450" width="28" height="14" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" opacity="0.85" />
      {/* Tube detail lines */}
      {[454,458,462].map(y => (
        <line key={y} x1="62" y1={y} x2="90" y2={y}
          stroke={G} strokeWidth="0.4" opacity="0.35" />
      ))}
      {[454,458,462].map(y => (
        <line key={y+'r'} x1="110" y1={y} x2="138" y2={y}
          stroke={G} strokeWidth="0.4" opacity="0.35" />
      ))}

      {/* Aft deckhouse */}
      <rect x="88" y="530" width="24" height="36" rx="2"
        fill={FILLD} stroke={G} strokeWidth="1" />

      {/* Y gun */}
      <rect x="88" y="620" width="24" height="28" rx="3"
        fill={FILLD} stroke={G} strokeWidth="1.1" />
      <ellipse cx="100" cy="634" rx="9" ry="11"
        fill="rgba(4,12,8,0.9)" stroke={G} strokeWidth="0.8" />
      <line x1="97"  y1="649" x2="97"  y2="665" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="103" y1="649" x2="103" y2="665" stroke={GB} strokeWidth="2.2" strokeLinecap="round" />

      {/* Depth charge rack (stern) */}
      <rect x="90" y="730" width="20" height="12" rx="2"
        fill={FILLD} stroke={G} strokeWidth="0.9" opacity="0.7" />
      {[93,97,101,105,109].map(x => (
        <ellipse key={x} cx={x} cy="736" rx="2.5" ry="2"
          fill="none" stroke={G} strokeWidth="0.5" opacity="0.4" />
      ))}

      {/* Propeller shafts */}
      <line x1="94" y1="800" x2="90" y2="830"
        stroke={G} strokeWidth="1.2" opacity="0.45" />
      <line x1="106" y1="800" x2="110" y2="830"
        stroke={G} strokeWidth="1.2" opacity="0.45" />
      <ellipse cx="89" cy="832" rx="5" ry="3"
        fill="none" stroke={G} strokeWidth="1" opacity="0.45" />
      <ellipse cx="111" cy="832" rx="5" ry="3"
        fill="none" stroke={G} strokeWidth="1" opacity="0.45" />
    </g>
  )
}

/* ── Destroyer — side view ─────────────────────────────────────────────────── */
export function DestroyerSide() {
  const FILL = FILL_SIDE, FILLD = FILLD_SIDE
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

      {/* ── Hull section compartments ── */}
      {[
        { label: '①', x1:  30, x2:  97, c: '#3a88c8' },
        { label: '②', x1:  97, x2: 164, c: '#3a88c8' },
        { label: '③', x1: 164, x2: 231, c: '#c84a4a' },
        { label: '④', x1: 231, x2: 298, c: '#c84a4a' },
        { label: '⑤', x1: 298, x2: 366, c: '#c84a4a' },
        { label: '⑥', x1: 366, x2: 433, c: '#c84a4a' },
        { label: '⑦', x1: 433, x2: 499, c: '#c84a4a' },
        { label: '⑧', x1: 499, x2: 565, c: '#c84a4a' },
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
