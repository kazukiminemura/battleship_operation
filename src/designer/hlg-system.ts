import { DESIGN_CELL_METERS, normalizedMountHeight } from '../game/data/gun-mount-geometry'
import { barrelsInterfere, gunClearance, componentGunGeometry } from './gun-clearance'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import type { PlayerShipType, WeaponTemplate } from '../game/data/masterdata'
import { MAX_WEAPON_SLOTS, type WeaponType } from '../game/simulation/types'
import { WEAPON_SHOP } from '../game/data/weapon-shop'
import { firingArcForWeapon } from '../game/simulation/firing-arcs'
import { getDefaultLoadout } from '../game/data/weapon-catalog'
import type { DesignedWeapon, ShipDesignLayout } from '../game/data/ship-design-layout'

export type HLGComponentCategory = 'weapon' | 'bridge' | 'funnel' | 'boiler' | 'turbine' | 'aux' | 'armor'
export type HLGZone = 'fore' | 'mid' | 'aft' | 'side' | 'deck' | 'internal'
export type HLGRotation = 0 | 90 | 180 | 270
export type HLGCell = { c: number; r: number }
export type HLGFootprint = { w: number; h: number }
export type ArmorDefenseKey = 'none' | '10cm' | '12cm' | '14cm' | '15cm' | '20cm' | '25cm' | '31cm' | '36cm' | '38cm' | '41cm' | '43cm' | '46cm' | '51cm' | '56cm' | '61cm'

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
  provides?: Partial<Record<'power' | 'smokeExhaust' | 'command' | 'aaControl' | 'accuracyAssist', number>>
}

export interface HLGComponentInstance {
  instanceId: string
  partId: string
  category: HLGComponentCategory
  cell: HLGCell
  rotation: HLGRotation
  barrels?: number
  weaponSlot?: number
  mountHeight?: number
}

export interface HLGDesign {
  hullTemplateId: string
  shipClass: PlayerShipType
  gridVersion: number
  armorPlan: { belt: number | ArmorDefenseKey; deck: number | ArmorDefenseKey; bulkhead: number }
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
  boilerPowerProvided: number
  turbinePowerRequired: number
  turbinePowerProvided: number
  auxPowerRequired: number
  smokeRequired: number
  smokeProvided: number
  command: number
  armorDefense: number
  deckDefense: number
  underwaterDefense: number
  armorWeight: number
  vitalPartRatio: number
  defenseScheme: '集中防御' | '完全防御'
  beltArmorLabel: string
  deckArmorLabel: string
  warnings: string[]
  canDeploy: boolean
}

export interface ArmorDefenseOption {
  key: ArmorDefenseKey
  label: string
  armorDefense: number
  underwaterDefense: number
  weightAtFullVp: number
}

const GRID_CELL_METERS = DESIGN_CELL_METERS
const GRID_MARGIN_CELLS = 2
const HLG_GRID_VERSION = 3
const FOOTPRINT_SCALE = 2
const MAX_WEIGHT: Record<PlayerShipType, number> = {
  destroyer: 3500,
  cruiser: 10000,
  battleship: 30000,
}

export const ARMOR_DEFENSE_OPTIONS: ArmorDefenseOption[] = [
  { key: '61cm', label: '対61cm', armorDefense: 90, underwaterDefense: 65, weightAtFullVp: 30000 },
  { key: '56cm', label: '対56cm', armorDefense: 83, underwaterDefense: 50, weightAtFullVp: 24000 },
  { key: '51cm', label: '対51cm', armorDefense: 77, underwaterDefense: 40, weightAtFullVp: 18000 },
  { key: '46cm', label: '対46cm', armorDefense: 70, underwaterDefense: 30, weightAtFullVp: 13000 },
  { key: '43cm', label: '対43cm', armorDefense: 58, underwaterDefense: 28, weightAtFullVp: 9000 },
  { key: '41cm', label: '対41cm', armorDefense: 47, underwaterDefense: 26, weightAtFullVp: 7000 },
  { key: '38cm', label: '対38cm', armorDefense: 38, underwaterDefense: 25, weightAtFullVp: 5000 },
  { key: '36cm', label: '対36cm', armorDefense: 30, underwaterDefense: 24, weightAtFullVp: 3500 },
  { key: '31cm', label: '対31cm', armorDefense: 25, underwaterDefense: 23, weightAtFullVp: 2000 },
  { key: '25cm', label: '対25cm', armorDefense: 20, underwaterDefense: 22, weightAtFullVp: 1000 },
  { key: '20cm', label: '対20cm', armorDefense: 15, underwaterDefense: 21, weightAtFullVp: 500 },
  { key: '15cm', label: '対15cm', armorDefense: 10, underwaterDefense: 20, weightAtFullVp: 250 },
  { key: '14cm', label: '対14cm', armorDefense: 8, underwaterDefense: 20, weightAtFullVp: 100 },
  { key: '12cm', label: '対12cm', armorDefense: 6, underwaterDefense: 20, weightAtFullVp: 80 },
  { key: '10cm', label: '対10cm', armorDefense: 3, underwaterDefense: 20, weightAtFullVp: 40 },
  { key: 'none', label: '無防御', armorDefense: 1, underwaterDefense: 10, weightAtFullVp: 0 },
]

const ARMOR_OPTION_BY_KEY: Record<ArmorDefenseKey, ArmorDefenseOption> = Object.fromEntries(ARMOR_DEFENSE_OPTIONS.map(option => [option.key, option])) as Record<ArmorDefenseKey, ArmorDefenseOption>

const WEAPON_META: Record<string, { weight: number; firepower?: number; antiAir?: number; reload: number; accuracy: number; barrels: number }> = {
  'weapon.gun.127mm.twin': { weight: 300, firepower: 20, reload: 7, accuracy: 0.80, barrels: 2 },
  'weapon.gun.127mm.ap': { weight: 360, firepower: 27, reload: 7.5, accuracy: 0.76, barrels: 2 },
  'weapon.gun.152mm.twin': { weight: 520, firepower: 38, reload: 10, accuracy: 0.78, barrels: 2 },
  'weapon.gun.203mm': { weight: 850, firepower: 65, reload: 15, accuracy: 0.75, barrels: 1 },
  'weapon.gun.406mm.twin': { weight: 1600, firepower: 105, reload: 32, accuracy: 0.72, barrels: 2 },
  'weapon.gun.406mm.he': { weight: 1550, firepower: 96, reload: 30, accuracy: 0.70, barrels: 2 },
  'weapon.gun.460mm': { weight: 2400, firepower: 145, reload: 40, accuracy: 0.70, barrels: 1 },
  'weapon.gun.508mm.long': { weight: 3200, firepower: 185, reload: 48, accuracy: 0.68, barrels: 1 },
  'weapon.gun.610mm.long': { weight: 4200, firepower: 240, reload: 58, accuracy: 0.64, barrels: 1 },
  'weapon.gun.800mm.super': { weight: 6800, firepower: 330, reload: 78, accuracy: 0.58, barrels: 1 },
  'weapon.gun.1000mm.hyper': { weight: 9800, firepower: 420, reload: 95, accuracy: 0.52, barrels: 1 },
  'weapon.gun.rail.ultimate': { weight: 2600, firepower: 185, reload: 18, accuracy: 0.96, barrels: 1 },
  'weapon.gun.particle': { weight: 3800, firepower: 250, reload: 24, accuracy: 0.92, barrels: 1 },
  'weapon.gun.wave': { weight: 11000, firepower: 620, reload: 120, accuracy: 0.50, barrels: 1 },
  'weapon.secondary.127mm.twin': { weight: 200, firepower: 14, antiAir: 18, reload: 5, accuracy: 0.82, barrels: 2 },
  'weapon.secondary.100mm.cl': { weight: 180, firepower: 11, antiAir: 32, reload: 4, accuracy: 0.85, barrels: 2 },
  'weapon.secondary.152mm.twin': { weight: 600, firepower: 48, antiAir: 8, reload: 8, accuracy: 0.76, barrels: 2 },
  'weapon.secondary.127mm.bb': { weight: 260, firepower: 18, antiAir: 20, reload: 5, accuracy: 0.82, barrels: 2 },
  'weapon.secondary.pulse.30mm': { weight: 140, firepower: 10, antiAir: 44, reload: 0.7, accuracy: 0.92, barrels: 4 },
  'weapon.secondary.gatling.203mm': { weight: 720, firepower: 38, antiAir: 16, reload: 2.4, accuracy: 0.72, barrels: 4 },
  'weapon.secondary.vulcan.88mm': { weight: 280, firepower: 16, antiAir: 42, reload: 1.2, accuracy: 0.78, barrels: 2 },
  'weapon.secondary.127mm.rapid': { weight: 260, firepower: 20, antiAir: 24, reload: 3.8, accuracy: 0.86, barrels: 1 },
  'weapon.secondary.155mm.ags': { weight: 520, firepower: 48, antiAir: 12, reload: 5.5, accuracy: 0.88, barrels: 1 },
  'weapon.secondary.neutrino': { weight: 900, firepower: 42, antiAir: 54, reload: 2.2, accuracy: 0.95, barrels: 1 },
  'weapon.torpedo.533mm.basic': { weight: 120, firepower: 80, reload: 75, accuracy: 0.88, barrels: 4 },
  'weapon.torpedo.610mm.dd': { weight: 200, firepower: 135, reload: 80, accuracy: 0.85, barrels: 4 },
  'weapon.torpedo.610mm.cl': { weight: 240, firepower: 145, reload: 85, accuracy: 0.84, barrels: 4 },
  'weapon.torpedo.610mm.bb': { weight: 280, firepower: 160, reload: 90, accuracy: 0.83, barrels: 4 },
  'weapon.torpedo.1000mm.oxygen': { weight: 620, firepower: 280, reload: 120, accuracy: 0.72, barrels: 2 },
  'weapon.torpedo.supersonic': { weight: 360, firepower: 150, reload: 65, accuracy: 0.94, barrels: 2 },
  'weapon.torpedo.photon': { weight: 520, firepower: 240, reload: 90, accuracy: 0.92, barrels: 2 },
  'weapon.torpedo.quantum': { weight: 700, firepower: 320, reload: 110, accuracy: 0.90, barrels: 2 },
  'weapon.aa.20mm.dd': { weight: 30, antiAir: 30, reload: 0.4, accuracy: 0.70, barrels: 2 },
  'weapon.aa.cruiser': { weight: 65, antiAir: 50, reload: 0.8, accuracy: 0.72, barrels: 2 },
  'weapon.aa.heavy': { weight: 120, antiAir: 72, reload: 1.5, accuracy: 0.75, barrels: 2 },
  'weapon.aa.sam.cl': { weight: 150, antiAir: 95, reload: 10, accuracy: 0.88, barrels: 2 },
  'weapon.aa.ciws.bb': { weight: 90, antiAir: 65, reload: 0.2, accuracy: 0.68, barrels: 2 },
  'weapon.aa.photon.ciws': { weight: 180, antiAir: 130, reload: 0.1, accuracy: 0.98, barrels: 4 },
  'weapon.aa.allround.30mm': { weight: 95, antiAir: 78, reload: 0.45, accuracy: 0.82, barrels: 4 },
  'weapon.aa.57mm.vulcan': { weight: 150, antiAir: 86, reload: 0.65, accuracy: 0.80, barrels: 2 },
  'weapon.aa.pulse-laser': { weight: 260, antiAir: 155, reload: 0.18, accuracy: 0.97, barrels: 1 },
  'weapon.missile.antiship.dd': { weight: 160, firepower: 90, reload: 30, accuracy: 0.92, barrels: 4 },
  'weapon.missile.sam.dd': { weight: 90, antiAir: 85, reload: 12, accuracy: 0.90, barrels: 4 },
  'weapon.missile.cruiser.standard': { weight: 220, firepower: 110, reload: 28, accuracy: 0.91, barrels: 4 },
  'weapon.missile.cruise.cl': { weight: 320, firepower: 150, reload: 45, accuracy: 0.88, barrels: 2 },
  'weapon.missile.battleship.longrange': { weight: 350, firepower: 160, reload: 40, accuracy: 0.88, barrels: 4 },
  'weapon.missile.antiship.bb': { weight: 300, firepower: 140, reload: 32, accuracy: 0.90, barrels: 4 },
  'weapon.missile.dimension': { weight: 520, firepower: 260, reload: 55, accuracy: 0.99, barrels: 2 },
  'weapon.missile.vls.multiwarhead': { weight: 420, firepower: 180, antiAir: 70, reload: 36, accuracy: 0.93, barrels: 4 },
  'weapon.missile.vls.special': { weight: 520, firepower: 260, reload: 52, accuracy: 0.90, barrels: 2 },
  'weapon.missile.large': { weight: 680, firepower: 300, reload: 65, accuracy: 0.86, barrels: 1 },
  'weapon.missile.rocket.20cm': { weight: 260, firepower: 88, antiAir: 18, reload: 12, accuracy: 0.66, barrels: 12 },
}

const INSPIRED_BRIDGE_PARTS: HLGPartDefinition[] = [
  { partId: 'part.bridge.dd.front.jp', name: '駆逐前艦橋（日）', category: 'bridge', footprint: scaledFootprint(3, 3), weight: 210, cost: 520, allowedShipClasses: ['destroyer'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 1, aaControl: 1 } },
  { partId: 'part.bridge.dd.rear.us', name: '駆逐後艦橋（米）', category: 'bridge', footprint: scaledFootprint(3, 2), weight: 170, cost: 460, allowedShipClasses: ['destroyer'], allowedZones: ['mid', 'aft', 'deck'], provides: { command: 1 } },
  { partId: 'part.bridge.ca.front.uk', name: '巡洋前艦橋（英）', category: 'bridge', footprint: scaledFootprint(4, 4), weight: 560, cost: 980, allowedShipClasses: ['cruiser'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 2, aaControl: 2 } },
  { partId: 'part.bridge.ca.rear.de', name: '巡洋後艦橋（独）', category: 'bridge', footprint: scaledFootprint(4, 3), weight: 430, cost: 820, allowedShipClasses: ['cruiser'], allowedZones: ['mid', 'aft', 'deck'], provides: { command: 1, aaControl: 1 } },
  { partId: 'part.bridge.bb.front.jp', name: '戦艦前艦橋（日）', category: 'bridge', footprint: scaledFootprint(5, 5), weight: 980, cost: 1600, allowedShipClasses: ['battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 3, aaControl: 2 } },
  { partId: 'part.bridge.bb.front.us', name: '戦艦前艦橋（米）', category: 'bridge', footprint: scaledFootprint(5, 4), weight: 940, cost: 1550, allowedShipClasses: ['battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 3, aaControl: 3 } },
  { partId: 'part.bridge.bb.rear.uk', name: '戦艦後艦橋（英）', category: 'bridge', footprint: scaledFootprint(4, 4), weight: 720, cost: 1200, allowedShipClasses: ['battleship'], allowedZones: ['mid', 'aft', 'deck'], provides: { command: 2, aaControl: 1 } },
]

const INSPIRED_AUX_PARTS: HLGPartDefinition[] = [
  { partId: 'part.aux.em-barrier', name: '電磁防壁III', category: 'aux', footprint: scaledFootprint(3, 3), weight: 480, cost: 1300, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'internal'], requires: { power: 35 }, provides: { command: 1 } },
  { partId: 'part.aux.radio-sight', name: '電波照準儀VI', category: 'aux', footprint: scaledFootprint(2, 2), weight: 120, cost: 620, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { aaControl: 1, accuracyAssist: 0.08 } },
  { partId: 'part.aux.radio-jammer', name: '電波妨害装置VI', category: 'aux', footprint: scaledFootprint(2, 2), weight: 150, cost: 720, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['mid', 'deck'], requires: { power: 12 }, provides: { aaControl: 1 } },
  { partId: 'part.aux.sonar', name: '新型探信儀', category: 'aux', footprint: scaledFootprint(2, 2), weight: 110, cost: 780, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'internal'], provides: { command: 1 } },
  { partId: 'part.aux.fire-delay', name: '発砲遅延装置γ', category: 'aux', footprint: scaledFootprint(2, 2), weight: 130, cost: 760, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['mid', 'internal'], provides: { accuracyAssist: 0.06 } },
  { partId: 'part.aux.autoload.gamma', name: '自動装填装置γ', category: 'aux', footprint: scaledFootprint(3, 3), weight: 360, cost: 1200, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 28 }, provides: { command: 1 } },
  { partId: 'part.aux.damage-control', name: '自動消火装置VI', category: 'aux', footprint: scaledFootprint(2, 2), weight: 160, cost: 520, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['mid', 'internal'], provides: { command: 1 } },
  { partId: 'part.aux.flood-control', name: '応急注排水装置VI', category: 'aux', footprint: scaledFootprint(2, 2), weight: 180, cost: 560, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['mid', 'internal'], provides: { command: 1 } },
  { partId: 'part.aux.convergence', name: '収束強化装置γ', category: 'aux', footprint: scaledFootprint(3, 3), weight: 420, cost: 1600, allowedShipClasses: ['battleship'], allowedZones: ['mid', 'internal'], requires: { power: 45 }, provides: { accuracyAssist: 0.16 } },
  { partId: 'part.aux.aegis', name: '超イージスシステム', category: 'aux', footprint: scaledFootprint(3, 3), weight: 260, cost: 1800, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], requires: { power: 24 }, provides: { aaControl: 4, accuracyAssist: 0.10 } },
  { partId: 'part.aux.burst-control', name: 'バースト射撃装置', category: 'aux', footprint: scaledFootprint(2, 2), weight: 220, cost: 1100, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'internal'], requires: { power: 18 }, provides: { accuracyAssist: 0.10 } },
  { partId: 'part.aux.ammo-magazine', name: '補助弾薬庫', category: 'aux', footprint: scaledFootprint(3, 2), weight: 520, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'internal'] },
  { partId: 'part.aux.thruster', name: 'バウスラスター', category: 'aux', footprint: scaledFootprint(3, 2), weight: 260, cost: 850, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['fore', 'internal'], requires: { power: 22 } },
  { partId: 'part.aux.steering', name: '新型操舵装置', category: 'aux', footprint: scaledFootprint(2, 2), weight: 180, cost: 820, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['aft', 'internal'], requires: { power: 10 }, provides: { command: 1 } },
  { partId: 'part.aux.optical-camo', name: '光学迷彩装置', category: 'aux', footprint: scaledFootprint(4, 3), weight: 620, cost: 2200, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'internal'], requires: { power: 65 }, provides: { command: 1 } },
  { partId: 'part.aux.satellite-vision', name: '衛星視界装置', category: 'aux', footprint: scaledFootprint(3, 3), weight: 340, cost: 2000, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], requires: { power: 32 }, provides: { aaControl: 2, accuracyAssist: 0.18 } },
  { partId: 'part.aux.infinite-loader', name: '無限装填装置', category: 'aux', footprint: scaledFootprint(4, 3), weight: 760, cost: 2600, allowedShipClasses: ['battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 70 }, provides: { command: 2 } },
]

export const HLG_PARTS: HLGPartDefinition[] = [
  ...WEAPON_SHOP.map(toWeaponPart),
  { partId: 'part.bridge.dd', name: '小型艦橋', category: 'bridge', footprint: scaledFootprint(3, 3), weight: 180, cost: 400, allowedShipClasses: ['destroyer', 'cruiser'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 1 } },
  { partId: 'part.bridge.ca', name: '大型艦橋', category: 'bridge', footprint: scaledFootprint(4, 4), weight: 520, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 2, aaControl: 1 } },
  { partId: 'part.bridge.bb', name: '戦艦艦橋', category: 'bridge', footprint: scaledFootprint(5, 5), weight: 900, cost: 1400, allowedShipClasses: ['battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 3, aaControl: 2 } },
  ...INSPIRED_BRIDGE_PARTS,
  { partId: 'part.funnel.small', name: '小型煙突', category: 'funnel', footprint: scaledFootprint(2, 2), weight: 90, cost: 180, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'deck'], provides: { smokeExhaust: 35 } },
  { partId: 'part.funnel.large', name: '大型煙突', category: 'funnel', footprint: scaledFootprint(3, 3), weight: 220, cost: 360, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'deck'], provides: { smokeExhaust: 75 } },
  { partId: 'part.boiler.light', name: '軽量ボイラー', category: 'boiler', footprint: scaledFootprint(3, 3), weight: 420, cost: 500, allowedShipClasses: ['destroyer', 'cruiser'], allowedZones: ['mid', 'aft', 'internal'], requires: { funnelCapacity: 25 }, provides: { power: 55 } },
  { partId: 'part.boiler.heavy', name: '重油専焼ボイラー', category: 'boiler', footprint: scaledFootprint(4, 4), weight: 900, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { funnelCapacity: 45 }, provides: { power: 110 } },
  { partId: 'part.turbine.light', name: '軽量タービン', category: 'turbine', footprint: scaledFootprint(3, 2), weight: 360, cost: 500, allowedShipClasses: ['destroyer', 'cruiser'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 30 }, provides: { power: 20 } },
  { partId: 'part.turbine.heavy', name: '大出力タービン', category: 'turbine', footprint: scaledFootprint(4, 3), weight: 780, cost: 900, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 60 }, provides: { power: 45 } },
  { partId: 'part.aux.radar', name: '射撃管制レーダー', category: 'aux', footprint: scaledFootprint(2, 2), weight: 80, cost: 350, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { aaControl: 1 } },
  { partId: 'part.aux.perfect-aim', name: '必中演算装置', category: 'aux', footprint: scaledFootprint(3, 2), weight: 240, cost: 1800, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { command: 1, aaControl: 2, accuracyAssist: 1.0 } },
  { partId: 'part.aux.fantasy-radar', name: '超越照準レーダー', category: 'aux', footprint: scaledFootprint(3, 3), weight: 180, cost: 1200, allowedShipClasses: ['destroyer', 'cruiser', 'battleship'], allowedZones: ['fore', 'mid', 'deck'], provides: { aaControl: 3, accuracyAssist: 0.18 } },
  { partId: 'part.aux.gravity-stabilizer', name: '重力安定装置', category: 'aux', footprint: scaledFootprint(4, 3), weight: 520, cost: 1600, allowedShipClasses: ['cruiser', 'battleship'], allowedZones: ['mid', 'internal'], requires: { power: 40 }, provides: { accuracyAssist: 0.12 } },
  { partId: 'part.aux.auto-loader', name: '無限装填補助機', category: 'aux', footprint: scaledFootprint(3, 3), weight: 420, cost: 1500, allowedShipClasses: ['battleship'], allowedZones: ['mid', 'aft', 'internal'], requires: { power: 35 }, provides: { command: 1 } },
  ...INSPIRED_AUX_PARTS,
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
    const preferred = { c: spec.centerC, r: Math.round(spec.topR - .5 + (item.y + 1) * (spec.lengthCells - 1) / 2) }
    const cell = findNearestValidCell(hull, { ...blankDesign(hull), components }, part, preferred, item.rotation ?? 0)
    if (!cell) continue
    components.push(makeComponent(part, cell, item.rotation ?? 0, nextAvailableWeaponSlot(components)))
  }
  addStandardWeapons(hull, spec, components)
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
  cloned.components = cloned.components.map(component => component.mountHeight === undefined ? component : ({ ...component, mountHeight: normalizedMountHeight(component.mountHeight) }))
  cloned.armorPlan = normalizeArmorPlan(cloned.armorPlan)
  if (cloned.gridVersion === HLG_GRID_VERSION) return { ...cloned, components: normalizeWeaponSlots(cloned.components) }
  const spec = hlgGridSpec(hull)
  const coordinateScale = cloned.gridVersion < 2 ? FOOTPRINT_SCALE : 1
  return {
    ...cloned,
    gridVersion: HLG_GRID_VERSION,
    components: normalizeWeaponSlots(cloned.components.map(component => ({
      ...component,
      cell: {
        c: clamp(Math.round(component.cell.c * coordinateScale), 0, spec.cols - 1),
        r: clamp(Math.round(component.cell.r * coordinateScale), 0, spec.rows - 1),
      },
    }))),
  }
}

export function calculateHLGStats(hull: HullCatalogEntry, design: HLGDesign): HLGStats {
  const warnings = validateHLGDesign(hull, design)
  const armor = calculateArmorStats(hull, design)
  let totalWeight = armor.weight
  let totalFirepower = 0
  let totalAntiAir = 0
  let accuracySum = 0
  let weaponCount = 0
  let powerProvided = 0
  let powerRequired = 0
  let boilerPowerProvided = 0
  let turbinePowerRequired = 0
  let turbinePowerProvided = 0
  let auxPowerRequired = 0
  let smokeProvided = 0
  let smokeRequired = 0
  let command = 0
  let accuracyAssist = 0

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
    accuracyAssist = Math.max(accuracyAssist, part.provides?.accuracyAssist ?? 0)
    powerRequired += part.requires?.power ?? 0
    smokeRequired += part.requires?.funnelCapacity ?? 0
    if (part.category === 'boiler') boilerPowerProvided += part.provides?.power ?? 0
    if (part.category === 'turbine') {
      turbinePowerRequired += part.requires?.power ?? 0
      turbinePowerProvided += part.provides?.power ?? 0
    } else {
      auxPowerRequired += part.requires?.power ?? 0
    }
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
    avgAccuracy: weaponCount ? Math.min(1, accuracyAssist >= 1 ? 1 : accuracySum / weaponCount + accuracyAssist) : 0,
    speed,
    turnRate,
    powerRequired,
    powerProvided,
    boilerPowerProvided,
    turbinePowerRequired,
    turbinePowerProvided,
    auxPowerRequired,
    smokeRequired,
    smokeProvided,
    command,
    armorDefense: armor.belt.armorDefense,
    deckDefense: armor.deck.armorDefense,
    underwaterDefense: armor.belt.underwaterDefense,
    armorWeight: armor.weight,
    vitalPartRatio: armor.vitalPartRatio,
    defenseScheme: armor.defenseScheme,
    beltArmorLabel: armor.belt.label,
    deckArmorLabel: armor.deck.label,
    warnings: [...systemWarnings, ...warnings],
    canDeploy: systemWarnings.length === 0 && warnings.length === 0,
  }
}

export function validateHLGDesign(hull: HullCatalogEntry, design: HLGDesign): string[] {
  const warnings: string[] = []
  const placements = design.components
    .map(component => ({ component, part: HLG_PART_BY_ID[component.partId] }))
    .filter((item): item is { component: HLGComponentInstance; part: HLGPartDefinition } => !!item.part)
  const weaponCount = placements.filter(({ part }) => !!part.type).length
  const weaponSlots = new Map<number, string>()
  for (const { component, part } of placements) {
    if (!part.type) continue
    const slot = component.weaponSlot
    if (slot == null || slot < 0 || slot >= MAX_WEAPON_SLOTS) {
      warnings.push(`${part.name}の兵装スロットが不正です`)
      continue
    }
    const slotPart = weaponSlots.get(slot)
    if (slotPart && slotPart !== part.partId) warnings.push(`兵装スロット${slot + 1}に複数種類の兵装があります`)
    weaponSlots.set(slot, part.partId)
  }
  for (const { component, part } of placements) {
    if (!part.allowedShipClasses.includes(hull.shipType)) warnings.push(`${part.name}はこの艦種に搭載できません`)
    if (!isPlacementInsideHull(hull, component, part)) warnings.push(`${part.name}が船体外にはみ出しています`)
    if (!isZoneAllowed(hull, component, part)) warnings.push(`${part.name}の配置区画が不正です`)
  }
  const clearances = placements.map(({ component, part }) => gunClearance(component, part))
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i]!
    const aRect = componentRect(a.component, a.part)
    const aClearance = clearances[i]!
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j]!
      if (barrelsInterfere(aClearance, clearances[j]!)) {
        warnings.push(`${a.part.name}と${b.part.name}の砲身が干渉しています（砲台高・向き・位置を変更）`)
      }
      if (componentsBlockEachOther(a.component, b.component) && rectsOverlap(aRect, componentRect(b.component, b.part))) {
        warnings.push(`${a.part.name}と${b.part.name}が重なっています`)
      }
    }
  }
  return [...new Set(warnings)]
}

export function canPlaceHLGPart(hull: HullCatalogEntry, design: HLGDesign, part: HLGPartDefinition, cell: HLGCell, rotation: HLGRotation, weaponSlot?: number, mountHeight = 0, barrels = part.barrels): boolean {
  const component = { ...makeComponent(part, cell, rotation, weaponSlot), mountHeight, barrels }
  const temp = { ...design, components: [...design.components, component] }
  return validateHLGDesign(hull, temp).length === 0 && calculateWeight(hull, temp) <= MAX_WEIGHT[hull.shipType]
}

export function hlgDesignToLoadout(hull: HullCatalogEntry, design: HLGDesign): WeaponTemplate[] {
  const spec = hlgGridSpec(hull)
  const slots = weaponSlotGroups(design)
  return slots.flatMap(group => {
    const first = group.components[0]
    const part = HLG_PART_BY_ID[group.partId]
    if (!first || !part?.type) return []
    const mounts = group.components.map(component => {
      const mount = cellToMount(component.cell.c, component.cell.r, spec)
      return {
        instanceId: component.instanceId,
        mount,
        firingArc: firingArcForWeapon(part.type!, mount),
        barrels: component.barrels ?? part.barrels,
        mountHeight: normalizedMountHeight(component.mountHeight),
      }
    })
    return [{
      id: part.partId.replace('part.weapon.', ''),
      name: `S${group.slot + 1} ${part.name}`,
      type: part.type,
      ammo: (part.ammo ?? 100) * Math.max(1, mounts.length),
      barrels: first.barrels ?? part.barrels,
      mount: mounts[0]?.mount,
      firingArc: mounts[0]?.firingArc,
      mounts,
      instanceId: `slot.${group.slot}`,
    }]
  })
}

export function previewWeaponsFromHLG(hull: HullCatalogEntry, design: HLGDesign): DesignedWeapon[] {
  const spec = hlgGridSpec(hull)
  return design.components.flatMap(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part?.type) return []
    return [{
      id: part.partId.replace('part.weapon.', ''),
      name: part.name,
      type: part.type,
      mount: cellToMount(component.cell.c, component.cell.r, spec),
      instanceId: component.instanceId,
      rotation: component.rotation,
      mountHeight: normalizedMountHeight(component.mountHeight),
      gunGeometry: componentGunGeometry(part),
      designDimensions: { length: spec.lengthM, beam: spec.beamM },
      barrels: component.barrels ?? part.barrels,
      selected: false,
    }]
  })
}

export function designLayoutFromHLG(hull: HullCatalogEntry, design: HLGDesign): ShipDesignLayout {
  const spec = hlgGridSpec(hull)
  return {
    weapons: previewWeaponsFromHLG(hull, design),
    structures: design.components.flatMap(component => {
      const part = HLG_PART_BY_ID[component.partId]
      if (!part || component.category === 'weapon') return []
      return [{
        instanceId: component.instanceId, partId: part.partId, name: part.name,
        category: component.category, mount: cellToMount(component.cell.c, component.cell.r, spec),
        rotation: component.rotation,
        footprint: { length: part.footprint.h / spec.lengthCells, beam: part.footprint.w / spec.beamCells },
        internal: part.category === 'boiler' || part.category === 'turbine' || part.category === 'armor' || part.allowedZones.includes('internal'),
      }]
    }),
  }
}

function addStandardWeapons(hull: HullCatalogEntry, spec: HLGGridSpec, components: HLGComponentInstance[]): void {
  for (const [slot, weapon] of getDefaultLoadout(hull.shipType).entries()) {
    const part = HLG_PART_BY_ID[`part.weapon.${weapon.id}`]
    if (!part) throw new Error(`Unknown standard weapon: ${weapon.id}`)
    for (const entry of weapon.mounts ?? []) {
      const mount = entry.mount!
      const preferred = { c: Math.round(spec.centerC + mount.x * spec.beamCells / 2), r: Math.round(spec.topR - .5 + (mount.y + 1) * (spec.lengthCells - 1) / 2) }
      const rotation: HLGRotation = mount.x < -.2 ? 270 : mount.x > .2 ? 90 : mount.y > .5 ? 180 : 0
      const cell = findNearestValidCell(hull, { ...blankDesign(hull), components }, part, preferred, rotation, slot)
      if (!cell) throw new Error(`Standard armament does not fit ${hull.templateId}: ${part.name}`)
      components.push({ ...makeComponent(part, cell, rotation, slot), barrels: entry.barrels })
    }
  }
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

export function makeComponent(part: HLGPartDefinition, cell: HLGCell, rotation: HLGRotation, weaponSlot?: number): HLGComponentInstance {
  return {
    instanceId: `${part.partId}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 7)}`,
    partId: part.partId,
    category: part.category,
    cell,
    rotation,
    barrels: part.barrels,
    weaponSlot: part.type ? clamp(Math.round(weaponSlot ?? 0), 0, MAX_WEAPON_SLOTS - 1) : undefined,
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
  const meta = WEAPON_META[weapon.id] ?? { weight: Math.max(60, Math.round(weapon.cost * 0.42)), reload: defaultReloadForType(weapon.type), accuracy: 0.75, barrels: defaultBarrelsForType(weapon.type) }
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
    if (id.includes('wave')) return scaledFootprint(9, 5)
    if (id.includes('1000mm')) return scaledFootprint(8, 5)
    if (id.includes('800mm')) return scaledFootprint(7, 5)
    if (id.includes('610mm')) return scaledFootprint(6, 4)
    if (id.includes('508mm') || id.includes('particle')) return scaledFootprint(5, 4)
    if (id.includes('rail')) return scaledFootprint(5, 2)
    if (id.includes('460mm')) return scaledFootprint(5, 4)
    if (id.includes('406mm')) return scaledFootprint(4, 3)
    if (id.includes('203mm')) return scaledFootprint(3, 3)
    if (id.includes('152mm')) return scaledFootprint(3, 2)
    return scaledFootprint(2, 2)
  }
  if (type === 'secondary') return id.includes('203mm') || id.includes('neutrino') ? scaledFootprint(3, 2) : id.includes('152mm') || id.includes('155mm') ? scaledFootprint(3, 2) : id.includes('pulse') ? scaledFootprint(2, 2) : scaledFootprint(2, 1)
  if (type === 'torpedo') return id.includes('1000mm') || id.includes('quantum') || id.includes('photon') ? scaledFootprint(5, 1) : id.includes('610mm') ? scaledFootprint(4, 1) : scaledFootprint(3, 1)
  if (type === 'missile') return id.includes('large') || id.includes('dimension') ? scaledFootprint(4, 4) : id.includes('multiwarhead') || id.includes('special') || id.includes('longrange') || id.includes('cruise') ? scaledFootprint(3, 3) : id.includes('rocket') ? scaledFootprint(3, 2) : scaledFootprint(2, 2)
  if (type === 'aa') return id.includes('ciws') || id.includes('20mm') || id.includes('allround') ? scaledFootprint(1, 1) : scaledFootprint(2, 2)
  return scaledFootprint(2, 2)
}

function zonesForWeapon(type: WeaponType): HLGZone[] {
  if (type === 'torpedo' || type === 'secondary') return ['fore', 'mid', 'aft', 'deck', 'side']
  if (type === 'aa' || type === 'missile') return ['fore', 'mid', 'aft', 'deck']
  return ['fore', 'mid', 'aft', 'deck']
}

function shipClassesForWeapon(id: string): PlayerShipType[] {
  if (id.includes('.bb') || id.includes('406mm') || id.includes('460mm') || id.includes('508mm') || id.includes('610mm.long') || id.includes('800mm') || id.includes('1000mm') || id.includes('wave') || id.includes('particle') || id.includes('rail') || id.includes('dimension') || id.includes('battleship')) return ['battleship']
  if (id.includes('.cl') || id.includes('cruiser') || id.includes('203mm') || id.includes('155mm') || id.includes('large') || id.includes('multiwarhead') || id.includes('special') || id.includes('neutrino')) return ['cruiser', 'battleship']
  return ['destroyer', 'cruiser', 'battleship']
}

function defaultPartsForClass(shipClass: PlayerShipType): Array<{ partId: string; y: number; rotation?: HLGRotation }> {
  const dd = shipClass === 'destroyer'
  return [
    { partId: `part.bridge.${dd ? 'dd' : shipClass === 'cruiser' ? 'ca' : 'bb'}`, y: -.12 },
    { partId: `part.funnel.${dd ? 'small' : 'large'}`, y: dd ? -.05 : .15 },
    { partId: `part.boiler.${dd ? 'light' : 'heavy'}`, y: .13 },
    { partId: `part.turbine.${shipClass === 'battleship' ? 'heavy' : 'light'}`, y: .30, rotation: 90 },
  ]
}

export function findNearestValidCell(hull: HullCatalogEntry, design: HLGDesign, part: HLGPartDefinition, preferred: HLGCell, rotation: HLGRotation = 0, weaponSlot = nextAvailableWeaponSlot(design.components), mountHeight = 0): HLGCell | null {
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
  return candidates.find(cell => canPlaceHLGPart(hull, design, part, cell, rotation, weaponSlot, mountHeight)) ?? null
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

function normalizeWeaponSlots(components: HLGComponentInstance[]): HLGComponentInstance[] {
  const slotParts = new Map<number, string>()
  const next = components.map(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part?.type) return { ...component, weaponSlot: undefined }
    const requested = Number.isInteger(component.weaponSlot) ? component.weaponSlot! : undefined
    const canKeep = requested != null
      && requested >= 0
      && requested < MAX_WEAPON_SLOTS
      && (!slotParts.has(requested) || slotParts.get(requested) === part.partId)
    const slot = canKeep ? requested : firstCompatibleWeaponSlot(slotParts, part.partId)
    slotParts.set(slot, part.partId)
    return { ...component, weaponSlot: slot }
  })
  return next
}

function firstCompatibleWeaponSlot(slotParts: Map<number, string>, partId: string): number {
  for (let slot = 0; slot < MAX_WEAPON_SLOTS; slot++) {
    const slotPart = slotParts.get(slot)
    if (!slotPart || slotPart === partId) return slot
  }
  return MAX_WEAPON_SLOTS - 1
}

function nextAvailableWeaponSlot(components: HLGComponentInstance[]): number | undefined {
  const used = new Set(components.flatMap(component => component.weaponSlot == null ? [] : [component.weaponSlot]))
  for (let slot = 0; slot < MAX_WEAPON_SLOTS; slot++) {
    if (!used.has(slot)) return slot
  }
  return undefined
}

function weaponSlotGroups(design: HLGDesign): Array<{ slot: number; partId: string; components: HLGComponentInstance[] }> {
  const groups = new Map<number, { slot: number; partId: string; components: HLGComponentInstance[] }>()
  for (const component of normalizeWeaponSlots(design.components)) {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part?.type || component.weaponSlot == null) continue
    const existing = groups.get(component.weaponSlot)
    if (existing) {
      if (existing.partId === part.partId) existing.components.push(component)
      continue
    }
    groups.set(component.weaponSlot, { slot: component.weaponSlot, partId: part.partId, components: [component] })
  }
  return [...groups.values()].sort((a, b) => a.slot - b.slot).slice(0, MAX_WEAPON_SLOTS)
}

function cellToMount(c: number, r: number, spec: HLGGridSpec): { x: number; y: number } {
  const x = (cellCenter(c) - cellCenter(spec.centerC)) / (spec.beamCells / 2)
  const y = ((cellCenter(r) - spec.topR) / Math.max(1, spec.lengthCells - 1)) * 2 - 1
  return {
    x: clamp(x, -1, 1),
    y: clamp(y, -1, 1),
  }
}

function cellCenter(index: number): number {
  return index + 0.5
}

function hullDimensions(hull: HullCatalogEntry): { lengthM: number; beamM: number } {
  switch (hull.templateId) {
    case 'hull.destroyer.basic': return { lengthM: 118, beamM: 10.8 }
    case 'hull.dd.improved': return { lengthM: 126, beamM: 11.4 }
    case 'hull.dd.elite': return { lengthM: 134, beamM: 12.0 }
    case 'hull.cruiser.player': return { lengthM: 174, beamM: 16.5 }
    case 'hull.cl.heavy': return { lengthM: 203, beamM: 20.5 }
    case 'hull.ca.elite': return { lengthM: 214, beamM: 21.8 }
    case 'hull.bb.fast': return { lengthM: 247, beamM: 33.0 }
    case 'hull.bb.super': return { lengthM: 263, beamM: 38.9 }
    case 'hull.bb.yukimura': return { lengthM: 238, beamM: 34.5 }
    case 'hull.battleship.basic':
    default:
      return hull.shipType === 'battleship' ? { lengthM: 242, beamM: 32.0 }
        : hull.shipType === 'cruiser' ? { lengthM: 190, beamM: 19.0 }
        : { lengthM: 120, beamM: 11.0 }
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

function calculateWeight(hull: HullCatalogEntry, design: HLGDesign): number {
  return calculateArmorStats(hull, design).weight + design.components.reduce((sum, component) => sum + (HLG_PART_BY_ID[component.partId]?.weight ?? 0), 0)
}

function calculateArmorStats(hull: HullCatalogEntry | null, design: HLGDesign): {
  belt: ArmorDefenseOption
  deck: ArmorDefenseOption
  vitalPartRatio: number
  defenseScheme: HLGStats['defenseScheme']
  weight: number
} {
  const belt = armorOptionFor(design.armorPlan.belt)
  const deck = armorOptionFor(design.armorPlan.deck)
  const vitalPartRatio = hull ? calculateVitalPartRatio(hull, design) : 54
  const defenseScheme: HLGStats['defenseScheme'] = vitalPartRatio < 54 ? '集中防御' : '完全防御'
  const vpWeightRatio = Math.max(0, Math.min(1, vitalPartRatio / 100))
  const beltWeight = belt.weightAtFullVp * vpWeightRatio * 0.72
  const deckWeight = deck.weightAtFullVp * vpWeightRatio * 0.46
  const bulkheadWeight = Math.max(0, design.armorPlan.bulkhead || 0) * 80 * vpWeightRatio
  return {
    belt,
    deck,
    vitalPartRatio,
    defenseScheme,
    weight: Math.round(beltWeight + deckWeight + bulkheadWeight),
  }
}

export function calculateVitalPartRatio(hull: HullCatalogEntry, design: HLGDesign): number {
  const spec = hlgGridSpec(hull)
  const vitalRects = design.components.flatMap(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part || !isVitalPart(part)) return []
    return [componentRect(component, part)]
  })
  if (vitalRects.length === 0) return 0
  const fore = Math.min(...vitalRects.map(rect => rect.top))
  const aft = Math.max(...vitalRects.map(rect => rect.top + rect.h))
  return Math.max(0, Math.min(100, ((aft - fore) / Math.max(1, spec.lengthCells)) * 100))
}

function isVitalPart(part: HLGPartDefinition): boolean {
  if (part.type === 'aa') return false
  if (part.type) return true
  return part.category === 'bridge' || part.category === 'funnel' || part.category === 'boiler' || part.category === 'turbine' || part.category === 'aux'
}

function armorOptionFor(value: number | ArmorDefenseKey): ArmorDefenseOption {
  if (typeof value === 'string') return ARMOR_OPTION_BY_KEY[value] ?? ARMOR_OPTION_BY_KEY.none
  if (value <= 0) return ARMOR_OPTION_BY_KEY.none
  if (value <= 3) return ARMOR_OPTION_BY_KEY['10cm']
  if (value <= 6) return ARMOR_OPTION_BY_KEY['12cm']
  if (value <= 8) return ARMOR_OPTION_BY_KEY['14cm']
  if (value <= 10) return ARMOR_OPTION_BY_KEY['15cm']
  if (value <= 15) return ARMOR_OPTION_BY_KEY['20cm']
  if (value <= 20) return ARMOR_OPTION_BY_KEY['25cm']
  if (value <= 25) return ARMOR_OPTION_BY_KEY['31cm']
  if (value <= 30) return ARMOR_OPTION_BY_KEY['36cm']
  if (value <= 38) return ARMOR_OPTION_BY_KEY['38cm']
  if (value <= 47) return ARMOR_OPTION_BY_KEY['41cm']
  if (value <= 58) return ARMOR_OPTION_BY_KEY['43cm']
  if (value <= 70) return ARMOR_OPTION_BY_KEY['46cm']
  if (value <= 77) return ARMOR_OPTION_BY_KEY['51cm']
  if (value <= 83) return ARMOR_OPTION_BY_KEY['56cm']
  return ARMOR_OPTION_BY_KEY['61cm']
}

function normalizeArmorPlan(armorPlan: HLGDesign['armorPlan']): HLGDesign['armorPlan'] {
  return {
    belt: armorOptionFor(armorPlan.belt).key,
    deck: armorOptionFor(armorPlan.deck).key,
    bulkhead: armorPlan.bulkhead ?? 0,
  }
}

export function hlgHullHalfWidth(ny: number, shipClass: PlayerShipType): number {
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

function defaultReloadForType(type: WeaponType): number {
  if (type === 'aa') return 0.8
  if (type === 'secondary') return 6
  if (type === 'torpedo') return 75
  if (type === 'missile') return 25
  return 10
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
