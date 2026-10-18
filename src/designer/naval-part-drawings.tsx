import type { HLGPartDefinition } from './hlg-system'

/** Orthographic ship fittings: left is forward, coordinates stay in their mount footprint. */
export function TurretPlan({ barrels, light }: { barrels: number; light: boolean }) {
  return <>
    <path className="sd-fitting-outline" d={light
      ? 'M12 32Q17 15 38 13H65Q88 16 92 35V65Q88 84 65 87H38Q17 85 12 68Z'
      : 'M12 31L28 17H72L94 30V70L72 83H28L12 69Z'} />
    <g className="sd-drawing-detail">
      <path d="M31 17A35 40 0 0 1 83 24M31 83A35 40 0 0 0 83 76M28 22L23 34V66L28 78M28 23H70L87 33V67L70 77H28" />
      <path d="M23 34L36 40H73L87 33M23 66L36 60H73L87 67M73 40V60M36 40V60" />
      <path d="M55 25H69V34H55ZM58 27H66M58 30H66M53 68H74M53 72H74" />
      <path d="M65 18V9H72V18M65 82V91H72V82M64 11H73M64 89H73" />
      <path d="M88 39H91M88 45H91M88 51H91M88 57H91M88 63H91" />
      {barrels > 1 && <path d="M40 46H62V55H40ZM43 48H59V53H43Z" />}
    </g>
    {Array.from({ length: barrels }, (_, i) => {
      const y = 50 + (i - (barrels - 1) / 2) * 18
      return <g key={i}><path d={`M12 ${y - 4}H22V${y + 4}H12M15 ${y - 3}V${y + 3}`} /><path className="sd-drawing-detail" d={`M23 ${y - 5}q8 5 0 10`} /></g>
    })}
  </>
}

export function TurretElevation({ light }: { light: boolean }) {
  return <>
    <path d="M23 89V98H80V89M18 89H88M22 94H84" />
    <path className="sd-fitting-outline" d={light
      ? 'M12 74L17 36Q21 21 40 18H68L89 34V81L78 89H23Z'
      : 'M12 75L20 32L39 17H69L93 36V78L83 88H24Z'} />
    <path d="M20 32L39 40H78L93 36M39 40V78M24 80H86M12 24H25V39H12Z" />
    <g className="sd-drawing-detail"><path d="M48 19V14H64V19M51 15H62M60 49H81V54H60ZM61 62H82M61 66H82M61 70H82M30 84V88M72 84V88" /><path d="M43 30H68M43 33H68" /></g>
  </>
}

function bridgeStyle(part: HLGPartDefinition) {
  return /bb|jp/.test(part.partId) && !/us/.test(part.partId) ? 'pagoda' : /dd/.test(part.partId) ? 'destroyer' : 'tower'
}

export function BridgePlan({ part }: { part: HLGPartDefinition }) {
  const style = bridgeStyle(part)
  return <>
    <path className="sd-fitting-outline" d="M5 36L17 25H38V12H72V24L94 32V68L72 76V88H38V75H17L5 64Z" />
    <path d="M13 38L23 32H74L87 38V62L74 68H23L13 62ZM25 38L34 31H65L76 38V62L65 69H34L25 62Z" />
    <path d="M35 38L43 32H62L69 40V60L62 68H43L35 62Z" />
    <g className="sd-drawing-detail">
      <path d="M17 39V44M17 47V52M17 55V60M20 35H27M20 65H27M29 33V38M29 62V67M40 15H69V23H40M40 77H69V85H40" />
      <path d="M51 34V66M37 50H65M45 44L57 56M45 56L57 44M54 24V31M54 69V76" />
      {style === 'pagoda' ? <path d="M62 4V18M57 6H68M61 82V96M56 94H67M76 37H82V63H76M79 40V60" /> : <path d="M42 39H61V61H42ZM44 42H59V58H44M61 50H84M82 42V58" />}
      <path d="M30 16H35V24H30ZM30 76H35V84H30ZM85 26L92 32M85 74L92 68" />
    </g>
  </>
}

export function BridgeElevation({ part }: { part: HLGPartDefinition }) {
  const style = bridgeStyle(part)
  return <>
    <path className="sd-fitting-outline" d={style === 'pagoda'
      ? 'M7 99V84H13V74H22V60H29V42H37V28H42V19H65V28H74V42H82V60H87V79H94V99Z'
      : style === 'destroyer' ? 'M8 99V74H18V51L30 39H61L76 49V72H90V99Z'
      : 'M9 99V78H20V60H25V30L34 22H64L76 34V78H91V99Z'} />
    <path d={style === 'destroyer' ? 'M18 54H77M15 70H82M12 81H91M21 88H84' : 'M31 38H79M24 55H85M17 72H89M11 86H94'} />
    <g className="sd-drawing-detail">
      {(style === 'destroyer' ? [46, 63, 83] : [30, 46, 63, 79, 91]).map((y, row) => <g key={y}>
        {Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${34 + i * 9} ${y}h5v4h-5Z`} />)}
        <path d={`M${25 - row * 2} ${y + 6}h${52 + row * 4}`} />
      </g>)}
      <path d="M79 62V95M82 62V95M78 68H83M78 74H83M78 80H83M78 86H83" />
    </g>
    <path d={style === 'destroyer' ? 'M50 38V6M42 19H63M37 38L50 13L67 39M48 8H57V14H48' : 'M54 20V1M42 10H69M48 2H63M46 20L54 5L64 20M42 17H68'} />
  </>
}

export function FunnelPlan() {
  return <>
    <path className="sd-fitting-outline" d="M32 18H68C86 18 94 32 94 50S86 82 68 82H32C14 82 6 68 6 50S14 18 32 18Z" />
    <path d="M33 25H67C80 25 87 36 87 50S80 75 67 75H33C20 75 13 64 13 50S20 25 33 25Z" />
    <path d="M34 31H66C76 31 81 39 81 50S76 69 66 69H34C24 69 19 61 19 50S24 31 34 31Z" />
    <g className="sd-drawing-detail"><path d="M29 33V67M40 31V69M51 31V69M62 31V69M73 34V66M20 44H80M20 56H80M8 30H18M8 70H18M83 29H93M83 71H93" /><path d="M45 14H58V19H45M45 81H58V86H45" /></g>
  </>
}

export function FunnelElevation() {
  return <>
    <path d="M10 96H81V100H10Z" />
    <path className="sd-fitting-outline" d="M17 95L40 15Q58 6 85 13L72 95Z" />
    <path d="M38 22Q61 13 84 20M36 29Q59 21 82 27M28 59H77M21 85H73" />
    <g className="sd-drawing-detail"><path d="M44 23L25 90M76 24L66 91M32 45H79M24 73H75M51 11V6M56 10V5M61 10V5M66 10V5M71 10V5" /></g>
    <path d="M79 92H91V39Q91 32 86 32H82M85 90V43H81M28 84H20V94M72 84H78V94" />
  </>
}

export function MachineryPlan({ turbine }: { turbine: boolean }) {
  return turbine ? <>
    <path className="sd-fitting-outline" d="M7 38L18 25H39L48 35V65L39 75H18L7 62ZM52 30L60 17H75L86 31V69L75 83H60L52 70Z" />
    <path d="M3 50H97M46 44H54V56H46M86 37H96V63H86M11 82H84M11 18H84" />
    <g className="sd-drawing-detail"><path d="M18 27V73M25 27V73M32 27V73M39 30V70M60 21V79M66 19V81M72 19V81M78 24V76M11 21V30M11 70V79M83 21V30M83 70V79M89 41V59M93 41V59" /></g>
  </> : <>
    <path className="sd-fitting-outline" d="M12 17H87V83H12Z" /><path d="M16 26Q5 26 5 36V64Q5 74 16 74M83 26Q95 26 95 36V64Q95 74 83 74" />
    {[32, 68].map(y => <g key={y}><path d={`M20 ${y - 10}H78Q86 ${y - 10}86 ${y}T78 ${y + 10}H20Q12 ${y + 10}12 ${y}T20 ${y - 10}Z`} /><path className="sd-drawing-detail" d={`M24 ${y - 8}v16m10-16v16m10-16v16m10-16v16m10-16v16m10-16v16`} /></g>)}
    <path d="M20 50H81M30 42V58M68 42V58M30 17V9H65V17M30 83V91H65V83" />
  </>
}

export function TurbineElevation() {
  return <>
    <path d="M5 91H94V99H5ZM14 85V91M35 85V91M60 85V91M79 85V91" />
    <path className="sd-fitting-outline" d="M8 80V44Q8 29 21 26H32Q44 29 44 44V80ZM53 80V33Q53 17 65 14H73Q85 17 85 33V80Z" />
    <path d="M2 61H98M44 54H53V68H44M85 44H95V79H85" />
    <g className="sd-drawing-detail"><path d="M16 31V78M23 28V78M30 28V78M37 33V78M60 21V78M67 17V78M74 19V78M81 25V78M89 48V75M92 48V75M8 49H44M53 41H85" /></g>
  </>
}
