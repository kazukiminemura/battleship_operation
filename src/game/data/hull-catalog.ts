import type { WeaponType } from '../simulation/types'
import type { PlayerShipType } from './masterdata'

export interface HullSlot {
  id: string
  label: string
  x: number  // -1 (port) to 1 (starboard)
  y: number  // -1 (bow) to 1 (stern)
  compatibleTypes: WeaponType[]
}

export interface HullCatalogEntry {
  templateId: string
  shipType: PlayerShipType
  name: string
  className: string
  minStage: number
  hp: number
  maxSpeed: number
  turnRate: number
  slots: HullSlot[]
}

const GUN: WeaponType[] = ['gun', 'secondary']
const GUN_ONLY: WeaponType[] = ['gun']
const SEC: WeaponType[] = ['secondary', 'aa']
const TRP: WeaponType[] = ['torpedo']
const AA: WeaponType[] = ['aa']
const MSL: WeaponType[] = ['missile']

export const HULL_CATALOG: HullCatalogEntry[] = [
  // ── Destroyers ──────────────────────────────────────────────────────────
  {
    templateId: 'hull.destroyer.basic',
    shipType: 'destroyer',
    name: '駆逐艦 I型',
    className: '汎用駆逐艦',
    minStage: 1,
    hp: 420, maxSpeed: 6.25, turnRate: 0.04,
    slots: [
      { id: 's0', label: '主砲',     x:  0.0, y: -0.70, compatibleTypes: GUN },
      { id: 's1', label: '魚雷(左)', x: -0.5, y:  0.05, compatibleTypes: TRP },
      { id: 's2', label: '魚雷(右)', x:  0.5, y:  0.05, compatibleTypes: TRP },
      { id: 's3', label: '対空',     x:  0.0, y:  0.65, compatibleTypes: AA },
    ],
  },
  {
    templateId: 'hull.dd.improved',
    shipType: 'destroyer',
    name: '駆逐艦 II型',
    className: '改良型駆逐艦',
    minStage: 3,
    hp: 530, maxSpeed: 6.8, turnRate: 0.043,
    slots: [
      { id: 's0', label: '前主砲',   x:  0.0, y: -0.75, compatibleTypes: GUN },
      { id: 's1', label: '後主砲',   x:  0.0, y: -0.20, compatibleTypes: GUN },
      { id: 's2', label: '魚雷(左)', x: -0.5, y:  0.10, compatibleTypes: TRP },
      { id: 's3', label: '魚雷(右)', x:  0.5, y:  0.10, compatibleTypes: TRP },
      { id: 's4', label: '対空',     x:  0.0, y:  0.62, compatibleTypes: AA },
    ],
  },
  {
    templateId: 'hull.dd.elite',
    shipType: 'destroyer',
    name: '駆逐艦 III型',
    className: '精鋭駆逐艦',
    minStage: 6,
    hp: 660, maxSpeed: 7.2, turnRate: 0.046,
    slots: [
      { id: 's0', label: '前主砲',   x:  0.0, y: -0.75, compatibleTypes: GUN },
      { id: 's1', label: '後主砲',   x:  0.0, y: -0.20, compatibleTypes: GUN },
      { id: 's2', label: '魚雷(左)', x: -0.5, y:  0.10, compatibleTypes: TRP },
      { id: 's3', label: '魚雷(右)', x:  0.5, y:  0.10, compatibleTypes: TRP },
      { id: 's4', label: '対空',     x:  0.0, y:  0.50, compatibleTypes: AA },
      { id: 's5', label: 'ミサイル', x:  0.0, y:  0.75, compatibleTypes: MSL },
    ],
  },

  // ── Cruisers ─────────────────────────────────────────────────────────────
  {
    templateId: 'hull.cruiser.player',
    shipType: 'cruiser',
    name: '巡洋艦 I型',
    className: '軽巡洋艦',
    minStage: 3,
    hp: 760, maxSpeed: 4.4, turnRate: 0.03,
    slots: [
      { id: 's0', label: '前主砲',   x:  0.0, y: -0.70, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '後主砲',   x:  0.0, y: -0.10, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '副砲',     x: -0.6, y:  0.10, compatibleTypes: SEC },
      { id: 's3', label: '魚雷',     x:  0.6, y:  0.10, compatibleTypes: TRP },
      { id: 's4', label: '対空',     x:  0.0, y:  0.50, compatibleTypes: AA },
      { id: 's5', label: 'ミサイル', x:  0.0, y:  0.75, compatibleTypes: MSL },
    ],
  },
  {
    templateId: 'hull.cl.heavy',
    shipType: 'cruiser',
    name: '巡洋艦 II型',
    className: '重巡洋艦',
    minStage: 5,
    hp: 980, maxSpeed: 4.0, turnRate: 0.027,
    slots: [
      { id: 's0', label: '前主砲',   x:  0.0, y: -0.75, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '中央主砲', x:  0.0, y: -0.15, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '後主砲',   x:  0.0, y:  0.35, compatibleTypes: GUN_ONLY },
      { id: 's3', label: '魚雷(左)', x: -0.6, y:  0.00, compatibleTypes: TRP },
      { id: 's4', label: '魚雷(右)', x:  0.6, y:  0.00, compatibleTypes: TRP },
      { id: 's5', label: '対空',     x: -0.5, y:  0.65, compatibleTypes: AA },
      { id: 's6', label: 'ミサイル', x:  0.5, y:  0.65, compatibleTypes: MSL },
    ],
  },
  {
    templateId: 'hull.ca.elite',
    shipType: 'cruiser',
    name: '巡洋艦 III型',
    className: '精鋭重巡',
    minStage: 8,
    hp: 1200, maxSpeed: 3.6, turnRate: 0.025,
    slots: [
      { id: 's0', label: '前砲(左)',   x: -0.22, y: -0.75, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '前砲(右)',   x:  0.22, y: -0.75, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '後主砲',     x:  0.00, y:  0.10, compatibleTypes: GUN_ONLY },
      { id: 's3', label: '副砲(左)',   x: -0.60, y: -0.10, compatibleTypes: SEC },
      { id: 's4', label: '副砲(右)',   x:  0.60, y: -0.10, compatibleTypes: SEC },
      { id: 's5', label: '魚雷',       x:  0.00, y:  0.48, compatibleTypes: TRP },
      { id: 's6', label: '対空',       x: -0.50, y:  0.70, compatibleTypes: AA },
      { id: 's7', label: 'ミサイル',   x:  0.50, y:  0.70, compatibleTypes: MSL },
    ],
  },

  // ── Battleships ──────────────────────────────────────────────────────────
  {
    templateId: 'hull.battleship.basic',
    shipType: 'battleship',
    name: '戦艦 I型',
    className: '標準型戦艦',
    minStage: 5,
    hp: 1400, maxSpeed: 2.6, turnRate: 0.02,
    slots: [
      { id: 's0', label: '前主砲',   x:  0.0, y: -0.75, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '中央主砲', x:  0.0, y: -0.25, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '後主砲',   x:  0.0, y:  0.25, compatibleTypes: GUN_ONLY },
      { id: 's3', label: '副砲(左)', x: -0.6, y: -0.10, compatibleTypes: SEC },
      { id: 's4', label: '副砲(右)', x:  0.6, y: -0.10, compatibleTypes: SEC },
      { id: 's5', label: '魚雷',     x:  0.0, y:  0.60, compatibleTypes: TRP },
      { id: 's6', label: '対空',     x: -0.5, y:  0.72, compatibleTypes: AA },
      { id: 's7', label: 'ミサイル', x:  0.5, y:  0.72, compatibleTypes: MSL },
    ],
  },
  {
    templateId: 'hull.bb.fast',
    shipType: 'battleship',
    name: '戦艦 II型',
    className: '高速戦艦',
    minStage: 7,
    hp: 1650, maxSpeed: 3.8, turnRate: 0.022,
    slots: [
      { id: 's0', label: '前砲(左)', x: -0.22, y: -0.75, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '前砲(右)', x:  0.22, y: -0.75, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '後主砲',   x:  0.00, y:  0.10, compatibleTypes: GUN_ONLY },
      { id: 's3', label: '副砲(左)', x: -0.60, y: -0.10, compatibleTypes: SEC },
      { id: 's4', label: '副砲(右)', x:  0.60, y: -0.10, compatibleTypes: SEC },
      { id: 's5', label: '魚雷',     x:  0.00, y:  0.55, compatibleTypes: TRP },
      { id: 's6', label: '対空',     x: -0.50, y:  0.72, compatibleTypes: AA },
      { id: 's7', label: 'ミサイル', x:  0.50, y:  0.72, compatibleTypes: MSL },
    ],
  },
  {
    templateId: 'hull.bb.super',
    shipType: 'battleship',
    name: '戦艦 III型',
    className: '超弩級戦艦',
    minStage: 9,
    hp: 2100, maxSpeed: 2.5, turnRate: 0.018,
    slots: [
      { id: 's0', label: '第一主砲', x:  0.00, y: -0.80, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '第二主砲', x:  0.00, y: -0.45, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '第三主砲', x:  0.00, y: -0.10, compatibleTypes: GUN_ONLY },
      { id: 's3', label: '副砲(左)', x: -0.65, y:  0.15, compatibleTypes: SEC },
      { id: 's4', label: '副砲(右)', x:  0.65, y:  0.15, compatibleTypes: SEC },
      { id: 's5', label: '魚雷(左)', x: -0.65, y:  0.50, compatibleTypes: TRP },
      { id: 's6', label: '魚雷(右)', x:  0.65, y:  0.50, compatibleTypes: TRP },
      { id: 's7', label: '対空',     x:  0.00, y:  0.72, compatibleTypes: AA },
    ],
  },
  {
    templateId: 'hull.bb.yukimura',
    shipType: 'battleship',
    name: '幸村',
    className: '雪帽特別戦艦',
    minStage: 1,
    hp: 1800, maxSpeed: 4.2, turnRate: 0.024,
    slots: [
      { id: 's0', label: '雪玉主砲(前)', x:  0.00, y: -0.76, compatibleTypes: GUN_ONLY },
      { id: 's1', label: '雪玉主砲(中)', x:  0.00, y: -0.34, compatibleTypes: GUN_ONLY },
      { id: 's2', label: '雪玉主砲(後)', x:  0.00, y:  0.08, compatibleTypes: GUN_ONLY },
      { id: 's3', label: '左舷副砲',     x: -0.62, y: -0.06, compatibleTypes: SEC },
      { id: 's4', label: '右舷副砲',     x:  0.62, y: -0.06, compatibleTypes: SEC },
      { id: 's5', label: '赤緑魚雷',     x:  0.00, y:  0.48, compatibleTypes: TRP },
      { id: 's6', label: '緑帽対空',     x: -0.52, y:  0.72, compatibleTypes: AA },
      { id: 's7', label: '祝祭誘導弾',   x:  0.52, y:  0.72, compatibleTypes: MSL },
    ],
  },
]

export function getHullsByClass(shipType: PlayerShipType): HullCatalogEntry[] {
  return HULL_CATALOG.filter(h => h.shipType === shipType)
}

export function getUnlockedHulls(stage: number): HullCatalogEntry[] {
  return HULL_CATALOG.filter(h => h.minStage <= stage)
}
