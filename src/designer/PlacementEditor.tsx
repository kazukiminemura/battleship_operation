import { useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { ShopWeapon } from '../game/data/weapon-shop'
import {
  buildPlacements,
  canMoveSlotTo,
  canMoveTowerTo,
  cellKey,
  collidingIds,
  footprintRect,
  gridSpec,
  isInsideHullCell,
  moveTargetState,
  occupiedCells,
  type GridCell,
  type Placement,
} from '../game/ui/prep-layout'
import { designBarrels, designWeaponId, WEAPONS, WEAPON_BY_ID } from './data'
import type { Design } from './types'

type Selection = { kind: 'weapon'; slotId: string } | { kind: 'tower' } | null
type DragState = {
  selection: Exclude<Selection, null>
  pointerId: number
  cell: GridCell | null
  valid: boolean
  moved: boolean
}

interface Props {
  hull: HullCatalogEntry
  design: Design
  slotCells: Record<string, GridCell>
  towerCell: GridCell | null
  selected: Selection
  onSelect: (selection: Selection) => void
  onMoveSlot: (slotId: string, cell: GridCell) => void
  onMoveTower: (cell: GridCell) => void
  onSlotHover?: (slotId: string | null) => void
}

export function PlacementEditor({
  hull,
  design,
  slotCells,
  towerCell,
  selected,
  onSelect,
  onMoveSlot,
  onMoveTower,
  onSlotHover,
}: Props) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const suppressClickRef = useRef(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const spec = useMemo(() => gridSpec(hull), [hull])
  const slotCellMap = useMemo(() => new Map(Object.entries(slotCells)), [slotCells])
  const slotWeapons = useMemo(() => {
    const map = new Map<string, ShopWeapon>()
    for (const slot of hull.slots) {
      const weaponId = designWeaponId(design[slot.id])
      if (!weaponId) continue
      const weapon = WEAPON_BY_ID[weaponId]
      if (!weapon) continue
      map.set(slot.id, {
        id: weapon.id,
        name: weapon.name,
        type: weapon.type,
        ammo: 0,
        desc: '',
        cost: 0,
        minStage: 1,
      })
    }
    return map
  }, [design, hull])
  const placements = useMemo(
    () => buildPlacements(hull, spec, slotWeapons, slotCellMap, towerCell),
    [hull, spec, slotWeapons, slotCellMap, towerCell],
  )
  const occupied = useMemo(() => occupiedCells(placements), [placements])
  const colliding = useMemo(() => collidingIds(placements), [placements])
  const selectedSlotId = selected?.kind === 'weapon' ? selected.slotId : null
  const selectedTower = selected?.kind === 'tower'
  const dragPlacement = drag ? placementForSelection(drag.selection, placements) : null
  const dragFootprintRect = drag?.cell && dragPlacement ? footprintRect(drag.cell, dragPlacement.footprint) : null

  const handleCellClick = (c: number, r: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (selectedTower) {
      if (canMoveTowerTo(c, r, hull, placements, spec)) onMoveTower({ c, r })
      return
    }
    if (!selectedSlotId) return
    const slot = hull.slots.find(s => s.id === selectedSlotId)
    if (slot && canMoveSlotTo(slot, c, r, hull, placements, spec)) onMoveSlot(slot.id, { c, r })
  }

  const targetStateForSelection = (selection: Exclude<Selection, null>, cell: GridCell): boolean => {
    if (selection.kind === 'tower') return canMoveTowerTo(cell.c, cell.r, hull, placements, spec)
    const slot = hull.slots.find(s => s.id === selection.slotId)
    return !!slot && canMoveSlotTo(slot, cell.c, cell.r, hull, placements, spec)
  }

  const cellFromPointer = (clientX: number, clientY: number): GridCell | null => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const c = Math.floor(((clientX - rect.left) / Math.max(1, rect.width)) * spec.cols)
    const r = Math.floor(((clientY - rect.top) / Math.max(1, rect.height)) * spec.rows)
    if (c < 0 || c >= spec.cols || r < 0 || r >= spec.rows) return null
    if (!isInsideHullCell(c, r, spec)) return null
    return { c, r }
  }

  const beginDrag = (selection: Exclude<Selection, null>, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    onSelect(selection)
    const cell = cellFromPointer(e.clientX, e.clientY)
    setDrag({
      selection,
      pointerId: e.pointerId,
      cell,
      valid: cell ? targetStateForSelection(selection, cell) : false,
      moved: false,
    })
  }

  const updateDrag = (e: PointerEvent<HTMLElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return
    const cell = cellFromPointer(e.clientX, e.clientY)
    setDrag(prev => {
      if (!prev) return prev
      const moved = prev.moved || !sameCell(prev.cell, cell)
      return {
        ...prev,
        cell,
        valid: cell ? targetStateForSelection(prev.selection, cell) : false,
        moved,
      }
    })
  }

  const finishDrag = (e: PointerEvent<HTMLElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return
    if (drag.moved) suppressClickRef.current = true
    if (drag.cell && drag.valid) {
      if (drag.selection.kind === 'tower') onMoveTower(drag.cell)
      else onMoveSlot(drag.selection.slotId, drag.cell)
    }
    setDrag(null)
  }

  const cells = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      if (!isInsideHullCell(c, r, spec)) continue
      const target = selected ? moveTargetState(hull, c, r, placements, spec, { slotId: selectedSlotId, tower: selectedTower }) : 'none'
      const isOccupied = occupied.has(cellKey(c, r))
      cells.push(
        <button
          key={`${c}:${r}`}
          type="button"
          className={`sd-placement-cell sd-placement-cell--${target}${isOccupied ? ' sd-placement-cell--occupied' : ''}${drag?.cell?.c === c && drag.cell.r === r ? ` sd-placement-cell--drag-${drag.valid ? 'valid' : 'invalid'}` : ''}`}
          style={{ gridColumn: c + 1, gridRow: r + 1 }}
          onClick={() => handleCellClick(c, r)}
          aria-label={`配置セル ${c},${r}`}
        />,
      )
    }
  }

  return (
    <section className="sd-placement-editor">
      <div className="sd-placement-header">
        <div>
          <div className="sd-placement-title">配置編集</div>
          <div className="sd-placement-subtitle">{selectedLabel(selected, placements)}</div>
        </div>
        <button type="button" className="sd-placement-tower-btn" onClick={() => onSelect(selectedTower ? null : { kind: 'tower' })}>
          艦橋
        </button>
      </div>
      <div
        ref={gridRef}
        className="sd-placement-grid"
        style={{
          gridTemplateColumns: `repeat(${spec.cols}, 1fr)`,
          gridTemplateRows: `repeat(${spec.rows}, 1fr)`,
          aspectRatio: `${spec.cols} / ${spec.rows}`,
        }}
      >
        {cells}
        <div className="sd-placement-centerline" style={{ left: `${((spec.centerC + 0.5) / spec.cols) * 100}%` }} />
        {dragFootprintRect && dragPlacement && (
          <div
            className={`sd-placement-drag-footprint sd-placement-drag-footprint--${drag?.valid ? 'valid' : 'invalid'}`}
            style={{
              left: `${(dragFootprintRect.left / spec.cols) * 100}%`,
              top: `${(dragFootprintRect.top / spec.rows) * 100}%`,
              width: `${(dragFootprintRect.w / spec.cols) * 100}%`,
              height: `${(dragFootprintRect.h / spec.rows) * 100}%`,
              borderColor: drag?.valid ? dragPlacement.color : '#ef4444',
            }}
          >
            <span>{dragPlacement.footprint.w}x{dragPlacement.footprint.h}</span>
          </div>
        )}
        {placements.map(placement => (
          <PlacementItem
            key={placement.id}
            placement={placement}
            cols={spec.cols}
            rows={spec.rows}
            selected={placement.kind === 'tower' ? selectedTower : selectedSlotId === placement.id}
            colliding={colliding.has(placement.id)}
            barrels={placement.kind === 'weapon' ? designBarrels(design[placement.id], WEAPONS.find(w => w.id === designWeaponId(design[placement.id]))) : undefined}
            onSelect={() => onSelect(placement.kind === 'tower' ? { kind: 'tower' } : { kind: 'weapon', slotId: placement.id })}
            onPointerDown={(e) => beginDrag(placement.kind === 'tower' ? { kind: 'tower' } : { kind: 'weapon', slotId: placement.id }, e)}
            onPointerMove={updateDrag}
            onPointerUp={finishDrag}
            onPointerCancel={() => setDrag(null)}
            onMouseEnter={() => {
              if (placement.kind === 'weapon') onSlotHover?.(placement.id)
            }}
            onMouseLeave={() => {
              if (placement.kind === 'weapon') onSlotHover?.(null)
            }}
          />
        ))}
      </div>
    </section>
  )
}

function PlacementItem({
  placement,
  cols,
  rows,
  selected,
  colliding,
  barrels,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onMouseEnter,
  onMouseLeave,
}: {
  placement: Placement
  cols: number
  rows: number
  selected: boolean
  colliding: boolean
  barrels?: number
  onSelect: () => void
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: (e: PointerEvent<HTMLElement>) => void
  onPointerCancel: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const rect = footprintRect(placement.cell, placement.footprint)
  return (
    <button
      type="button"
      className={`sd-placement-item sd-placement-item--${placement.kind}${selected ? ' sd-placement-item--selected' : ''}${colliding ? ' sd-placement-item--colliding' : ''}`}
      style={{
        left: `${(rect.left / cols) * 100}%`,
        top: `${(rect.top / rows) * 100}%`,
        width: `${(rect.w / cols) * 100}%`,
        height: `${(rect.h / rows) * 100}%`,
        borderColor: placement.color,
        color: placement.color,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={placement.label}
    >
      <span>{placement.kind === 'tower' ? '艦橋' : placement.label}</span>
      {barrels ? <small>{barrels}連</small> : null}
    </button>
  )
}

function sameCell(a: GridCell | null, b: GridCell | null): boolean {
  if (!a || !b) return a === b
  return a.c === b.c && a.r === b.r
}

function placementForSelection(selection: Exclude<Selection, null>, placements: Placement[]): Placement | null {
  if (selection.kind === 'tower') return placements.find(placement => placement.kind === 'tower') ?? null
  return placements.find(placement => placement.kind === 'weapon' && placement.id === selection.slotId) ?? null
}

function selectedLabel(selected: Selection, placements: Placement[]): string {
  if (!selected) return '兵装または艦橋をクリックして、移動先セルを選択'
  if (selected.kind === 'tower') return '艦橋を選択中'
  const placement = placements.find(p => p.id === selected.slotId)
  return `${placement?.label ?? selected.slotId} を選択中`
}
