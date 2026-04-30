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

const SLOT_SIZE: Record<WeaponSlotType, number> = {
  gun:       52,
  secondary: 44,
  torpedo:   48,
  aa:        36,
  missile:   44,
}

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
  isBlocked: boolean
  isHighlighted?: boolean
  scale?: number
  barrels?: number
  onDrop: (slotId: string, weaponId: string) => void
  onRemove: (slotId: string) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function ShipSlot({ slot, equippedWeapon, isDragTarget, isBlocked, isHighlighted, scale = 1, barrels = 1, onDrop, onRemove, onMouseEnter, onMouseLeave }: Props) {
  const [isOver, setIsOver] = useState(false)
  const color = TYPE_COLOR[slot.type]
  const markerScale = Math.max(0.85, scale)
  const size  = SLOT_SIZE[slot.type] * markerScale
  const wSize = WEAPON_SIZE[slot.type] * markerScale

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = isBlocked ? 'none' : 'copy'
    setIsOver(true)
  }
  const handleDragLeave = () => setIsOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    const weaponId = e.dataTransfer.getData('weaponId')
    if (weaponId) onDrop(slot.id, weaponId)  // HullView enforces the block
  }
  const handleClick = () => { if (equippedWeapon) onRemove(slot.id) }

  const filled    = equippedWeapon !== null
  const highlight = isOver && isDragTarget && !isBlocked
  const blocked   = isOver && isBlocked

  let border    = filled ? 'none' : `1px dashed ${color}55`
  let bg        = 'transparent'
  let shadow    = filled ? `0 0 10px ${color}70, 0 0 20px ${color}30` : 'none'
  let cursor    = filled ? 'pointer' : 'default'

  if (isHighlighted) {
    shadow = `0 0 16px ${color}cc, 0 0 32px ${color}66`
    border = `1px solid ${color}aa`
  }

  if (isBlocked && !filled) {
    border = '1px dashed #ff444466'
  }
  if (highlight) {
    bg     = color + '22'
    shadow = `0 0 14px ${color}99`
  }
  if (blocked) {
    bg     = '#ff000018'
    shadow = '0 0 14px #ff444488'
    cursor = 'not-allowed'
  }

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
        cursor,
        border,
        borderRadius: '50%',
        background: bg,
        boxShadow:  shadow,
        transition: 'box-shadow 0.12s, background 0.12s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={
        isBlocked
          ? `${slot.label}: 他の兵装と干渉しています`
          : filled
            ? `${slot.label}: ${equippedWeapon!.name}（クリックで取り外し）`
            : `${slot.label}（空）`
      }
    >
      {filled ? (
        <WeaponBlueprint type={equippedWeapon!.type} color={color} size={wSize} barrels={barrels} />
      ) : blocked ? (
        <span style={{ fontSize: 14 * markerScale, color: '#ff6666', fontWeight: 'bold', userSelect: 'none' }}>✕</span>
      ) : (
        <span style={{ fontSize: 11 * markerScale, color: color + '70', fontFamily: 'monospace', userSelect: 'none' }}>+</span>
      )}
    </div>
  )
}
