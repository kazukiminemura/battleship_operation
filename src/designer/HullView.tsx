import { useMemo } from 'react'
import { WEAPON_BY_ID } from './data'
import { ShipSlot } from './ShipSlot'
import { wouldInterfere } from './collision'
import type { SlotDef, Design } from './types'

interface Props {
  slots: SlotDef[]
  design: Design
  draggingWeaponId: string | null
  scale?: number
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: (slotId: string) => void
}

export function HullView({ slots, design, draggingWeaponId, scale = 1, onDrop, onRemove }: Props) {
  const draggingWeapon = draggingWeaponId ? WEAPON_BY_ID[draggingWeaponId] ?? null : null

  const getType = (weaponId: string) => WEAPON_BY_ID[weaponId]?.type

  /** Slot IDs that would physically interfere with the weapon being dragged. */
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
    if (wouldInterfere(slot, weapon.type, slots, design, getType)) return   // physical block
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
          `linear-gradient(rgba(80,200,120,0.10) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(80,200,120,0.10) 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: `${gridPx}px ${gridPx}px`,
      }}
    >
      {/* Top-down hull silhouette — blueprint green monochrome */}
      <svg
        className="sd-hull-svg"
        viewBox="0 0 200 875"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <filter id="bp-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Main hull fill */}
        <path
          d="M100 15 C116 18,148 60,162 180 L163 600
             C158 720,132 800,100 855
             C68 800,42 720,37 600 L38 180
             C52 60,84 18,100 15 Z"
          fill="rgba(10,30,16,0.85)"
          stroke="#50c878"
          strokeWidth="2.2"
          filter="url(#bp-glow)"
        />
        {/* Inner waterline */}
        <path
          d="M100 28 C113 30,142 72,155 190 L156 590
             C151 705,127 788,100 840
             C73 788,49 705,44 590 L45 190
             C58 72,87 30,100 28 Z"
          fill="none" stroke="#50c878" strokeWidth="0.9" strokeDasharray="10 6" opacity="0.45"
        />
        <line x1="100" y1="15" x2="100" y2="855" stroke="#50c878" strokeWidth="0.8" opacity="0.30" strokeDasharray="6 4" />
        <line x1="100" y1="15" x2="100" y2="70" stroke="#7eeaa0" strokeWidth="2" opacity="0.7" />
        {[120, 230, 340, 450, 560, 660, 750].map(y => {
          const narrow = y > 660 ? (y - 660) * 0.14 : 0
          return <line key={y} x1={38 + narrow} y1={y} x2={162 - narrow} y2={y}
            stroke="#50c878" strokeWidth="0.8" opacity="0.28" />
        })}
        <rect x="80" y="230" width="40" height="70" rx="4"
          fill="rgba(10,30,16,0.9)" stroke="#50c878" strokeWidth="1.2" opacity="0.95" />
        <rect x="87" y="244" width="26" height="42" rx="3"
          fill="rgba(6,20,10,0.95)" stroke="#7eeaa0" strokeWidth="1" />
        <rect x="90" y="250" width="20" height="10" rx="1.5"
          fill="rgba(20,60,30,0.8)" stroke="#9effc0" strokeWidth="0.8" />
        <line x1="100" y1="250" x2="100" y2="260" stroke="#9effc0" strokeWidth="0.5" opacity="0.6" />
        <line x1="100" y1="225" x2="100" y2="315" stroke="#7eeaa0" strokeWidth="1.5" opacity="0.6" />
        <line x1="88"  y1="248" x2="112" y2="248" stroke="#7eeaa0" strokeWidth="0.8" opacity="0.4" />
        <rect x="82" y="370" width="36" height="60" rx="4"
          fill="rgba(10,30,16,0.9)" stroke="#50c878" strokeWidth="1.1" opacity="0.85" />
        <ellipse cx="100" cy="452" rx="13" ry="8"
          fill="rgba(6,18,10,0.9)" stroke="#50c878" strokeWidth="1.1" />
        <ellipse cx="100" cy="452" rx="7" ry="4.5"
          fill="rgba(4,14,8,0.95)" stroke="#7eeaa0" strokeWidth="0.7" opacity="0.6" />
        <rect x="85" y="548" width="30" height="36" rx="3"
          fill="rgba(10,30,16,0.85)" stroke="#50c878" strokeWidth="1" opacity="0.65" />
        <line x1="86" y1="820" x2="80" y2="848" stroke="#50c878" strokeWidth="1.5" opacity="0.5" />
        <line x1="114" y1="820" x2="120" y2="848" stroke="#50c878" strokeWidth="1.5" opacity="0.5" />
        <ellipse cx="79" cy="851" rx="5" ry="3" fill="none" stroke="#50c878" strokeWidth="1" opacity="0.5" />
        <ellipse cx="121" cy="851" rx="5" ry="3" fill="none" stroke="#50c878" strokeWidth="1" opacity="0.5" />
        {[180, 280, 380, 480, 580].map((y, i) => (
          <g key={i} opacity="0.25">
            <line x1="38" y1={y} x2="44" y2={y} stroke="#50c878" strokeWidth="0.8" />
            <line x1="156" y1={y} x2="162" y2={y} stroke="#50c878" strokeWidth="0.8" />
          </g>
        ))}
      </svg>

      {/* Weapon slots overlay */}
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
