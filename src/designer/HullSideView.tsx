import { useState } from 'react'
import type { PlayerShipType } from '../game/data/masterdata'
import { WEAPON_BY_ID } from './data'
import { wouldInterfere } from './collision'
import { HULL_VIEWS } from './hulls'
import { G, GD } from './hulls/colors'
import type { SlotDef, Design, WeaponSlotType } from './types'

interface Props {
  shipType: PlayerShipType
  scale?: number
  slots?: SlotDef[]
  design?: Design
  draggingWeaponId?: string | null
  hoveredSlotId?: string | null
  onDrop?: (slotId: string, weaponId: string) => void
  onRemove?: (slotId: string) => void
  onSlotHover?: (slotId: string | null) => void
}

/* Frame stations shared across all ships (viewBox 0 0 600 210) */
const FRAMES = [48, 100, 152, 204, 256, 308, 360, 412, 464, 516, 564]
const WL  = 153   // waterline y
const BL  = 183   // baseline (keel) y

/* Slot type → deck height % in side view (gun high, torp near waterline) */
const TYPE_DECK_PCT: Record<WeaponSlotType, number> = {
  gun:       39,
  secondary: 44,
  aa:        36,
  missile:   42,
  torpedo:   57,
}

const TYPE_COLOR: Record<WeaponSlotType, string> = {
  gun:       '#d4c84a',
  secondary: '#a8d458',
  torpedo:   '#4adac8',
  aa:        '#58d8a0',
  missile:   '#a0c8e8',
}

/** slotDef.y (11-89 %) → CSS left% on the side-view wrapper */
function slotToLeftPct(slotY: number): number {
  // ship spans SVG x ≈ 24 to 565 (span 541) within viewBox width 600
  return (24 + (slotY - 11) / 78 * 541) / 600 * 100
}

export function HullSideView({
  shipType, scale = 1,
  slots = [], design = {}, draggingWeaponId = null,
  hoveredSlotId, onDrop, onRemove, onSlotHover,
}: Props) {
  const w      = Math.round(480 * scale)
  const h      = Math.round(240 * scale)
  const gridPx = Math.round(20 * scale)

  const draggingWeapon = draggingWeaponId ? (WEAPON_BY_ID[draggingWeaponId] ?? null) : null
  const getType = (wid: string) => WEAPON_BY_ID[wid]?.type

  const handleDrop = (slotId: string, weaponId: string) => {
    const slot   = slots.find(s => s.id === slotId)
    const weapon = WEAPON_BY_ID[weaponId]
    if (!slot || !weapon) return
    if (!slot.compatibleTypes.includes(weapon.type)) return
    if (wouldInterfere(slot, weapon.type, slots, design, getType)) return
    onDrop?.(slotId, weaponId)
  }

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
        position: 'relative',
      }}
    >
      <svg className="sd-hull-svg" viewBox="0 0 600 240"
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

        {/* Hover guide line — vertical rule at the hovered slot's bow-stern position */}
        {hoveredSlotId && (() => {
          const s = slots.find(sl => sl.id === hoveredSlotId)
          if (!s) return null
          const svgX = 24 + (s.y - 11) / 78 * 541
          return (
            <line x1={svgX} y1="76" x2={svgX} y2={BL}
              stroke="#7eeaa0" strokeWidth="0.8" opacity="0.55"
              strokeDasharray="4 3" />
          )
        })()}

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

        <HullSideViewInner shipType={shipType} />
      </svg>

      {/* Slot overlay — interactive markers at deck positions */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {slots.map(slot => {
          const weaponId      = design[slot.id]
          const weapon        = weaponId ? (WEAPON_BY_ID[weaponId] ?? null) : null
          const isDragTarget  = draggingWeapon !== null &&
            slot.compatibleTypes.includes(draggingWeapon.type as WeaponSlotType)
          const isBlocked     = isDragTarget &&
            wouldInterfere(slot, draggingWeapon!.type, slots, design, getType)
          const isHighlighted = slot.id === hoveredSlotId

          return (
            <SideSlotMarker
              key={slot.id}
              slot={slot}
              equippedWeapon={weapon}
              isDragTarget={isDragTarget && !isBlocked}
              isBlocked={isBlocked}
              isHighlighted={isHighlighted}
              leftPct={slotToLeftPct(slot.y)}
              topPct={TYPE_DECK_PCT[slot.type] ?? 44}
              onDrop={handleDrop}
              onRemove={() => onRemove?.(slot.id)}
              onMouseEnter={() => onSlotHover?.(slot.id)}
              onMouseLeave={() => onSlotHover?.(null)}
            />
          )
        })}
      </div>
    </div>
  )
}

function HullSideViewInner({ shipType }: { shipType: PlayerShipType }) {
  const hull = HULL_VIEWS[shipType]
  if (!hull) return null
  return <hull.SideView />
}


/* ── Side-view slot marker ───────────────────────────────────────────────── */
interface MarkerProps {
  slot: SlotDef
  equippedWeapon: { name: string; type: WeaponSlotType } | null
  isDragTarget: boolean
  isBlocked: boolean
  isHighlighted: boolean
  leftPct: number
  topPct: number
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function SideSlotMarker({
  slot, equippedWeapon, isDragTarget, isBlocked, isHighlighted,
  leftPct, topPct, onDrop, onRemove, onMouseEnter, onMouseLeave,
}: MarkerProps) {
  const [isOver, setIsOver] = useState(false)
  const color = TYPE_COLOR[slot.type]
  const filled = equippedWeapon !== null

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = isBlocked ? 'none' : 'copy'
    setIsOver(true)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    const wid = e.dataTransfer.getData('weaponId')
    if (wid) onDrop(slot.id, wid)
  }

  const active = isOver && isDragTarget
  const blocked = isOver && isBlocked

  let border = `1.5px solid ${color}${filled ? 'cc' : '44'}`
  let bg = filled ? `${color}20` : 'rgba(4,14,8,0.7)'
  let shadow = filled ? `0 0 8px ${color}80` : 'none'

  if (isHighlighted) { shadow = `0 0 14px ${color}cc, 0 0 6px ${color}88 inset`; border = `1.5px solid ${color}cc` }
  if (active)  { bg = `${color}35`; shadow = `0 0 16px ${color}ee` }
  if (blocked) { bg = '#ff000022'; shadow = '0 0 12px #ff4444aa'; border = '1.5px dashed #ff444488' }

  /* Stem line from marker to deck line */
  const deckPct = 46
  const stemHeight = Math.abs(topPct - deckPct)

  return (
    <div
      style={{
        position:     'absolute',
        left:         `${leftPct}%`,
        top:          `${topPct}%`,
        transform:    'translate(-50%, -50%)',
        pointerEvents: 'all',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Stem connecting to deck */}
      <div style={{
        position:  'absolute',
        left:      '50%',
        top:       topPct < deckPct ? '100%' : 'auto',
        bottom:    topPct >= deckPct ? '100%' : 'auto',
        transform: 'translateX(-50%)',
        width:     1,
        height:    `${stemHeight * 2.1}px`,
        background: `${color}44`,
      }} />

      {/* Marker box */}
      <div
        style={{
          width:      16,
          height:     16,
          border,
          borderRadius: 3,
          background:   bg,
          boxShadow:    shadow,
          cursor:       filled ? 'pointer' : 'default',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          transition:   'box-shadow 0.12s, background 0.12s',
          position:     'relative',
          zIndex:       1,
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        onClick={() => { if (filled) onRemove() }}
        title={
          blocked
            ? `${slot.label}: 他の兵装と干渉`
            : filled
              ? `${slot.label}: ${equippedWeapon!.name}（クリックで取り外し）`
              : `${slot.label}（空）`
        }
      >
        {filled
          ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
          : blocked
            ? <span style={{ fontSize: 9, color: '#ff6666', lineHeight: 1 }}>✕</span>
            : <span style={{ fontSize: 9, color: `${color}66`, lineHeight: 1 }}>+</span>
        }
      </div>

      {/* Weapon name label */}
      {filled && (
        <div style={{
          position:    'absolute',
          top:         '100%',
          left:        '50%',
          transform:   'translateX(-50%)',
          marginTop:   3,
          fontSize:    7,
          color:       color,
          whiteSpace:  'nowrap',
          fontFamily:  'monospace',
          opacity:     0.75,
          pointerEvents: 'none',
          textShadow:  '0 0 4px #000',
        }}>
          {slot.label}
        </div>
      )}
    </div>
  )
}
