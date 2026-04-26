import { WEAPON_BY_ID } from './data'
import { ShipSlot } from './ShipSlot'
import type { SlotDef, Design, WeaponSlotType } from './types'

// Compatible weapon types per slot type (cached for isDragTarget check)
const COMPATIBLE: Record<WeaponSlotType, WeaponSlotType[]> = {
  main: ['main'],
  secondary: ['secondary'],
  aa: ['aa'],
}

interface Props {
  slots: SlotDef[]
  design: Design
  draggingWeaponId: string | null
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: (slotId: string) => void
}

export function HullView({ slots, design, draggingWeaponId, onDrop, onRemove }: Props) {
  const draggingWeapon = draggingWeaponId ? WEAPON_BY_ID[draggingWeaponId] ?? null : null

  const handleDrop = (slotId: string, weaponId: string) => {
    const slot   = slots.find(s => s.id === slotId)
    const weapon = WEAPON_BY_ID[weaponId]
    if (!slot || !weapon) return
    if (!COMPATIBLE[slot.type].includes(weapon.type)) return
    onDrop(slotId, weaponId)
  }

  return (
    <div className="sd-hull-wrapper">
      {/* SVG battleship silhouette */}
      <svg
        className="sd-hull-svg"
        viewBox="0 0 200 400"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Main hull */}
        <path
          d="M100 8
             L118 22 L135 55 L143 120 L146 200
             L143 280 L135 345 L115 378 L100 388
             L85 378  L65 345  L57 280  L54 200
             L57 120  L65 55   L82 22   Z"
          fill="#0f1e12"
          stroke="#2a5030"
          strokeWidth="2"
        />
        {/* Deck plating */}
        <path
          d="M100 20
             L115 32 L128 60 L136 120 L138 200
             L136 275 L128 338 L112 372 L100 380
             L88 372  L72 338  L64 275  L62 200
             L64 120  L72 60   L85 32   Z"
          fill="none"
          stroke="#1e3a22"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.6"
        />
        {/* Bow accent */}
        <line x1="100" y1="8" x2="100" y2="55" stroke="#2a6030" strokeWidth="1.5" opacity="0.5" />
        {/* Keel line */}
        <line x1="100" y1="55" x2="100" y2="345" stroke="#2a5030" strokeWidth="1" opacity="0.4" />
        {/* Midship structure */}
        <rect x="82" y="150" width="36" height="50" rx="3" fill="#121f14" stroke="#2a6030" strokeWidth="1" opacity="0.8" />
        {/* Bridge tower */}
        <rect x="88" y="160" width="24" height="30" rx="2" fill="#0e1a10" stroke="#3a7040" strokeWidth="1" />
        <rect x="92" y="162" width="16" height="12" rx="1" fill="#1a3020" stroke="#3a8040" strokeWidth="1" />
        {/* Funnel */}
        <ellipse cx="100" cy="215" rx="8" ry="5" fill="#111a12" stroke="#2a5030" strokeWidth="1" />
        {/* Stern structure */}
        <rect x="88" y="280" width="24" height="18" rx="2" fill="#121f14" stroke="#2a5030" strokeWidth="1" opacity="0.6" />
        {/* Frame lines */}
        {[80, 120, 160, 240, 300].map(y => (
          <line
            key={y}
            x1={58 + (y > 200 ? (y - 200) * 0.06 : 0)}
            y1={y}
            x2={142 - (y > 200 ? (y - 200) * 0.06 : 0)}
            y2={y}
            stroke="#1e3a22"
            strokeWidth="0.8"
            opacity="0.4"
          />
        ))}
      </svg>

      {/* Weapon slots overlay */}
      <div className="sd-slots-overlay">
        {slots.map(slot => {
          const weaponId = design[slot.id]
          const weapon   = weaponId ? (WEAPON_BY_ID[weaponId] ?? null) : null
          const isDragTarget = draggingWeapon !== null && draggingWeapon.type === slot.type
          return (
            <ShipSlot
              key={slot.id}
              slot={slot}
              equippedWeapon={weapon}
              isDragTarget={isDragTarget}
              onDrop={handleDrop}
              onRemove={onRemove}
            />
          )
        })}
      </div>
    </div>
  )
}
