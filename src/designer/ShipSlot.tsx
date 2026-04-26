import { useState } from 'react'
import type { SlotDef, Weapon, WeaponSlotType } from './types'

const TYPE_COLOR: Record<WeaponSlotType, string> = {
  main: '#f97316',
  secondary: '#38bdf8',
  aa: '#4ade80',
}

const SLOT_SIZE: Record<WeaponSlotType, number> = {
  main: 52,
  secondary: 42,
  aa: 34,
}

interface Props {
  slot: SlotDef
  equippedWeapon: Weapon | null
  isDragTarget: boolean
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: (slotId: string) => void
}

export function ShipSlot({ slot, equippedWeapon, isDragTarget, onDrop, onRemove }: Props) {
  const [isOver, setIsOver] = useState(false)
  const color = TYPE_COLOR[slot.type]
  const size  = SLOT_SIZE[slot.type]

  const handleDragOver = (e: React.DragEvent) => {
    // Only accept drops of matching type: check via data is not possible in dragover,
    // so we always allow and validate on drop
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsOver(true)
  }

  const handleDragLeave = () => setIsOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    const weaponId = e.dataTransfer.getData('weaponId')
    if (weaponId) onDrop(slot.id, weaponId)
  }

  const handleClick = () => {
    if (equippedWeapon) onRemove(slot.id)
  }

  const filled = equippedWeapon !== null
  const highlight = isOver && isDragTarget

  return (
    <div
      className={[
        'sd-slot',
        `sd-slot--${slot.type}`,
        filled   ? 'sd-slot--filled' : '',
        highlight ? 'sd-slot--hover'  : '',
      ].join(' ')}
      style={{
        position: 'absolute',
        left:   `${slot.x}%`,
        top:    `${slot.y}%`,
        width:  size,
        height: size,
        marginLeft: -(size / 2),
        marginTop:  -(size / 2),
        borderColor: filled ? color : color + '70',
        background:  filled ? color + '28' : 'rgba(6,13,8,0.65)',
        boxShadow:   highlight ? `0 0 12px ${color}` : filled ? `0 0 6px ${color}60` : 'none',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      title={filled ? `${slot.label}: ${equippedWeapon!.name}（クリックで取り外し）` : `${slot.label}（空）`}
    >
      {filled ? (
        <div className="sd-slot-content">
          <div className="sd-slot-icon" style={{ color }}>●</div>
          <div className="sd-slot-name">{equippedWeapon!.name.slice(0, 4)}</div>
        </div>
      ) : (
        <div className="sd-slot-empty" style={{ color: color + '90' }}>
          +
        </div>
      )}
      <div className="sd-slot-label">{slot.label}</div>
    </div>
  )
}
