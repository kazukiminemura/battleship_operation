import type { WeaponType } from '../simulation/types'
import type { WeaponTemplate } from './masterdata'

export interface ShopWeapon extends WeaponTemplate {
  name: string
  desc: string
  cost: number
  minStage: number
}

export const WEAPON_SHOP: ShopWeapon[] = [
  // ── Guns ────────────────────────────────────────────────────────────────
  { id: 'weapon.gun.127mm.twin',           name: '12.7cm HE 連装砲',    type: 'gun',       ammo: 220, desc: '高発射速度・汎用榴弾',   cost: 300,  minStage: 1 },
  { id: 'weapon.gun.127mm.ap',             name: '12.7cm AP 連装砲',    type: 'gun',       ammo: 160, desc: '徹甲弾・高威力・長射程', cost: 380,  minStage: 1 },
  { id: 'weapon.gun.152mm.twin.forward',   name: '15.2cm 連装砲 (前)',  type: 'gun',       ammo: 160, desc: '均衡型・連射性能良好',   cost: 500,  minStage: 3 },
  { id: 'weapon.gun.152mm.twin.aft',       name: '15.2cm 連装砲 (後)',  type: 'gun',       ammo: 160, desc: '均衡型・連射性能良好',   cost: 500,  minStage: 3 },
  { id: 'weapon.gun.203mm.forward',        name: '20.3cm 重砲 (前)',    type: 'gun',       ammo:  90, desc: '重砲・高威力・長射程',   cost: 700,  minStage: 4 },
  { id: 'weapon.gun.203mm.aft',            name: '20.3cm 重砲 (後)',    type: 'gun',       ammo:  90, desc: '重砲・高威力・長射程',   cost: 700,  minStage: 4 },
  { id: 'weapon.gun.406mm.twin.forward',   name: '40.6cm AP砲 (前)',    type: 'gun',       ammo: 180, desc: '徹甲弾・重装甲貫通',     cost: 900,  minStage: 5 },
  { id: 'weapon.gun.406mm.twin.center',    name: '40.6cm AP砲 (中)',    type: 'gun',       ammo: 180, desc: '徹甲弾・重装甲貫通',     cost: 900,  minStage: 5 },
  { id: 'weapon.gun.406mm.twin.aft',       name: '40.6cm AP砲 (後)',    type: 'gun',       ammo: 180, desc: '徹甲弾・重装甲貫通',     cost: 900,  minStage: 5 },
  { id: 'weapon.gun.406mm.he.forward',     name: '40.6cm HE砲 (前)',    type: 'gun',       ammo: 220, desc: '榴弾・範囲威力・多装填', cost: 850,  minStage: 5 },
  { id: 'weapon.gun.406mm.he.center',      name: '40.6cm HE砲 (中)',    type: 'gun',       ammo: 220, desc: '榴弾・範囲威力・多装填', cost: 850,  minStage: 5 },
  { id: 'weapon.gun.406mm.he.aft',         name: '40.6cm HE砲 (後)',    type: 'gun',       ammo: 220, desc: '榴弾・範囲威力・多装填', cost: 850,  minStage: 5 },
  { id: 'weapon.gun.460mm.forward',        name: '46cm 超重砲 (前)',     type: 'gun',       ammo: 120, desc: '超重砲・最大破壊力',     cost: 1200, minStage: 7 },
  { id: 'weapon.gun.460mm.center',         name: '46cm 超重砲 (中)',     type: 'gun',       ammo: 120, desc: '超重砲・最大破壊力',     cost: 1200, minStage: 7 },
  { id: 'weapon.gun.460mm.aft',            name: '46cm 超重砲 (後)',     type: 'gun',       ammo: 120, desc: '超重砲・最大破壊力',     cost: 1200, minStage: 7 },

  // ── Secondaries ─────────────────────────────────────────────────────────
  { id: 'weapon.secondary.127mm.twin',              name: '12.7cm 速射副砲',    type: 'secondary', ammo: 400, desc: '高発射速度・汎用',         cost: 280,  minStage: 1 },
  { id: 'weapon.secondary.100mm.cl',                name: '10cm 高角砲',        type: 'secondary', ammo: 560, desc: '高角射撃対応・豊富な弾数', cost: 320,  minStage: 3 },
  { id: 'weapon.secondary.152mm.twin.port',         name: '15.2cm 重副砲 (左)', type: 'secondary', ammo: 260, desc: '重副砲・高威力',           cost: 500,  minStage: 5 },
  { id: 'weapon.secondary.152mm.twin.starboard',    name: '15.2cm 重副砲 (右)', type: 'secondary', ammo: 260, desc: '重副砲・高威力',           cost: 500,  minStage: 5 },
  { id: 'weapon.secondary.127mm.bb.port',           name: '12.7cm 速射砲 (左)', type: 'secondary', ammo: 400, desc: '速射副砲・多装填',         cost: 350,  minStage: 5 },
  { id: 'weapon.secondary.127mm.bb.starboard',      name: '12.7cm 速射砲 (右)', type: 'secondary', ammo: 400, desc: '速射副砲・多装填',         cost: 350,  minStage: 5 },

  // ── Torpedoes ────────────────────────────────────────────────────────────
  { id: 'weapon.torpedo.533mm.basic', name: '53.3cm 魚雷',   type: 'torpedo', ammo: 24, desc: '標準魚雷・取り回し良好',     cost: 400,  minStage: 1 },
  { id: 'weapon.torpedo.610mm.dd',    name: '61cm 重魚雷',   type: 'torpedo', ammo: 14, desc: '超高威力・弾数少なめ',       cost: 600,  minStage: 3 },
  { id: 'weapon.torpedo.610mm.cl',    name: '61cm 重魚雷CL', type: 'torpedo', ammo: 24, desc: '超高威力・中装填',           cost: 700,  minStage: 5 },
  { id: 'weapon.torpedo.610mm.bb',    name: '61cm 戦艦魚雷', type: 'torpedo', ammo: 36, desc: '超高威力・広範囲着弾',       cost: 800,  minStage: 5 },

  // ── AA ──────────────────────────────────────────────────────────────────
  { id: 'weapon.aa.20mm.dd',  name: '20mm 機銃',     type: 'aa', ammo: 1200, desc: '超高発射速度・豊富な弾薬', cost: 200,  minStage: 1 },
  { id: 'weapon.aa.cruiser',  name: '40mm 対空砲',   type: 'aa', ammo: 600,  desc: '高威力・中射程',           cost: 350,  minStage: 1 },
  { id: 'weapon.aa.heavy',    name: '重対空砲',       type: 'aa', ammo: 1200, desc: '汎用高威力対空砲',         cost: 500,  minStage: 5 },
  { id: 'weapon.aa.sam.cl',   name: '艦対空 SAM',    type: 'aa', ammo: 60,   desc: '超長射程・高高度対応',     cost: 700,  minStage: 5 },
  { id: 'weapon.aa.ciws.bb',  name: 'CIWS',          type: 'aa', ammo: 2400, desc: '近接防御・超高射速',       cost: 600,  minStage: 7 },

  // ── Missiles ────────────────────────────────────────────────────────────
  { id: 'weapon.missile.antiship.dd',          name: '対艦ミサイル(軽)',   type: 'missile', ammo: 16, desc: '標準的な対艦誘導弾',   cost: 500,  minStage: 1 },
  { id: 'weapon.missile.sam.dd',               name: '短距離 SAM',        type: 'missile', ammo: 24, desc: '高速・防空特化',       cost: 450,  minStage: 1 },
  { id: 'weapon.missile.cruiser.standard',     name: '艦対艦ミサイル',    type: 'missile', ammo: 36, desc: '標準的な対艦誘導弾',   cost: 650,  minStage: 3 },
  { id: 'weapon.missile.cruise.cl',            name: '巡航ミサイル',      type: 'missile', ammo: 20, desc: '長射程・最大威力',     cost: 850,  minStage: 5 },
  { id: 'weapon.missile.battleship.longrange', name: '長射程ミサイル',    type: 'missile', ammo: 64, desc: '超長射程・最大火力',   cost: 1100, minStage: 5 },
  { id: 'weapon.missile.antiship.bb',          name: '対艦ミサイル(重)',   type: 'missile', ammo: 88, desc: '中射程・多装填',       cost: 900,  minStage: 5 },
]

export const TYPE_JP: Record<WeaponType, string> = {
  gun: '主砲', secondary: '副砲', torpedo: '魚雷', aa: '対空', missile: 'ミサイル',
}

export const TYPE_COLOR: Record<WeaponType, string> = {
  gun: '#f97316', secondary: '#fb923c', torpedo: '#38bdf8', aa: '#4ade80', missile: '#a78bfa',
}

export function getAvailableWeapons(stage: number): ShopWeapon[] {
  return WEAPON_SHOP.filter(w => w.minStage <= stage)
}

export function calcStartingCredits(stage: number): number {
  return 2000 + (stage - 1) * 700
}
