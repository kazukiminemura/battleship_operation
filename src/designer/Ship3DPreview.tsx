import { useEffect, useMemo, useRef } from 'react'
import { ThreeShipDesignerRenderer, type ShipDesignerPreviewConfig } from '../game/rendering/three-ship-designer-renderer'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { Design } from './types'
import { designBarrels, designTowerMount, designWeaponId, WEAPON_BY_ID } from './data'
import { cellToMount, currentSlotCell, gridSpec, type GridCell } from '../game/ui/prep-layout'

interface Props {
  hull: HullCatalogEntry
  design: Design
  armorBonus: number
  slotCells?: Record<string, GridCell>
  towerCell?: GridCell | null
  hoveredSlotId?: string | null
}

export function Ship3DPreview({ hull, design, armorBonus, slotCells = {}, towerCell = null, hoveredSlotId }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<ThreeShipDesignerRenderer | null>(null)

  const config = useMemo<ShipDesignerPreviewConfig>(() => {
    const spec = gridSpec(hull)
    const cells = new Map(Object.entries(slotCells))
    const weapons = hull.slots.flatMap(slot => {
      const entry = design[slot.id]
      const weaponId = designWeaponId(entry)
      const weapon = weaponId ? WEAPON_BY_ID[weaponId] : undefined
      if (!weapon) return []
      const cell = currentSlotCell(slot, spec, cells)
      return [{
        id: weapon.id,
        name: weapon.name,
        type: weapon.type,
        mount: cellToMount(cell.c, cell.r, spec),
        barrels: designBarrels(entry, weapon),
        selected: hoveredSlotId === slot.id,
      }]
    })

    return {
      hull,
      weapons,
      towerMount: designTowerMount(hull, towerCell),
      armorBonus,
    }
  }, [armorBonus, design, hoveredSlotId, hull, slotCells, towerCell])

  useEffect(() => {
    const renderer = new ThreeShipDesignerRenderer()
    rendererRef.current = renderer

    let frame = 0
    const renderLoop = () => {
      const host = hostRef.current
      if (host) renderer.setViewportFromElement(host)
      renderer.update()
      frame = window.requestAnimationFrame(renderLoop)
    }
    frame = window.requestAnimationFrame(renderLoop)

    return () => {
      window.cancelAnimationFrame(frame)
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    const renderer = rendererRef.current
    if (!host || !renderer) return
    renderer.setViewportFromElement(host)
    renderer.show(config)
  }, [config])

  return (
    <section className="sd-3d-preview">
      <div className="sd-3d-preview-header">
        <div>
          <div className="sd-3d-preview-title">3D艦船プレビュー</div>
          <div className="sd-3d-preview-subtitle">{hull.name} / {hull.className}</div>
        </div>
        <div className="sd-3d-preview-help">ドラッグで回転 / ホイールでズーム</div>
      </div>
      <div ref={hostRef} className="sd-3d-preview-stage" />
    </section>
  )
}
