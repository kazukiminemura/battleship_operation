import { useMemo } from 'react'
import { WEAPON_BY_ID } from './data'
import { ShipSlot } from './ShipSlot'
import { wouldInterfere } from './collision'
import { HULL_VIEWS } from './hulls'
import { G } from './hulls/colors'
import type { SlotDef, Design } from './types'
import type { PlayerShipType } from '../game/data/masterdata'

interface Props {
  slots: SlotDef[]
  design: Design
  draggingWeaponId: string | null
  scale?: number
  shipType?: PlayerShipType
  hoveredSlotId?: string | null
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: (slotId: string) => void
  onSlotHover?: (slotId: string | null) => void
}

export function HullView({ slots, design, draggingWeaponId, scale = 1, shipType = 'destroyer', hoveredSlotId, onDrop, onRemove, onSlotHover }: Props) {
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

        <HullTopView shipType={shipType} />
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
              isHighlighted={hoveredSlotId === slot.id}
              onDrop={handleDrop}
              onRemove={onRemove}
              onMouseEnter={() => onSlotHover?.(slot.id)}
              onMouseLeave={() => onSlotHover?.(null)}
            />
          )
        })}
      </div>
    </div>
  )
}

function HullTopView({ shipType }: { shipType: PlayerShipType }) {
  const hull = HULL_VIEWS[shipType]
  if (!hull) return null
  return <hull.TopView />
}

