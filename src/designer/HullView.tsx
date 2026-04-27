import { useMemo } from 'react'
import { WEAPON_BY_ID } from './data'
import { ShipSlot } from './ShipSlot'
import { wouldInterfere } from './collision'
import type { SlotDef, Design } from './types'
import type { PlayerShipType } from '../game/data/masterdata'

const G    = '#50c878'
const GB   = '#7eeaa0'
const FILL  = 'rgba(8,26,13,0.92)'
const FILLD = 'rgba(4,14,8,0.97)'

interface Props {
  slots: SlotDef[]
  design: Design
  draggingWeaponId: string | null
  scale?: number
  shipType?: PlayerShipType
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: (slotId: string) => void
}

export function HullView({ slots, design, draggingWeaponId, scale = 1, shipType = 'destroyer', onDrop, onRemove }: Props) {
  const draggingWeapon = draggingWeaponId ? WEAPON_BY_ID[draggingWeaponId] ?? null : null

  const getType = (weaponId: string) => WEAPON_BY_ID[weaponId]?.type

  const blockedSlots = useMemo<Set<string>>(() => {
    if (!draggingWeapon) return new Set()
    return new Set(
      slots
        .filter(slot => wouldInterfere(slot, draggingWeapon.type, slots, design, getType))
        .map(slot => slot.id)
    )
  }, [draggingWeapon, slots, design])

  const handleDrop = (slotId: string, weaponId: string) => {
    const slot   = slots.find(s => s.id === slotId)
    const weapon = WEAPON_BY_ID[weaponId]
    if (!slot || !weapon) return
    if (!slot.compatibleTypes.includes(weapon.type)) return
    if (wouldInterfere(slot, weapon.type, slots, design, getType)) return
    onDrop(slotId, weaponId)
  }

  const w = 160 * scale
  const h = 700 * scale
  const gridPx = Math.round(20 * scale)

  return (
    <div
      className="sd-hull-wrapper"
      style={{
        width:  w,
        height: h,
        backgroundImage: [
          `linear-gradient(rgba(80,200,120,0.08) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(80,200,120,0.08) 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: `${gridPx}px ${gridPx}px`,
      }}
    >
      <svg
        className="sd-hull-svg"
        viewBox="0 0 200 875"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <filter id="bp-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Centreline */}
        <line x1="100" y1="20" x2="100" y2="855"
          stroke={G} strokeWidth="0.6" opacity="0.22" strokeDasharray="8 5" />

        {/* Bow direction arrow */}
        <path d="M 100,22 L 94,38 L 106,38 Z"
          fill={G} opacity="0.35" />
        <text x="100" y="14" fontSize="8" fill={G} opacity="0.3"
          textAnchor="middle" fontFamily="monospace">BOW</text>

        {shipType === 'destroyer'  && <DestroyerTop />}
        {shipType === 'cruiser'    && <CruiserTop />}
        {shipType === 'battleship' && <BattleshipTop />}
      </svg>

      <div className="sd-slots-overlay">
        {slots.map(slot => {
          const weaponId = design[slot.id]
          const weapon   = weaponId ? (WEAPON_BY_ID[weaponId] ?? null) : null
          const isDragTarget = draggingWeapon !== null && slot.compatibleTypes.includes(draggingWeapon.type)
          const isBlocked    = blockedSlots.has(slot.id)
          return (
            <ShipSlot
              key={slot.id}
              slot={slot}
              equippedWeapon={weapon}
              isDragTarget={isDragTarget}
              isBlocked={isBlocked}
              onDrop={handleDrop}
              onRemove={onRemove}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────── Destroyer top-down ── */
function DestroyerTop() {
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

/* ──────────────────────────────────────────────────── Cruiser top-down ── */
function CruiserTop() {
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

/* ────────────────────────────────────────────────── Battleship top-down ── */
function BattleshipTop() {
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
