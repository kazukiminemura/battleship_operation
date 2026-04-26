import { WEAPONS } from './data'
import type { Weapon, WeaponSlotType } from './types'
import type { HullCatalogEntry } from '../game/data/hull-catalog'

const TYPE_LABEL: Record<WeaponSlotType, string> = {
  gun:       '主砲',
  secondary: '副砲',
  torpedo:   '魚雷',
  aa:        '対空',
  missile:   'ミサイル',
}

const TYPE_COLOR: Record<WeaponSlotType, string> = {
  gun:       '#f97316',
  secondary: '#38bdf8',
  torpedo:   '#06b6d4',
  aa:        '#4ade80',
  missile:   '#a78bfa',
}

interface Props {
  hull: HullCatalogEntry
  onDragStart: (weaponId: string) => void
  onDragEnd: () => void
}

export function WeaponPalette({ hull, onDragStart, onDragEnd }: Props) {
  const allowedTypes = new Set(hull.slots.flatMap(s => s.compatibleTypes) as WeaponSlotType[])

  const groups = (Object.keys(TYPE_LABEL) as WeaponSlotType[])
    .filter(type => allowedTypes.has(type))
    .map(type => ({ type, weapons: WEAPONS.filter(w => w.type === type) }))
    .filter(g => g.weapons.length > 0)

  return (
    <div className="sd-palette">
      <h2 className="sd-palette-title">兵装パレット</h2>
      {groups.map(({ type, weapons }) => (
        <div key={type} className="sd-palette-group">
          <div className="sd-palette-group-label" style={{ color: TYPE_COLOR[type] }}>
            {TYPE_LABEL[type]}
          </div>
          {weapons.map(weapon => (
            <WeaponCard
              key={weapon.id}
              weapon={weapon}
              color={TYPE_COLOR[type]}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function WeaponCard({ weapon, color, onDragStart, onDragEnd }: {
  weapon: Weapon; color: string
  onDragStart: (id: string) => void; onDragEnd: () => void
}) {
  return (
    <div
      className="sd-weapon-card"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('weaponId', weapon.id)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStart(weapon.id)
      }}
      onDragEnd={onDragEnd}
      style={{ borderColor: color + '60' }}
      title="ドラッグしてスロットに配置"
    >
      <div className="sd-weapon-card-badge" style={{ background: color + '30', color }}>
        {TYPE_LABEL[weapon.type]}
      </div>
      <div className="sd-weapon-card-name">{weapon.name}</div>
      <div className="sd-weapon-card-stats">
        <span>重量 {weapon.weight.toLocaleString()}t</span>
        {weapon.firepower != null && <span>火力 {weapon.firepower}</span>}
        {weapon.antiAir   != null && <span>対空 {weapon.antiAir}</span>}
        <span>装填 {weapon.reload}s</span>
        <span>命中 {(weapon.accuracy * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}
