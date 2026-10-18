import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { DESIGN_CELL_METERS } from '../game/data/gun-mount-geometry'
import { HLG_PART_BY_ID, hlgGridSpec, type HLGComponentInstance, type HLGDesign } from './hlg-system'
import { barrelsInterfere, gunClearance } from './gun-clearance'

export function GunBarrelOverlay({ hull, design, selectedId, preview }: {
  hull: HullCatalogEntry; design: HLGDesign; selectedId: string | null; preview?: HLGComponentInstance
}) {
  const spec = hlgGridSpec(hull)
  const items = [...design.components, ...(preview ? [preview] : [])].flatMap(component => {
    const part = HLG_PART_BY_ID[component.partId]
    return part ? [{ component, clearance: gunClearance(component, part) }] : []
  })
  return <svg className="sd-barrel-overlay" viewBox={`0 0 ${spec.rows} ${spec.cols}`} preserveAspectRatio="none" aria-hidden="true">
    {items.map(({ component, clearance }, index) => {
      const blocked = items.some((other, j) => index !== j && barrelsInterfere(clearance, other.clearance))
      const color = blocked ? '#ff7272' : component.instanceId === selectedId ? '#fff5a4' : '#d7bf62'
      return <g key={component.instanceId} fill={color} fillOpacity=".18" stroke={color} strokeWidth=".12" strokeDasharray={component === preview ? '.5 .3' : undefined}>
        {clearance.barrels.map((box, i) => <rect key={i} x={box.y / DESIGN_CELL_METERS} y={box.x / DESIGN_CELL_METERS} width={box.l / DESIGN_CELL_METERS} height={box.w / DESIGN_CELL_METERS} />)}
      </g>
    })}
  </svg>
}
