import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { sideDragCell, sideDragHeight, type ComponentMovePreview } from './design-preview'
import { PartElevation } from './PartDrawing'
import { normalizedMountHeight, DESIGN_CELL_METERS } from '../game/data/gun-mount-geometry'
import { componentGunGeometry } from './gun-clearance'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { HLG_PART_BY_ID, hlgGridSpec, rotateFootprint, type HLGDesign, type HLGCell, type HLGComponentInstance } from './hlg-system'
import { designerLayerForPart } from './design-placement'

export { PartSymbol } from './PartDrawing'

/** A longitudinal projection of the same component cells edited in the plan. */
export function ShipBlueprint({ hull, design, selectedId, onSelect, onMovePreview, onMove }: {
  hull: HullCatalogEntry; design: HLGDesign; selectedId: string | null; onSelect: (id: string) => void
  onMovePreview?: (preview: ComponentMovePreview | null) => void
  onMove?: (id: string, cell: HLGCell, mountHeight?: number) => boolean
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ id: string; x: number; y: number; origin: HLGCell; cell: HLGCell; originHeight?: number; mountHeight?: number; axis?: 'horizontal' | 'vertical' } | null>(null)
  const spec = hlgGridSpec(hull)
  const cancelMove = () => { dragRef.current = null; onMovePreview?.(null) }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelMove() }
    window.addEventListener('blur', cancelMove)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('blur', cancelMove); window.removeEventListener('keydown', onKey) }
  }, [onMovePreview])
  const beginMove = (event: ReactPointerEvent<SVGGElement>, component: HLGComponentInstance) => {
    if (event.button !== 0 || !onMove) return
    event.preventDefault()
    onSelect(component.instanceId)
    const originHeight = componentGunGeometry(HLG_PART_BY_ID[component.partId]!) ? normalizedMountHeight(component.mountHeight) : undefined
    dragRef.current = { id: component.instanceId, x: event.clientX, y: event.clientY, origin: { ...component.cell }, cell: { ...component.cell }, originHeight, mountHeight: originHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const updateMove = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current, rect = svgRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    if (!drag.axis && Math.max(Math.abs(dx), Math.abs(dy)) < 4) return
    drag.axis ??= drag.originHeight !== undefined && Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal'
    if (drag.axis === 'vertical') drag.mountHeight = sideDragHeight(drag.originHeight!, dy, rect.width, rect.height)
    else drag.cell = sideDragCell(drag.origin, dx, rect.width, rect.height, spec.rows)
    onMovePreview?.({ instanceId: drag.id, cell: drag.cell, mountHeight: drag.mountHeight })
  }
  const finishMove = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.cell.r !== drag.origin.r || drag.mountHeight !== drag.originHeight) onMove?.(drag.id, drag.cell, drag.mountHeight)
    onMovePreview?.(null)
  }
  const xAt = (row: number) => row / spec.rows * 1000
  const bow = xAt(spec.topR), stern = xAt(spec.topR + spec.lengthCells)
  return <section className="sd-blueprint" aria-label="艦船側面図">
    <div className="sd-drawing-caption"><span>SIDE ELEVATION / 側面図</span><span>砲塔を上下ドラッグで高さ調整 · ← 艦首　艦尾 →</span></div>
    <svg ref={svgRef} viewBox="0 0 1000 175" role="group" aria-label={`${hull.name}の側面配置図`}>
      <path d={`M${bow} 113 Q${bow + 18} 145 ${bow + 65} 146 L${stern - 16} 146 L${stern} 118 L${stern} 106 L${bow} 106Z`} fill="rgba(160,210,217,.04)" stroke="#b3c8c6" strokeWidth="1.2" />
      <path d={`M${bow + 5} 119 H${stern - 5}M${bow + 50} 139H${stern - 20}`} stroke="#638c90" strokeDasharray="5 4" fill="none" />
      {design.components.map(component => {
        const part = HLG_PART_BY_ID[component.partId]
        if (!part) return null
        const footprint = rotateFootprint(part.footprint, component.rotation)
        const x = xAt(component.cell.r + .5), width = Math.max(5, footprint.h / spec.rows * 1000)
        const internal = designerLayerForPart(part) === 'internal'
        const geometry = componentGunGeometry(part)
        const mountHeight = geometry ? normalizedMountHeight(component.mountHeight) : 0
        const height = geometry ? geometry.bodyHeight * 5 : internal ? 27 : part.category === 'bridge' ? (/dd/.test(part.partId) ? 38 : /ca/.test(part.partId) ? 50 : 64) : part.category === 'funnel' ? 43 : part.category === 'weapon' ? 16 : 24
        const y = internal ? 112 : 106 - height - mountHeight * 5
        const selected = component.instanceId === selectedId
        const direction = -Math.cos(component.rotation * Math.PI / 180)
        const units = 1000 / (spec.rows * DESIGN_CELL_METERS)
        return <g key={component.instanceId} className="sd-blueprint-part" data-selected={selected} tabIndex={0} role="button" aria-label={`${part.name}を選択`} onClick={() => onSelect(component.instanceId)} onPointerDown={event => beginMove(event, component)} onPointerMove={updateMove} onPointerUp={finishMove} onPointerCancel={cancelMove} onLostPointerCapture={cancelMove} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(component.instanceId) } }}
          stroke={selected ? '#fff6b2' : internal ? '#cd8375' : '#d7bf62'} strokeWidth={selected ? 2.2 : 1}>
          <rect className="sd-blueprint-hitbox" x={x - width / 2} y={y} width={width} height={height} fill="transparent" stroke={selected ? '#fff0a1' : 'none'} strokeDasharray="3 2" strokeWidth=".7" pointerEvents="all" />
          <title>{`${part.name} / ${part.weight}t / 砲台高 ${mountHeight}m${geometry ? ' / 上下ドラッグで高さ調整' : ''}`}</title>
          {mountHeight > 0 && <><rect x={x - width * .3} y={106 - mountHeight * 5} width={width * .6} height={mountHeight * 5} fill="rgba(100,140,145,.3)" /><text x={x} y={y - 4} textAnchor="middle" stroke="none" fill="currentColor" fontSize="9">+{mountHeight}m</text></>}
          <g transform={`translate(${x - width / 2} ${y}) scale(${width / 100} ${height / 100})`} className="sd-part-elevation" data-category={part.category}>
            <g transform={component.rotation === 180 ? 'translate(100 0) scale(-1 1)' : undefined}><PartElevation part={part} /></g>
          </g>
          {geometry && <path d={`M${x + direction * geometry.barrelRoot * units} ${106 - (mountHeight + geometry.barrelHeight) * 5}h${direction * geometry.barrelLength * units}`} strokeWidth={Math.max(1.2, geometry.barrelRadius * 10)} strokeLinecap="round" stroke="#cbd0b9" />}
        </g>
      })}
      <path d={`M${bow} 156v10m0-5H${stern}m0-5v10`} stroke="#638c90" fill="none" />
      <text x="500" y="174" textAnchor="middle" fill="#a1c0c0" fontSize="10">全長 {spec.lengthM} m ／ 全幅 {spec.beamM} m</text>
    </svg>
  </section>
}
