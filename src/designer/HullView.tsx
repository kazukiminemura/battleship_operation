import { WEAPON_BY_ID } from './data'
import { ShipSlot } from './ShipSlot'
import type { SlotDef, Design } from './types'

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
    if (!slot.compatibleTypes.includes(weapon.type)) return
    onDrop(slotId, weaponId)
  }

  return (
    <div className="sd-hull-wrapper">
      {/* SVG battleship silhouette — viewBox 200×875, rendered 160×700px → ~6.7:1 ratio */}
      <svg
        className="sd-hull-svg"
        viewBox="0 0 200 875"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Main hull */}
        <path
          d="M100 15
             C116 18,148 60,162 180
             L163 600
             C158 720,132 800,100 855
             C68 800,42 720,37 600
             L38 180
             C52 60,84 18,100 15 Z"
          fill="#0f1e12"
          stroke="#2a5030"
          strokeWidth="2"
        />
        {/* Deck plating (inset dashed outline) */}
        <path
          d="M100 28
             C113 30,142 72,155 190
             L156 590
             C151 705,127 788,100 840
             C73 788,49 705,44 590
             L45 190
             C58 72,87 30,100 28 Z"
          fill="none"
          stroke="#1e3a22"
          strokeWidth="1"
          strokeDasharray="8 5"
          opacity="0.5"
        />
        {/* Bow accent */}
        <line x1="100" y1="15" x2="100" y2="80" stroke="#2a6030" strokeWidth="1.5" opacity="0.5" />
        {/* Keel line */}
        <line x1="100" y1="80" x2="100" y2="800" stroke="#2a5030" strokeWidth="1" opacity="0.35" />
        {/* Forward superstructure */}
        <rect x="82" y="235" width="36" height="65" rx="3" fill="#121f14" stroke="#2a6030" strokeWidth="1" opacity="0.9" />
        {/* Bridge */}
        <rect x="88" y="248" width="24" height="38" rx="2" fill="#0e1a10" stroke="#3a7040" strokeWidth="1" />
        {/* Bridge windows */}
        <rect x="91" y="252" width="18" height="10" rx="1" fill="#1a3020" stroke="#3a8040" strokeWidth="0.8" />
        {/* Foremast */}
        <line x1="100" y1="230" x2="100" y2="310" stroke="#3a7040" strokeWidth="1.5" opacity="0.7" />
        {/* Aft superstructure */}
        <rect x="84" y="375" width="32" height="55" rx="3" fill="#121f14" stroke="#2a5030" strokeWidth="1" opacity="0.8" />
        {/* Funnel */}
        <ellipse cx="100" cy="450" rx="11" ry="7" fill="#111a12" stroke="#2a5030" strokeWidth="1" />
        {/* Stern structure */}
        <rect x="86" y="550" width="28" height="32" rx="2" fill="#121f14" stroke="#2a5030" strokeWidth="1" opacity="0.6" />
        {/* Frame lines */}
        {[100, 200, 300, 400, 500, 620, 720].map(y => {
          const narrow = y > 620 ? (y - 620) * 0.12 : 0
          return (
            <line
              key={y}
              x1={40 + narrow} y1={y}
              x2={160 - narrow} y2={y}
              stroke="#1e3a22"
              strokeWidth="0.8"
              opacity="0.35"
            />
          )
        })}
      </svg>

      {/* Weapon slots overlay */}
      <div className="sd-slots-overlay">
        {slots.map(slot => {
          const weaponId = design[slot.id]
          const weapon   = weaponId ? (WEAPON_BY_ID[weaponId] ?? null) : null
          const isDragTarget = draggingWeapon !== null && slot.compatibleTypes.includes(draggingWeapon.type)
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
