import { useEffect, useMemo, useRef } from 'react'
import { ThreeShipDesignerRenderer, type ShipDesignerPreviewConfig } from '../game/rendering/three-ship-designer-renderer'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { Design } from './types'
import { WEAPON_BY_ID } from './data'

interface Props {
  hull: HullCatalogEntry
  design: Design
  armorBonus: number
  hoveredSlotId?: string | null
}

export function Ship3DPreview({ hull, design, armorBonus, hoveredSlotId }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<ThreeShipDesignerRenderer | null>(null)

  const config = useMemo<ShipDesignerPreviewConfig>(() => {
    const weapons = hull.slots.flatMap(slot => {
      const weaponId = design[slot.id]
      const weapon = weaponId ? WEAPON_BY_ID[weaponId] : undefined
      if (!weapon) return []
      return [{
        id: weapon.id,
        name: weapon.name,
        type: weapon.type,
        mount: { x: slot.x, y: slot.y },
        selected: hoveredSlotId === slot.id,
      }]
    })

    return {
      hull,
      weapons,
      towerMount: bridgeMountForHull(hull),
      armorBonus,
    }
  }, [armorBonus, design, hoveredSlotId, hull])

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

function bridgeMountForHull(hull: HullCatalogEntry): { x: number; y: number } {
  if (hull.shipType === 'destroyer') return { x: 0, y: -0.12 }
  if (hull.shipType === 'cruiser') return { x: 0, y: -0.04 }
  return { x: 0, y: -0.18 }
}
