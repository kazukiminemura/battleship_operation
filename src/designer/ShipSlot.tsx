import { useState } from 'react'
import type { SlotDef, Weapon, WeaponSlotType } from './types'
import { WeaponBlueprint } from './WeaponBlueprint'

const TYPE_COLOR: Record<WeaponSlotType, string> = {
  gun:       '#d4c84a',
  secondary: '#a8d458',
  torpedo:   '#4adac8',
  aa:        '#58d8a0',
  missile:   '#a0c8e8',
}

/** Hit-target size when empty; weapon SVG renders larger when filled. */
const SLOT_SIZE: Record<WeaponSlotType, number> = {
  gun:       52,
  secondary: 44,
  torpedo:   48,
  aa:        36,
  missile:   44,
}

/** Blueprint SVG render size (slightly larger than hit area). */
const WEAPON_SIZE: Record<WeaponSlotType, number> = {
  gun:       62,
  secondary: 52,
  torpedo:   56,
  aa:        42,
  missile:   52,
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
  const wSize = WEAPON_SIZE[slot.type]

  const handleDragOver = (e: React.DragEvent) => {
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
  const handleClick = () => { if (equippedWeapon) onRemove(slot.id) }

  const filled    = equippedWeapon !== null
  const highlight = isOver && isDragTarget

  return (
    <div
      style={{
        position:  'absolute',
        left:      `${slot.x}%`,
        top:       `${slot.y}%`,
        width:     size,
        height:    size,
        marginLeft: -(size / 2),
        marginTop:  -(size / 2),
        display:   'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor:    filled ? 'pointer' : 'default',
        /* filled slots: no box, just glow; empty: dashed ring */
        border:    filled ? 'none' : `1px dashed ${color}55`,
        borderRadius: '50%',
        background: filled
          ? 'transparent'
          : highlight
            ? color + '22'
            : 'transparent',
        boxShadow: highlight
          ? `0 0 14px ${color}99`
          : filled
            ? `0 0 10px ${color}70, 0 0 20px ${color}30`
            : 'none',
        transition: 'box-shadow 0.15s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      title={filled
        ? `${slot.label}: ${equippedWeapon!.name}（クリックで取り外し）`
        : `${slot.label}（空）`}
    >
      {filled ? (
        <WeaponBlueprint type={equippedWeapon!.type} color={color} size={wSize} />
      ) : (
        <span style={{
          fontSize: 11,
          color: color + '70',
          fontFamily: 'monospace',
          userSelect: 'none',
        }}>+</span>
      )}
    </div>
  )
}
