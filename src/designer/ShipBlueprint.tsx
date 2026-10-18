import { PartElevation } from './PartDrawing'
import { normalizedMountHeight, DESIGN_CELL_METERS } from '../game/data/gun-mount-geometry'
import { componentGunGeometry } from './gun-clearance'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { HLG_PART_BY_ID, hlgGridSpec, rotateFootprint, type HLGDesign } from './hlg-system'
import { designerLayerForPart } from './design-placement'

export { PartSymbol } from './PartDrawing'

/** A longitudinal projection of the same component cells edited in the plan. */
export function ShipBlueprint({ hull, design, selectedId, onSelect }: {
  hull: HullCatalogEntry; design: HLGDesign; selectedId: string | null; onSelect: (id: string) => void
}) {
  const spec = hlgGridSpec(hull)
  const xAt = (row: number) => row / spec.rows * 1000
  const bow = xAt(spec.topR), stern = xAt(spec.topR + spec.lengthCells)
  return <section className="sd-blueprint" aria-label="艦船側面図">
    <div className="sd-drawing-caption"><span>SIDE ELEVATION / 側面図</span><span>← 艦首　　艦尾 →</span></div>
    <svg viewBox="0 0 1000 175" role="group" aria-label={`${hull.name}の側面配置図`}>
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
        const height = geometry ? geometry.bodyHeight * 5 : internal ? 27 : part.category === 'bridge' ? 64 : part.category === 'funnel' ? 43 : part.category === 'weapon' ? 16 : 24
        const y = internal ? 112 : 106 - height - mountHeight * 5
        const selected = component.instanceId === selectedId
        const direction = -Math.cos(component.rotation * Math.PI / 180)
        const units = 1000 / (spec.rows * DESIGN_CELL_METERS)
        return <g key={component.instanceId} className="sd-blueprint-part" tabIndex={0} role="button" aria-label={`${part.name}を選択`} onClick={() => onSelect(component.instanceId)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(component.instanceId) } }}
          stroke={selected ? '#fff6b2' : internal ? '#cd8375' : '#d7bf62'} strokeWidth={selected ? 2.2 : 1}>
          <title>{`${part.name} / ${part.weight}t / 砲台高 ${mountHeight}m`}</title>
          {mountHeight > 0 && <><rect x={x - width * .3} y={106 - mountHeight * 5} width={width * .6} height={mountHeight * 5} fill="rgba(100,140,145,.3)" /><text x={x} y={y - 4} textAnchor="middle" stroke="none" fill="currentColor" fontSize="9">+{mountHeight}m</text></>}
          <g transform={`translate(${x - width / 2} ${y}) scale(${width / 100} ${height / 100})`} className="sd-part-elevation">
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
