import { useEffect, useMemo, useRef } from 'react'
import { ThreeShipDesignerRenderer, type ShipDesignerPreviewConfig } from '../game/rendering/three-ship-designer-renderer'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { HLGDesign } from './hlg-system'
import { previewWeaponsFromHLG, towerMountFromHLG } from './hlg-system'

interface Props {
  hull: HullCatalogEntry
  design: HLGDesign
  armorBonus: number
}

export function Ship3DPreview({ hull, design, armorBonus }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<ThreeShipDesignerRenderer | null>(null)

  const config = useMemo<ShipDesignerPreviewConfig>(() => ({
    hull,
    weapons: previewWeaponsFromHLG(hull, design),
    towerMount: towerMountFromHLG(hull, design),
    armorBonus,
  }), [armorBonus, design, hull])

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
          <div className="sd-3d-preview-subtitle">{hull.name} / 自由配置反映</div>
        </div>
        <div className="sd-3d-preview-help">ドラッグで回転 / ホイールでズーム</div>
      </div>
      <div ref={hostRef} className="sd-3d-preview-stage" />
    </section>
  )
}
