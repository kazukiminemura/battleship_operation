import { componentGunGeometry } from './gun-clearance'
import { TurretPlan, TurretElevation, BridgePlan, BridgeElevation, FunnelPlan, FunnelElevation, MachineryPlan, TurbineElevation } from './naval-part-drawings'
import type { HLGPartDefinition, HLGRotation } from './hlg-system'

/** Illustrations stay inside the existing physical footprint; placement uses the original grid. */
export function PartPlanDrawing({ part, rotation = 0, barrels = part.barrels ?? 1, className = 'sd-part-plan' }: {
  part: HLGPartDefinition; rotation?: HLGRotation; barrels?: number; className?: string
}) {
  const length = part.footprint.h, beam = part.footprint.w
  const turned = rotation === 90 || rotation === 270
  const w = turned ? beam : length, h = turned ? length : beam
  return <svg className={className} data-category={part.category} viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g transform={`rotate(${-rotation}) scale(${length / 100} ${beam / 100}) translate(-50 -50)`} stroke="currentColor" strokeWidth=".8" strokeLinejoin="round" fill="var(--part-steel, #617476)">
      <PlanBody part={part} barrels={Math.max(1, Math.min(4, barrels))} />
    </g>
  </svg>
}

export function PartSymbol({ part }: { part: HLGPartDefinition }) {
  const geometry = componentGunGeometry(part)
  if (!geometry) return <PartPlanDrawing part={part} className="sd-part-symbol" />
  const { bodyLength: length, bodyWidth: beam, barrelRoot: root, barrelLength: tube, barrelSpacing: spacing } = geometry
  const count = Math.max(1, Math.min(4, part.barrels ?? 1))
  const fore = Math.max(length / 2, root + tube)
  return <svg className="sd-part-symbol" data-category={part.category} viewBox={`${-fore - .2} ${-beam / 2 - .2} ${fore + length / 2 + .4} ${beam + .4}`} aria-hidden="true" focusable="false">
    <svg x={-length / 2} y={-beam / 2} width={length} height={beam}><PartPlanDrawing part={part} /></svg>
    {Array.from({ length: count }, (_, i) => <path key={i} d={`M${-root} ${(i - (count - 1) / 2) * spacing}h${-tube}`} stroke="currentColor" strokeWidth=".8" vectorEffect="non-scaling-stroke" />)}
  </svg>
}

function PlanBody({ part, barrels }: { part: HLGPartDefinition; barrels: number }) {
  if (part.type === 'torpedo') return <>
    <circle cx="50" cy="50" r="34" fill="#243c42" />
    {Array.from({ length: barrels }, (_, i) => <g key={i} transform={`translate(0 ${20 + (i + .5) * 60 / barrels})`}>
      <path d="M10 -5L18 -9H85L94 -5V5L85 9H18L10 5Z" /><path d="M21 -8V8M77 -8V8M18 0H86" fill="none" stroke="#b6c2bb" />
    </g>)}
    <rect x="43" y="31" width="14" height="38" fill="#b2b5a1" />
  </>
  if (part.type === 'missile' && !/vls/.test(part.partId)) return <>
    <circle cx="56" cy="50" r="36" fill="#263e46" />
    {[29, 50, 71].map(y => <g key={y}><path d={`M9 ${y - 8}H85L93 ${y - 3}V${y + 3}L85 ${y + 8}H9Z`} fill="#82978a" /><path d={`M22 ${y - 7}v14m51-14v14M10 ${y}H87`} fill="none" /></g>)}
    <path d="M50 14H66V86H50Z" fill="#354f55" />
  </>
  if (part.type === 'missile') return <>
    <path d="M12 18H88V82H12Z" fill="#283f47" />
    {[0, 1, 2].flatMap(row => [0, 1, 2, 3].map(col => <g key={`${row}-${col}`}><rect x={18 + col * 17} y={24 + row * 18} width="13" height="14" rx="1" /><path d={`M${21 + col * 17} ${27 + row * 18}h7m-7 6h7`} stroke="#bac4b6" /></g>))}
  </>
  if (part.type === 'aa') return <>
    <circle cx="51" cy="50" r="37" fill="#243b43" /><circle cx="51" cy="50" r="27" />
    <path d="M35 16H64L78 30V70L64 84H35L23 68V32Z" fill="#81908b" />
    {Array.from({ length: barrels }, (_, i) => <path key={i} d={`M8 ${35 + (i + .5) * 30 / barrels}h41`} stroke="#d3d6c0" strokeWidth="2" />)}
    <rect x="53" y="37" width="18" height="26" fill="#334b52" /><path d="M61 40V60M56 50H66" />
  </>
  if (part.type === 'gun' || part.type === 'secondary') return <TurretPlan barrels={barrels} light={part.type === 'secondary' || /127mm|152mm/.test(part.partId)} />
  if (part.category === 'bridge') return <BridgePlan part={part} />
  if (part.category === 'funnel') return <FunnelPlan />
  if (part.category === 'boiler') return <MachineryPlan turbine={false} />
  if (part.category === 'turbine') return <MachineryPlan turbine />
  if (part.category === 'armor') return <>
    <path d="M8 9H92V91H8Z" fill="#65706c" /><path d="M13 15H87V85H13ZM13 50H87M50 15V85M17 19L83 81M17 81L83 19" fill="none" />
    {[[20, 24], [80, 24], [20, 76], [80, 76]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#b4b9a3" />)}
  </>
  if (/radar|sight|aegis|jammer/.test(part.partId)) return <>
    <path d="M29 21H71V79H29Z" /><circle cx="50" cy="50" r="20" fill="#2b444d" /><path d="M50 18V82M23 50H77" fill="none" />
    <path d="M16 14L84 32V43L16 25Z" fill="#a1b1a6" /><path d="M25 19L25 27M36 22L36 30M47 25L47 33M58 28L58 36M69 31L69 39" fill="none" stroke="#344f56" />
  </>
  return <>
    <rect x="14" y="14" width="72" height="72" rx="7" /><rect x="21" y="21" width="58" height="58" rx="3" fill="#304a50" />
    <circle cx="50" cy="47" r="17" fill="#829487" /><path d="M37 47H63M50 34V60M27 69H73M27 75H73" fill="none" /><circle cx="50" cy="47" r="5" fill="#263f47" />
  </>
}

/** Longitudinal elevation; dimensions and barrel positions are supplied by the shared geometry. */
export function PartElevation({ part }: { part: HLGPartDefinition }) {
  if (part.type === 'aa') return <>
    <path d="M13 88H88V100H13ZM40 88V58H62V88Z" fill="#344f56" />
    <path d="M24 70L17 25H58L76 39V72Z" fill="#8b9d8c" /><path d="M20 35H55V63H25" fill="none" />
    <circle cx="57" cy="54" r="12" fill="#2c4951" /><circle cx="57" cy="54" r="5" fill="#c0c8ac" />
    <path d="M70 46H87V72H70ZM82 73V87M34 77V88" fill="#657f78" />
  </>
  if (part.type === 'gun' || part.type === 'secondary') return <TurretElevation light={part.type === 'secondary' || /127mm|152mm/.test(part.partId)} />
  if (part.category === 'bridge') return <BridgeElevation part={part} />
  if (part.category === 'funnel') return <FunnelElevation />
  if (part.category === 'boiler') return <>
    <path d="M9 82H91V100H9Z" fill="#453e36" /><rect x="8" y="14" width="84" height="68" rx="15" fill="#8e8271" />
    <path d="M27 17V80M38 17V80M49 17V80M60 17V80M71 17V80M82 24V73" /><circle cx="20" cy="48" r="14" fill="#3e4945" /><circle cx="20" cy="48" r="8" fill="#b09d7d" /><path d="M37 14V3H74V14" fill="none" />
  </>
  if (part.category === 'turbine') return <TurbineElevation />
  if (part.type === 'torpedo') return <>
    <path d="M33 75H67V100H33Z" fill="#344c53" /><path d="M4 26L14 15H91L98 25V64L90 74H14L4 63Z" fill="#869387" />
    <path d="M18 17V72M30 17V72M78 17V72M89 17V72M5 44H97" fill="none" /><circle cx="11" cy="44" r="10" fill="#253e47" />
  </>
  if (part.type === 'missile' && /vls/.test(part.partId)) return <>
    <path d="M5 22H95V98H5Z" fill="#627c75" /><path d="M5 22L16 9H88L95 22Z" fill="#a3b39b" />
    <path d="M27 10V96M49 10V96M71 10V96M8 34H92M8 83H92" fill="none" /><path d="M15 16H23M36 16H44M58 16H66M79 16H87" stroke="#263e47" />
  </>
  if (part.type === 'missile') return <>
    <path d="M8 79H93V100H8Z" fill="#344d55" /><path d="M12 79L37 5H95L71 79Z" fill="#83958a" /><path d="M23 78L48 6M37 78L62 6M51 78L76 6M65 78L90 6M23 47H82" fill="none" />
  </>
  if (/radar|sight|aegis|jammer/.test(part.partId)) return <>
    <path d="M30 85H75V100H30ZM46 85V39H58V85Z" fill="#80988b" /><path d="M17 5L88 20L79 48L8 33Z" fill="#a1b8a7" /><path d="M20 9L12 32M35 12L28 36M50 15L43 39M65 18L58 42M80 21L73 45M13 21L83 36" stroke="#38575d" fill="none" />
  </>
  return <>
    <path d="M10 100V18L23 7H79L91 18V100Z" fill="#70877c" /><path d="M25 14V95M77 14V95M27 72H74M27 81H74M27 90H74" fill="none" /><rect x="37" y="25" width="30" height="23" fill="#253f49" />
  </>
}
