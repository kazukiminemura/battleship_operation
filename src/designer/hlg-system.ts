import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { PlayerShipType, WeaponTemplate } from '../game/data/masterdata'
import type { WeaponType } from '../game/simulation/types'
import { WEAPON_SHOP } from '../game/data/weapon-shop'
import { cellToMount, hullDimensions } from '../game/ui/prep-layout'

export type HLGComponentCategory = 'weapon' | 'bridge' | 'funnel' | 'boiler' | 'turbine' | 'aux' | 'armor'
export type HLGZone = 'fore' | 'mid' | 'aft' | 'side' | 'deck' | 'internal'
export type HLGRotation = 0 | 90 | 180 | 270
export type HLGCell = { c: number; r: number }
export type HLGFootprint = { w: number; h: number }

export interface HLGPartDefinition {
  partId: string
  name: string
  category: HLGComponentCategory
  type?: WeaponType
  footprint: HLGFootprint
  weight: number
  cost: number
  allowedShipClasses: PlayerShipType[]
  allowedZones: HLGZone[]
  barrels?: number
  ammo?: number
  firepower?: number
  antiAir?: number
  accuracy?: number
  reload?: number
  requires?: Partial<Record<'funnelCapacity' | 'power', number>>
  provides?: Partial<Record<'power' | 'smokeExhaust' | 'command' | 'aaControl', number>>
}

export interface HLGComponentInstance {
  instanceId: string
  partId: string
  category: HLGComponentCategory
  cell: HLGCell
  rotation: HLGRotation
  barrels?: number
}

export interface HLGDesign {
  hullTemplateId: string
  shipClass: PlayerShipType
  gridVersion: number
  armorPlan: { belt: number; deck: number; bulkhead: number }
  components: HLGComponentInstance[]
}

export interface HLGGridSpec {
  cols: number
  rows: number
  lengthCells: number
  beamCells: number
  centerC: number
  topR: number
  lengthM: number
  beamM: number
}

export interface HLGStats {
  totalWeight: number
  maxWeight: number
  totalFirepower: number
  totalAntiAir: number
  avgAccuracy: number
  speed: number
  turnRate: number
  powerRequired: number
  powerProvided: number
  smokeRequired: number
  smokeProvided: number
  command: number
  warnings: string[]
  canDeploy: boolean
}

const GRID_CELL_METERS = 1.25
const GRID_MARGIN_CELLS = 2
const HLG_GRID_VERSION = 3
const FOOTPRINT_SCALE = 2
const MAX_WEIGHT: Record<PlayerShipType, number> = {
  destroyer: 3500,
  cruiser: 10000,
  battleship: 30000,
}

const WEAPON_META: Record<string, { weight: number; firepower?: number; antiAir?: number; reload: number; accuracy: number; barrels: number }> = {
  'weapon.gun.127mm.twin': { weight: 300, firepower: 20, reload: 3, accuracy: 0.80, barrels: 2 },
  'weapon.gun.127mm.ap': { weight: 360, firepower: 27, reload: 4, accuracy: 0.76, barrels: 2 },
  'weapon.gun.152mm.twin': { weight: 520, firepower: 38, reload: 5, accuracy: 0.78, barrels: 2 },
  'weapon.gun.203mm': { weight: 850, firepower: 65, reload: 8, accuracy: 0.75, barrels: 1 },
  'weapon.gun.406mm.twin': { weight: 1600, firepower: 105, reload: 18, accuracy: 0.72, barrels: 2 },
  'weapon.gun.406mm.he': { weight: 1550, firepower: 96, reload: 17, accuracy: 0.70, barrels: 2 },
  'weapon.gun.460mm': { weight: 2400, firepower: 145, reload: 26, accuracy: 0.70, barrels: 1 },
  'weapon.secondary.127mm.twin': { weight: 200, firepower: 14, antiAir: 18, reload: 2, accuracy: 0.82, barrels: 2 },
  'weapon.secondary.100mm.cl': { weight: 180, firepower: 11, antiAir: 32, reload: 2, accuracy: 0.85, barrels: 2 },
  'weapon.secondary.152mm.twin': { weight: 600, firepower: 48, antiAir: 8, reload: 6, accuracy: 0.76, barrels: 2 },
  'weapon.secondary.127mm.bb': { weight: 260, firepower: 18, antiAir: 20, reload: 2, accuracy: 0.82, barrels: 2 },
  'weapon.torpedo.533mm.basic': { weight: 120, firepower: 80, reload: 15, accuracy: 0.88, barrels: 4 },
  'weapon.torpedo.610mm.dd': { weight: 200, firepower: 135, reload: 22, accuracy: 0.85, barrels: 4 },
  'weapon.torpedo.610mm.cl': { weight: 240, firepower: 145, reload: 22, accuracy: 0.84, barrels: 4 },
  'weapon.torpedo.610mm.bb': { weight: 280, firepower: 160, reload: 25, accuracy: 0.83, barrels: 4 },
  'weapon.aa.20mm.dd': { weight: 30, antiAir: 30, reload: 0.5, accuracy: 0.70, barrels: 2 },
  'weapon.aa.cruiser': { weight: 65, antiAir: 50, reload: 1.0, accuracy: 0.72, barrels: 2 },
  'weapon.aa.heavy': { weight: 120, antiAir: 72, reload: 2.0, accuracy: 0.75, barrels: 2 },
  'weapon.aa.sam.cl': { weight: 150, antiAir: 95, reload: 5.0, accuracy: 0.88, barrels: 2 },
  'weapon.aa.ciws.bb': { weight: 90, antiAir: 65, reload: 0.3, accuracy: 0.68, barrels: 2 },
  'weapon.missile.antiship.dd': { weight: 160, firepower: 90, reload: 10, accuracy: 0.92, barrels: 4 },
  'weapon.missile.sam.dd': { weight: 90, antiAir: 85, reload: 5, accuracy: 0.90, barrels: 4 },
  'weapon.missile.cruiser.standard': { weight: 220, firepower: 110, reload: 11, accuracy: 0.91, barrels: 4 },
  'weapon.missile.cruise.cl': { weight: 320, firepower: 150, reload: 18, accuracy: 0.88, barrels: 2 },
  'weapon.missile.battleship.longrange': { weight: 350, firepower: 160, reload: 18, accuracy: 0.88, barrels: 4 },
  'weapon.missile.antiship.bb': { weight: 300, firepower: 140, reload: 13, accuracy: 0.90, barrels: 4 },
}

export const HLG_PARTS: HLGPartDefinition[] = [
  ...WEAPON_SHOP.map(toWeaponPart),
  { partId: 'part.bridge.dd', name: '小型艦橋', category: 'bridge', footprint: scaledFootprint(3, 3), weight: 180, cost: 400, allowedShipClasses: ['destroyer', 'cruiser'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 1 } },
  { partId: 'part.bridge.ca', name: '大型艦橋', category: 'bridge', footprint: scaledFootprint(4, 4), weight: 520, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 2, aaControl: 1 } },
  { partId: 'part.bridge.bb', name: '戦艦艦橋', category: 'bridge', footprint: scaledFootprint(5, 5), weight: 900, cost: 1400, allowedShipClasses: ['battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 3, aaControl: 2 } },
  { partId: 'part.funnel.small', name: '小型煙突', category: 'funnel', footprint: scaledFootprint(2, 2), weight: 90, cost: 180, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'deck'], provides: { smokeExhaust: 35 } },
  { partId: 'part.funnel.large', name: '大型煙突', category: 'funnel', footprint: scaledFootprint(3, 3), weight: 220, cost: 360, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'deck'], provides: { smokeExhaust: 75 } },
  { partId: 'part.boiler.light', name: '軽量ボイラー', category: 'boiler', footprint: scaledFootprint(3, 3), weight: 420, cost: 500, allowedShipClasses: ['destroyer', 'cruiser'], allowedZones: ['mid', 'aft', 'internal'], requires: { funnelCapacity: 25 }, provides: { power: 55 } },
  { partId: 'part.boiler.heavy', name: '重油専焼ボイラー', category: 'boiler', footprint: scaledFootprint(4, 4), weight: 900, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { funnelCapacity: 45 }, provides: { power: 110 } },
  { partId: 'part.turbine.light', name: '軽量タービン', category: 'turbine', footprint: scaledFootprint(3, 2), weight: 360, cost: 500, allowedShipClasses: ['destroyer', 'cruiser'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 30 }, provides: { power: 20 } },
  { partId: 'part.turbine.heavy', name: '大出力タービン', category: 'turbine', footprint: scaledFootprint(4, 3), weight: 780, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 60 }, provides: { power: 45 } },
  { partId: 'part.aux.radar', name: '射撃管制レーダー', category: 'aux', footprint: scaledFootprint(2, 2), weight: 80, cost: 350, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { aaControl: 1 } },
  { partId: 'part.armor.bulkhead', name: '防御区画', category: 'armor', footprint: scaledFootprint(4, 3), weight: 700, cost: 500, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'internal'] },
]

export const HLG_PART_BY_ID: Record<string, HLGPartDefinition> = Object.fromEntries(HLG_PARTS.map(part => [part.partId, part]))

export function hlgGridSpec(hull: HullCatalogEntry): HLGGridSpec {
  const { lengthM, beamM } = hullDimensions(hull)
  const lengthCells = Math.ceil(lengthM / GRID_CELL_METERS)
  const beamCells = beamM / GRID_CELL_METERS
  const cols = makeOdd(Math.max(9, Math.ceil(beamCells) + GRID_MARGIN_CELLS * 2))
  const rows = makeOdd(lengthCells + GRID_MARGIN_CELLS * 2)
  return { cols, rows, lengthCells, beamCells, centerC: Math.floor(cols / 2), topR: GRID_MARGIN_CELLS, lengthM, beamM }
}

export function defaultHLGDesign(hull: HullCatalogEntry): HLGDesign {
  const spec = hlgGridSpec(hull)
  const parts = defaultPartsForClass(hull.shipType)
  const components: HLGComponentInstance[] = []
  for (const item of parts) {
    const part = HLG_PART_BY_ID[item.partId]
    if (!part) continue
    const preferred = { ...item.preferred, c: spec.centerC }
    const cell = findNearestValidCell(hull, { ...blankDesign(hull), components }, part, preferred)
    if (!cell) continue
    components.push(makeComponent(part, cell, item.rotation ?? 0))
  }
  return { ...blankDesign(hull), components }
}

export function cloneHLGDesign(design: HLGDesign): HLGDesign {
  return {
    ...design,
    armorPlan: { ...design.armorPlan },
    components: design.components.map(component => ({ ...component, cell: { ...component.cell } })),
  }
}

export function normalizeHLGDesign(hull: HullCatalogEntry, design: HLGDesign): HLGDesign {
  const cloned = cloneHLGDesign(design)
  if (cloned.gridVersion === HLG_GRID_VERSION) return cloned
  const spec = hlgGridSpec(hull)
  const coordinateScale = cloned.gridVersion < 2 ? FOOTPRINT_SCALE : 1
  return {
    ...cloned,
    gridVersion: HLG_GRID_VERSION,
    components: cloned.components.map(component => ({
      ...component,
      cell: {
        c: clamp(Math.round(component.cell.c * coordinateScale), 0, spec.cols - 1),
        r: clamp(Math.round(component.cell.r * coordinateScale), 0, spec.rows - 1),
      },
    })),
  }
}

export function calculateHLGStats(hull: HullCatalogEntry, design: HLGDesign): HLGStats {
  const warnings = validateHLGDesign(hull, design)
  let totalWeight = armorWeight(design)
  let totalFirepower = 0
  let totalAntiAir = 0
  let accuracySum = 0
  let weaponCount = 0
  let powerProvided = 0
  let powerRequired = 0
  let smokeProvided = 0
  let smokeRequired = 0
  let command = 0

  for (const component of design.components) {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part) continue
    totalWeight += part.weight
    totalFirepower += part.firepower ?? 0
    totalAntiAir += part.antiAir ?? 0
    if (part.type) {
      accuracySum += part.accuracy ?? 0.75
      weaponCount++
    }
    powerProvided += part.provides?.power ?? 0
    smokeProvided += part.provides?.smokeExhaust ?? 0
    command += part.provides?.command ?? 0
    powerRequired += part.requires?.power ?? 0
    smokeRequired += part.requires?.funnelCapacity ?? 0
  }

  const maxWeight = MAX_WEIGHT[hull.shipType]
  const weightRatio = Math.min(1.5, totalWeight / maxWeight)
  const propulsion = Math.max(0, powerProvided - powerRequired)
  const propulsionRatio = Math.min(1.25, propulsion / propulsionTarget(hull.shipType))
  const speed = Math.max(4, hull.maxSpeed * 10 * (0.42 + propulsionRatio * 0.72) * (1 - Math.min(0.45, weightRatio * 0.28)))
  const turnRate = Math.max(0.4, hull.turnRate * 1000 * (1 - Math.min(0.55, weightRatio * 0.34)))
  const systemWarnings = [
    command <= 0 ? '艦橋がありません' : null,
    smokeProvided < smokeRequired ? '排煙能力が不足しています' : null,
    !design.components.some(c => c.category === 'boiler') ? '主缶がありません' : null,
    !design.components.some(c => c.category === 'turbine') ? '主機がありません' : null,
    totalWeight > maxWeight ? '重量超過です' : null,
  ].filter((value): value is string => !!value)

  return {
    totalWeight,
    maxWeight,
    totalFirepower,
    totalAntiAir,
    avgAccuracy: weaponCount ? accuracySum / weaponCount : 0,
    speed,
    turnRate,
    powerRequired,
    powerProvided,
    smokeRequired,
    smokeProvided,
    command,
    warnings: [...systemWarnings, ...warnings],
    canDeploy: systemWarnings.length === 0 && warnings.length === 0,
  }
}

export function validateHLGDesign(hull: HullCatalogEntry, design: HLGDesign): string[] {
  const warnings: string[] = []
  const placements = design.components
    .map(component => ({ component, part: HLG_PART_BY_ID[component.partId] }))
    .filter((item): item is { component: HLGComponentInstance; part: HLGPartDefinition } => !!item.part)
  for (const { component, part } of placements) {
    if (!part.allowedShipClasses.includes(hull.shipType)) warnings.push(`${part.name}はこの艦種に搭載できません`)
    if (!isPlacementInsideHull(hull, component, part)) warnings.push(`${part.name}が船体外にはみ出しています`)
    if (!isZoneAllowed(hull, component, part)) warnings.push(`${part.name}の配置区画が不正です`)
  }
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i]!
    const aRect = componentRect(a.component, a.part)
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j]!
      if (componentsBlockEachOther(a.component, b.component) && rectsOverlap(aRect, componentRect(b.component, b.part))) {
        warnings.push(`${a.part.name}と${b.part.name}が重なっています`)
      }
    }
  }
  return [...new Set(warnings)]
}

export function canPlaceHLGPart(hull: HullCatalogEntry, design: HLGDesign, part: HLGPartDefinition, cell: HLGCell, rotation: HLGRotation): boolean {
  const component = makeComponent(part, cell, rotation)
  const temp = { ...design, components: [...design.components, component] }
  return validateHLGDesign(hull, temp).length === 0 && calculateWeight(temp) <= MAX_WEIGHT[hull.shipType]
}

export function hlgDesignToLoadout(hull: HullCatalogEntry, design: HLGDesign): WeaponTemplate[] {
  const spec = hlgGridSpec(hull)
  return design.components.flatMap(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part?.type) return []
    const mount = cellToMount(component.cell.c, component.cell.r, spec)
    return [{
      id: part.partId.replace('part.weapon.', ''),
      name: part.name,
      type: part.type,
      ammo: part.ammo ?? 100,
      barrels: component.barrels ?? part.barrels,
      mount,
      instanceId: component.instanceId,
    }]
  })
}

export function previewWeaponsFromHLG(hull: HullCatalogEntry, design: HLGDesign): Array<{ id: string; name: string; type: WeaponType; mount: { x: number; y: number }; barrels?: number; selected: boolean }> {
  const spec = hlgGridSpec(hull)
  return design.components.flatMap(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part?.type) return []
    return [{
      id: part.partId.replace('part.weapon.', ''),
      name: part.name,
      type: part.type,
      mount: cellToMount(component.cell.c, component.cell.r, spec),
      barrels: component.barrels ?? part.barrels,
      selected: false,
    }]
  })
}

export function towerMountFromHLG(hull: HullCatalogEntry, design: HLGDesign): { x: number; y: number } {
  const spec = hlgGridSpec(hull)
  const bridge = design.components.find(component => component.category === 'bridge')
  if (!bridge) return { x: 0, y: hull.shipType === 'destroyer' ? -0.25 : 0.05 }
  return cellToMount(bridge.cell.c, bridge.cell.r, spec)
}

export function rotateFootprint(footprint: HLGFootprint, rotation: HLGRotation): HLGFootprint {
  return rotation === 90 || rotation === 270 ? { w: footprint.h, h: footprint.w } : footprint
}

export function hlgCellIsInsideHull(hull: HullCatalogEntry, cell: HLGCell): boolean {
  const spec = hlgGridSpec(hull)
  const nx = (cell.c + 0.5 - (spec.centerC + 0.5)) / (spec.beamCells / 2)
  const ny = ((cell.r + 0.5 - spec.topR) / Math.max(1, spec.lengthCells - 1)) * 2 - 1
  if (ny < -1 || ny > 1) return false
  return Math.abs(nx) <= hlgHullHalfWidth(ny, hull.shipType)
}

export function hlgCellZones(hull: HullCatalogEntry, cell: HLGCell): HLGZone[] {
  const spec = hlgGridSpec(hull)
  const nx = (cell.c + 0.5 - (spec.centerC + 0.5)) / (spec.beamCells / 2)
  const ny = ((cell.r + 0.5 - spec.topR) / Math.max(1, spec.lengthCells - 1)) * 2 - 1
  const lengthZone: HLGZone = ny < -0.38 ? 'fore' : ny > 0.38 ? 'aft' : 'mid'
  return [lengthZone, Math.abs(nx) > 0.58 ? 'side' : 'deck', 'internal']
}

export function componentRect(component: HLGComponentInstance, part: HLGPartDefinition): { left: number; top: number; w: number; h: number } {
  const footprint = rotateFootprint(part.footprint, component.rotation)
  return {
    left: component.cell.c + 0.5 - footprint.w / 2,
    top: component.cell.r + 0.5 - footprint.h / 2,
    w: footprint.w,
    h: footprint.h,
  }
}

export function makeComponent(part: HLGPartDefinition, cell: HLGCell, rotation: HLGRotation): HLGComponentInstance {
  return {
    instanceId: `${part.partId}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 7)}`,
    partId: part.partId,
    category: part.category,
    cell,
    rotation,
    barrels: part.barrels,
  }
}

export function migrateLegacyDesignerState(hull: HullCatalogEntry, legacy: unknown): HLGDesign {
  const design = defaultHLGDesign(hull)
  if (!legacy || typeof legacy !== 'object') return design
  const record = legacy as { design?: Record<string, string | { weaponId?: string; barrels?: number }>; layout?: { slotCells?: Record<string, HLGCell> } }
  for (const slot of hull.slots) {
    const entry = record.design?.[slot.id]
    const weaponId = typeof entry === 'string' ? entry : entry?.weaponId
    if (!weaponId) continue
    const part = HLG_PART_BY_ID[`part.weapon.${weaponId}`]
    if (!part) continue
    const preferred = record.layout?.slotCells?.[slot.id] ?? legacySlotToCell(hull, slot.x, slot.y)
    const cell = findNearestValidCell(hull, design, part, preferred)
    if (!cell) continue
    design.components.push(makeComponent(part, cell, 0))
  }
  return design
}

function toWeaponPart(weapon: (typeof WEAPON_SHOP)[number]): HLGPartDefinition {
  const meta = WEAPON_META[weapon.id] ?? { weight: Math.max(60, Math.round(weapon.cost * 0.42)), reload: 3, accuracy: 0.75, barrels: defaultBarrelsForType(weapon.type) }
  return {
    partId: `part.weapon.${weapon.id}`,
    name: weapon.name,
    category: 'weapon',
    type: weapon.type,
    footprint: weaponFootprintFor(weapon.id, weapon.type),
    weight: meta.weight,
    cost: weapon.cost,
    allowedShipClasses: shipClassesForWeapon(weapon.id),
    allowedZones: zonesForWeapon(weapon.type),
    barrels: meta.barrels,
    ammo: weapon.ammo,
    firepower: meta.firepower ? meta.firepower * meta.barrels : undefined,
    antiAir: meta.antiAir ? meta.antiAir * meta.barrels : undefined,
    reload: meta.reload,
    accuracy: meta.accuracy,
  }
}

function weaponFootprintFor(id: string, type: WeaponType): HLGFootprint {
  if (type === 'gun') {
    if (id.includes('460mm')) return scaledFootprint(5, 4)
    if (id.includes('406mm')) return scaledFootprint(4, 3)
    if (id.includes('203mm')) return scaledFootprint(3, 3)
    if (id.includes('152mm')) return scaledFootprint(3, 2)
    return scaledFootprint(2, 2)
  }
  if (type === 'secondary') return id.includes('152mm') ? scaledFootprint(3, 2) : scaledFootprint(2, 1)
  if (type === 'torpedo') return id.includes('610mm') ? scaledFootprint(4, 1) : scaledFootprint(3, 1)
  if (type === 'missile') return id.includes('longrange') || id.includes('cruise') ? scaledFootprint(3, 3) : scaledFootprint(2, 2)
  if (type === 'aa') return id.includes('ciws') || id.includes('20mm') ? scaledFootprint(1, 1) : scaledFootprint(2, 2)
  return scaledFootprint(2, 2)
}

function zonesForWeapon(type: WeaponType): HLGZone[] {
  if (type === 'torpedo' || type === 'secondary') return ['fore', 'mid', 'aft', 'deck', 'side']
  if (type === 'aa' || type === 'missile') return ['fore', 'mid', 'aft', 'deck']
  return ['fore', 'mid', 'aft', 'deck']
}

function shipClassesForWeapon(id: string): PlayerShipType[] {
  if (id.includes('.bb') || id.includes('406mm') || id.includes('460mm') || id.includes('battleship')) return ['battleship']
  if (id.includes('.cl') || id.includes('cruiser') || id.includes('203mm')) return ['cruiser', 'battleship']
  return ['destroyer', 'cruiser', 'battleship']
}

function defaultPartsForClass(shipClass: PlayerShipType): Array<{ partId: string; preferred: HLGCell; rotation?: HLGRotation }> {
  if (shipClass === 'destroyer') return [
    { partId: 'part.bridge.dd', preferred: scaledCell(4, 20) },
    { partId: 'part.funnel.small', preferred: scaledCell(4, 26) },
    { partId: 'part.boiler.light', preferred: scaledCell(4, 31) },
    { partId: 'part.turbine.light', preferred: scaledCell(4, 36), rotation: 90 },
    { partId: 'part.weapon.weapon.gun.127mm.twin', preferred: scaledCell(4, 10) },
    { partId: 'part.weapon.weapon.torpedo.533mm.basic', preferred: scaledCell(2, 34), rotation: 90 },
    { partId: 'part.weapon.weapon.aa.20mm.dd', preferred: scaledCell(4, 44) },
  ]
  if (shipClass === 'cruiser') return [
    { partId: 'part.bridge.ca', preferred: scaledCell(5, 28) },
    { partId: 'part.funnel.large', preferred: scaledCell(5, 36) },
    { partId: 'part.boiler.heavy', preferred: scaledCell(5, 44) },
    { partId: 'part.turbine.light', preferred: scaledCell(5, 52), rotation: 90 },
    { partId: 'part.weapon.weapon.gun.203mm', preferred: scaledCell(5, 12) },
    { partId: 'part.weapon.weapon.gun.152mm.twin', preferred: scaledCell(5, 20) },
    { partId: 'part.weapon.weapon.aa.cruiser', preferred: scaledCell(5, 62) },
  ]
  return [
    { partId: 'part.bridge.bb', preferred: scaledCell(8, 40) },
    { partId: 'part.funnel.large', preferred: scaledCell(8, 50) },
    { partId: 'part.boiler.heavy', preferred: scaledCell(8, 60) },
    { partId: 'part.turbine.heavy', preferred: scaledCell(8, 70), rotation: 90 },
    { partId: 'part.weapon.weapon.gun.406mm.twin', preferred: scaledCell(8, 14) },
    { partId: 'part.weapon.weapon.gun.406mm.he', preferred: scaledCell(8, 25) },
    { partId: 'part.weapon.weapon.aa.heavy', preferred: scaledCell(8, 82) },
  ]
}

function findNearestValidCell(hull: HullCatalogEntry, design: HLGDesign, part: HLGPartDefinition, preferred: HLGCell): HLGCell | null {
  const spec = hlgGridSpec(hull)
  const clamped = { c: clamp(preferred.c, 0, spec.cols - 1), r: clamp(preferred.r, 0, spec.rows - 1) }
  const candidates: HLGCell[] = [clamped]
  for (let radius = 1; radius <= 24; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue
        candidates.push({ c: clamped.c + dc, r: clamped.r + dr })
      }
    }
  }
  return candidates.find(cell => canPlaceHLGPart(hull, design, part, cell, 0)) ?? null
}

function blankDesign(hull: HullCatalogEntry): HLGDesign {
  return {
    hullTemplateId: hull.templateId,
    shipClass: hull.shipType,
    gridVersion: HLG_GRID_VERSION,
    armorPlan: { belt: 0, deck: 0, bulkhead: 0 },
    components: [],
  }
}

function scaledFootprint(w: number, h: number): HLGFootprint {
  return { w: w * FOOTPRINT_SCALE - 1, h: h * FOOTPRINT_SCALE - 1 }
}

function scaledCell(c: number, r: number): HLGCell {
  return { c: c * FOOTPRINT_SCALE, r: r * FOOTPRINT_SCALE }
}

function isPlacementInsideHull(hull: HullCatalogEntry, component: HLGComponentInstance, part: HLGPartDefinition): boolean {
  const rect = componentRect(component, part)
  for (let r = Math.floor(rect.top); r < Math.ceil(rect.top + rect.h); r++) {
    for (let c = Math.floor(rect.left); c < Math.ceil(rect.left + rect.w); c++) {
      if (!hlgCellIsInsideHull(hull, { c, r })) return false
    }
  }
  return true
}

function isZoneAllowed(hull: HullCatalogEntry, component: HLGComponentInstance, part: HLGPartDefinition): boolean {
  const rect = componentRect(component, part)
  const hasLengthLimit = part.allowedZones.some(zone => zone === 'fore' || zone === 'mid' || zone === 'aft')
  for (let r = Math.floor(rect.top); r < Math.ceil(rect.top + rect.h); r++) {
    for (let c = Math.floor(rect.left); c < Math.ceil(rect.left + rect.w); c++) {
      const zones = hlgCellZones(hull, { c, r })
      if (hasLengthLimit && !zones.some(zone => (zone === 'fore' || zone === 'mid' || zone === 'aft') && part.allowedZones.includes(zone))) return false
      if (!zones.some(zone => part.allowedZones.includes(zone))) return false
    }
  }
  return true
}

function calculateWeight(design: HLGDesign): number {
  return armorWeight(design) + design.components.reduce((sum, component) => sum + (HLG_PART_BY_ID[component.partId]?.weight ?? 0), 0)
}

function armorWeight(design: HLGDesign): number {
  return (design.armorPlan.belt + design.armorPlan.deck + design.armorPlan.bulkhead) * 18
}

function hlgHullHalfWidth(ny: number, shipClass: PlayerShipType): number {
  const fine = shipClass === 'destroyer' ? 0.82 : shipClass === 'cruiser' ? 0.92 : 1
  if (ny < -0.84) return Math.max(0.02, (ny + 1) / 0.16 * 0.34 * fine)
  if (ny < -0.48) return (0.34 + (ny + 0.84) / 0.36 * 0.66) * fine
  if (ny < 0.54) return (1.0 - Math.abs(ny - 0.02) * 0.06) * fine
  if (ny < 0.86) return (0.94 - (ny - 0.54) / 0.32 * 0.24) * fine
  return (0.70 - (ny - 0.86) / 0.14 * 0.20) * fine
}

function defaultBarrelsForType(type: WeaponType): number {
  if (type === 'torpedo' || type === 'missile') return 4
  if (type === 'aa' || type === 'secondary') return 2
  return 1
}

function propulsionTarget(shipClass: PlayerShipType): number {
  return shipClass === 'destroyer' ? 70 : shipClass === 'cruiser' ? 130 : 190
}

function rectsOverlap(a: { left: number; top: number; w: number; h: number }, b: { left: number; top: number; w: number; h: number }): boolean {
  return a.left < b.left + b.w && a.left + a.w > b.left && a.top < b.top + b.h && a.top + a.h > b.top
}

function componentsBlockEachOther(a: HLGComponentInstance, b: HLGComponentInstance): boolean {
  return componentLayer(a) === componentLayer(b)
}

function componentLayer(component: HLGComponentInstance): 'internal' | 'deck' {
  return component.category === 'boiler' || component.category === 'turbine' ? 'internal' : 'deck'
}

function legacySlotToCell(hull: HullCatalogEntry, x: number, y: number): HLGCell {
  const spec = hlgGridSpec(hull)
  return {
    c: Math.round(spec.centerC + x * (spec.beamCells / 2) * 0.92),
    r: Math.round(spec.topR + ((y + 1) / 2) * (spec.lengthCells - 1)),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function makeOdd(value: number): number {
  return value % 2 === 0 ? value + 1 : value
}
