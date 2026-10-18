import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { DESIGN_CELL_METERS } from '../game/data/gun-mount-geometry'
import { HLG_PART_BY_ID, hlgGridSpec, type HLGComponentInstance, type HLGDesign } from './hlg-system'
import { barrelsInterfere, gunClearance, componentGunGeometry } from './gun-clearance'

export function GunBarrelOverlay({ hull, design, selectedId, preview }: {
  hull: HullCatalogEntry; design: HLGDesign; selectedId: string | null; preview?: HLGComponentInstance
}) {
  const spec = hlgGridSpec(hull)
  const items = [...design.components, ...(preview ? [preview] : [])].flatMap(component => {
    const part = HLG_PART_BY_ID[component.partId]
    return part ? [{ component, part, clearance: gunClearance(component, part) }] : []
  })
  return <svg className="sd-barrel-overlay" viewBox={`0 0 ${spec.rows} ${spec.cols}`} preserveAspectRatio="none" aria-hidden="true">
    {items.map(({ component, part, clearance }, index) => {
      const blocked = items.some((other, j) => index !== j && barrelsInterfere(clearance, other.clearance))
      const color = blocked ? '#ff7272' : component.instanceId === selectedId ? '#fff5a4' : '#d7bf62'
      const geometry = componentGunGeometry(part)
      const count = clearance.barrels.length
      const showClearance = blocked || component.instanceId === selectedId || component === preview
      return <g key={component.instanceId}>
        {showClearance && <g fill={color} fillOpacity=".08" stroke={color} strokeWidth=".08" strokeDasharray=".4 .25">
          {clearance.barrels.map((box, i) => <rect key={i} x={box.y / DESIGN_CELL_METERS} y={box.x / DESIGN_CELL_METERS} width={box.l / DESIGN_CELL_METERS} height={box.w / DESIGN_CELL_METERS} />)}
        </g>}
        {geometry && <g transform={`translate(${component.cell.r + .5} ${component.cell.c + .5}) rotate(${-component.rotation})`}>
          {Array.from({ length: count }, (_, i) => {
            const root = -geometry.barrelRoot / DESIGN_CELL_METERS
            const tip = root - geometry.barrelLength / DESIGN_CELL_METERS
            const y = (i - (count - 1) / 2) * geometry.barrelSpacing / DESIGN_CELL_METERS
            const radius = geometry.barrelRadius / DESIGN_CELL_METERS
            return <g key={i}>
              <path d={`M${root} ${y - radius}L${tip} ${y - radius * .65}V${y + radius * .65}L${root} ${y + radius}Z`} fill={blocked ? '#e87d69' : '#b7c3b4'} stroke="#2a4149" strokeWidth=".08" />
              <path d={`M${root} ${y - radius * .4}L${tip} ${y - radius * .3}`} stroke={color} strokeWidth=".05" />
              <path d={`M${tip} ${y - radius * .6}v${radius * 1.2}`} stroke="#102832" strokeWidth=".1" />
            </g>
          })}
        </g>}
      </g>
    })}
  </svg>
}
