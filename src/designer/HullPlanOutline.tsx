import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { HLG_PART_BY_ID, componentRect, hlgHullHalfWidth, hlgGridSpec, type HLGDesign } from './hlg-system'
import { designerLayerForPart } from './design-placement'
import { PartPlanDrawing } from './PartDrawing'

/** The outline follows the editable hull mask; machinery is a non-interactive underlay. */
export function HullPlanOutline({ hull, design, showMachinery }: { hull: HullCatalogEntry; design: HLGDesign; showMachinery: boolean }) {
  const spec = hlgGridSpec(hull)
  const port: string[] = [], starboard: string[] = []
  for (let i = 0; i <= 128; i++) {
    const t = i / 128
    const x = spec.topR + t * (spec.lengthCells - 1)
    const halfBeam = spec.beamCells / 2 * hlgHullHalfWidth(t * 2 - 1, hull.shipType)
    port.push(`${x},${spec.centerC + .5 - halfBeam}`)
    starboard.unshift(`${x},${spec.centerC + .5 + halfBeam}`)
  }
  return <svg className="sd-hull-plan-outline" viewBox={`0 0 ${spec.rows} ${spec.cols}`} preserveAspectRatio="none" aria-hidden="true">
    <polygon points={[...port, ...starboard].join(' ')} fill="none" stroke="#9cbec6" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
    <path d={`M${spec.topR} ${spec.centerC + .5}H${spec.topR + spec.lengthCells}`} stroke="#557d88" strokeWidth=".5" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
    {showMachinery && design.components.map(component => {
      const part = HLG_PART_BY_ID[component.partId]
      if (!part || designerLayerForPart(part) !== 'internal') return null
      const rect = componentRect(component, part)
      return <svg className="sd-machinery-underlay" key={component.instanceId} x={rect.top} y={rect.left} width={rect.h} height={rect.w}>
        <PartPlanDrawing part={part} rotation={component.rotation} />
      </svg>
    })}
  </svg>
}
