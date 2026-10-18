import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { HLG_PART_BY_ID, hlgGridSpec, rotateFootprint, type HLGDesign, type HLGPartDefinition } from './hlg-system'
import { designerLayerForPart } from './design-placement'

export function PartSymbol({ part }: { part: HLGPartDefinition }) {
  return <svg className="sd-part-symbol" viewBox="0 0 72 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
    {part.category === 'weapon' ? <><path d="M16 37h40l-5-20H23zM22 17v-4h28v4" />{Array.from({ length: Math.min(4, part.barrels ?? 2) }, (_, i) => <path key={i} d={`M${29 + i * 6} 15V3`} />)}</>
      : part.category === 'bridge' ? <><path d="M16 42V30h8V19h7V10h11v9h7v11h7v12zM36 10V2M24 24h24M16 34h40M31 14h11" /></>
        : part.category === 'funnel' ? <><path d="M22 40V13h29v27M19 40h35M20 13V8h33v5zM25 6l-4-3M36 6V1M47 6l4-3" /></>
          : part.category === 'boiler' || part.category === 'turbine' ? <><rect x="12" y="12" width="48" height="27" rx="5" /><path d="M20 13v25M29 13v25M38 13v25M47 13v25M60 25h10M2 25h10" /></>
            : <><path d="M16 40V18h40v22zM24 18V9h24v9M24 27h24M36 9V1M26 3h20" /></>}
    <path d="M6 45h60" opacity=".4" />
  </svg>
}

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
      <defs><pattern id="sd-engine-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="#d16f61" strokeWidth=".8" /></pattern></defs>
      <path d={`M${bow} 113 Q${bow + 18} 145 ${bow + 65} 146 L${stern - 16} 146 L${stern} 118 L${stern} 106 L${bow} 106Z`} fill="rgba(160,210,217,.04)" stroke="#b3c8c6" strokeWidth="1.2" />
      <path d={`M${bow + 5} 119 H${stern - 5}M${bow + 50} 139H${stern - 20}`} stroke="#638c90" strokeDasharray="5 4" fill="none" />
      {design.components.map(component => {
        const part = HLG_PART_BY_ID[component.partId]
        if (!part) return null
        const footprint = rotateFootprint(part.footprint, component.rotation)
        const x = xAt(component.cell.r + .5), width = Math.max(5, footprint.h / spec.rows * 1000)
        const internal = designerLayerForPart(part) === 'internal'
        const height = internal ? 27 : part.category === 'bridge' ? 64 : part.category === 'funnel' ? 43 : part.category === 'weapon' ? 16 : 24
        const y = internal ? 112 : 106 - height
        const selected = component.instanceId === selectedId
        const direction = component.rotation === 180 ? 1 : -1
        return <g key={component.instanceId} className="sd-blueprint-part" tabIndex={0} role="button" aria-label={`${part.name}を選択`} onClick={() => onSelect(component.instanceId)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(component.instanceId) } }}
          stroke={selected ? '#fff6b2' : internal ? '#cd8375' : '#d7bf62'} strokeWidth={selected ? 2.2 : 1}>
          <title>{`${part.name} / ${part.weight}t`}</title>
          <rect x={x - width / 2} y={y} width={width} height={height} fill={internal ? 'url(#sd-engine-hatch)' : selected ? 'rgba(234,198,95,.2)' : 'rgba(5,27,33,.75)'} />
          {part.category === 'weapon' && <path d={`M${x} ${y + 6}h${direction * Math.max(15, width * .9)}M${x} ${y + 10}h${direction * Math.max(15, width * .9)}`} />}
          {part.category === 'bridge' && <path d={`M${x - width * .6} ${y + height * .35}h${width * 1.2}M${x} ${y}v-12M${x - 9} ${y - 8}h18`} />}
          {part.category === 'funnel' && <path d={`M${x - width / 2 - 2} ${y + 6}h${width + 4}`} />}
        </g>
      })}
      <path d={`M${bow} 156v10m0-5H${stern}m0-5v10`} stroke="#638c90" fill="none" />
      <text x="500" y="174" textAnchor="middle" fill="#a1c0c0" fontSize="10">全長 {spec.lengthM} m ／ 全幅 {spec.beamM} m</text>
    </svg>
  </section>
}
