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
  { id: 'weapon.gun.127mm.twin',  name: '12.7cm HE 連装砲', type: 'gun', ammo: 220, desc: '高発射速度・汎用榴弾',   cost: 300,  minStage: 1 },
  { id: 'weapon.gun.127mm.ap',    name: '12.7cm AP 連装砲', type: 'gun', ammo: 160, desc: '徹甲弾・高威力・長射程', cost: 380,  minStage: 1 },
  { id: 'weapon.gun.152mm.twin',  name: '15.2cm 連装砲',    type: 'gun', ammo: 160, desc: '均衡型・連射性能良好',   cost: 500,  minStage: 3 },
  { id: 'weapon.gun.203mm',       name: '20.3cm 重砲',      type: 'gun', ammo:  90, desc: '重砲・高威力・長射程',   cost: 700,  minStage: 4 },
  { id: 'weapon.gun.406mm.twin',  name: '40.6cm AP 連装砲', type: 'gun', ammo: 180, desc: '徹甲弾・重装甲貫通',     cost: 900,  minStage: 5 },
  { id: 'weapon.gun.406mm.he',    name: '40.6cm HE 連装砲', type: 'gun', ammo: 220, desc: '榴弾・範囲威力・多装填', cost: 850,  minStage: 5 },
  { id: 'weapon.gun.460mm',       name: '46cm 超重砲',       type: 'gun', ammo: 120, desc: '超重砲・最大破壊力',     cost: 1200, minStage: 7 },
  { id: 'weapon.gun.508mm.long',  name: '50.8cm 65口径砲',   type: 'gun', ammo: 72,  desc: '超大口径・長砲身・高貫通', cost: 1500, minStage: 7 },
  { id: 'weapon.gun.610mm.long',  name: '61cm 60口径砲',     type: 'gun', ammo: 54,  desc: '超重砲・大威力・重装備',   cost: 1900, minStage: 7 },
  { id: 'weapon.gun.800mm.super', name: '80cm 60口径砲',     type: 'gun', ammo: 36,  desc: '超大型主砲・低速装填',     cost: 2800, minStage: 7 },
  { id: 'weapon.gun.1000mm.hyper', name: '100cm 超弩級砲',   type: 'gun', ammo: 24,  desc: '非現実級・超重量・絶大火力', cost: 4200, minStage: 7 },
  { id: 'weapon.gun.rail.ultimate', name: '試製レールキャノン', type: 'gun', ammo: 80, desc: '架空兵装・高初速・高命中', cost: 2600, minStage: 7 },
  { id: 'weapon.gun.particle',    name: '荷電粒子砲',        type: 'gun', ammo: 60,  desc: '架空光学兵装・高威力',     cost: 3200, minStage: 7 },
  { id: 'weapon.gun.wave',        name: '波動砲',            type: 'gun', ammo: 12,  desc: '特殊兵装・決戦火力',       cost: 5200, minStage: 7 },

  // ── Secondaries ─────────────────────────────────────────────────────────
  { id: 'weapon.secondary.127mm.twin',   name: '12.7cm 速射副砲',  type: 'secondary', ammo: 400, desc: '高発射速度・汎用',         cost: 280, minStage: 1 },
  { id: 'weapon.secondary.100mm.cl',     name: '10cm 高角砲',      type: 'secondary', ammo: 560, desc: '高角射撃対応・豊富な弾数', cost: 320, minStage: 3 },
  { id: 'weapon.secondary.152mm.twin',   name: '15.2cm 重副砲',    type: 'secondary', ammo: 260, desc: '重副砲・高威力',           cost: 500, minStage: 5 },
  { id: 'weapon.secondary.127mm.bb',     name: '12.7cm 速射砲',    type: 'secondary', ammo: 400, desc: '速射副砲・多装填',         cost: 350, minStage: 5 },
  { id: 'weapon.secondary.pulse.30mm',   name: '30mm パルス機銃',  type: 'secondary', ammo: 1800, desc: '架空速射・対小型目標向け', cost: 760, minStage: 5 },
  { id: 'weapon.secondary.gatling.203mm', name: '203mm ガトリング砲', type: 'secondary', ammo: 900, desc: '大口径多銃身・制圧射撃', cost: 900, minStage: 5 },
  { id: 'weapon.secondary.vulcan.88mm',  name: '88mm 連装バルカン砲', type: 'secondary', ammo: 1400, desc: '高速連射・近中距離制圧', cost: 720, minStage: 5 },
  { id: 'weapon.secondary.127mm.rapid',  name: '新型127mm 速射砲', type: 'secondary', ammo: 700, desc: '速射砲・高命中・汎用', cost: 680, minStage: 5 },
  { id: 'weapon.secondary.155mm.ags',    name: '155mm 砲AGS', type: 'secondary', ammo: 420, desc: '新型砲・高精度支援射撃', cost: 820, minStage: 5 },
  { id: 'weapon.secondary.neutrino',     name: 'ニュートリノビーム砲', type: 'secondary', ammo: 240, desc: '光学兵装・高命中連射', cost: 1500, minStage: 7 },

  // ── Torpedoes ────────────────────────────────────────────────────────────
  { id: 'weapon.torpedo.533mm.basic', name: '53.3cm 魚雷',   type: 'torpedo', ammo: 24, desc: '標準魚雷・取り回し良好',     cost: 400,  minStage: 1 },
  { id: 'weapon.torpedo.610mm.dd',    name: '61cm 重魚雷',   type: 'torpedo', ammo: 14, desc: '超高威力・弾数少なめ',       cost: 600,  minStage: 3 },
  { id: 'weapon.torpedo.610mm.cl',    name: '61cm 重魚雷CL', type: 'torpedo', ammo: 24, desc: '超高威力・中装填',           cost: 700,  minStage: 5 },
  { id: 'weapon.torpedo.610mm.bb',    name: '61cm 戦艦魚雷', type: 'torpedo', ammo: 36, desc: '超高威力・広範囲着弾',       cost: 800,  minStage: 5 },
  { id: 'weapon.torpedo.1000mm.oxygen', name: '100cm 酸素魚雷', type: 'torpedo', ammo: 10, desc: '超大型魚雷・絶大威力', cost: 1300, minStage: 7 },
  { id: 'weapon.torpedo.supersonic',   name: '超音速魚雷', type: 'torpedo', ammo: 16, desc: '高速魚雷・命中補正', cost: 1500, minStage: 7 },
  { id: 'weapon.torpedo.photon',       name: '光子魚雷', type: 'torpedo', ammo: 12, desc: '架空魚雷・高威力誘導', cost: 1900, minStage: 7 },
  { id: 'weapon.torpedo.quantum',      name: '量子魚雷', type: 'torpedo', ammo: 10, desc: '特殊魚雷・最大級火力', cost: 2300, minStage: 7 },

  // ── AA ──────────────────────────────────────────────────────────────────
  { id: 'weapon.aa.20mm.dd',  name: '20mm 機銃',     type: 'aa', ammo: 1200, desc: '超高発射速度・豊富な弾薬', cost: 200,  minStage: 1 },
  { id: 'weapon.aa.cruiser',  name: '40mm 対空砲',   type: 'aa', ammo: 600,  desc: '高威力・中射程',           cost: 350,  minStage: 1 },
  { id: 'weapon.aa.heavy',    name: '重対空砲',       type: 'aa', ammo: 1200, desc: '汎用高威力対空砲',         cost: 500,  minStage: 5 },
  { id: 'weapon.aa.sam.cl',   name: '艦対空 SAM',    type: 'aa', ammo: 60,   desc: '超長射程・高高度対応',     cost: 700,  minStage: 5 },
  { id: 'weapon.aa.ciws.bb',  name: 'CIWS',          type: 'aa', ammo: 2400, desc: '近接防御・超高射速',       cost: 600,  minStage: 7 },
  { id: 'weapon.aa.photon.ciws', name: '光子CIWS',    type: 'aa', ammo: 3600, desc: '非現実級・高命中近接防御', cost: 1400, minStage: 7 },
  { id: 'weapon.aa.allround.30mm', name: '30mm 全方位機関砲', type: 'aa', ammo: 2200, desc: '全周対空・高発射速度', cost: 760, minStage: 5 },
  { id: 'weapon.aa.57mm.vulcan', name: '57mm バルカン砲', type: 'aa', ammo: 1600, desc: '中口径対空・制圧射撃', cost: 680, minStage: 5 },
  { id: 'weapon.aa.pulse-laser', name: '対空パルスレーザー', type: 'aa', ammo: 999, desc: '光学対空・高命中', cost: 1600, minStage: 7 },

  // ── Missiles ────────────────────────────────────────────────────────────
  { id: 'weapon.missile.antiship.dd',          name: '対艦ミサイル(軽)',   type: 'missile', ammo: 16, desc: '標準的な対艦誘導弾',   cost: 500,  minStage: 1 },
  { id: 'weapon.missile.sam.dd',               name: '短距離 SAM',        type: 'missile', ammo: 24, desc: '高速・防空特化',       cost: 450,  minStage: 1 },
  { id: 'weapon.missile.cruiser.standard',     name: '艦対艦ミサイル',    type: 'missile', ammo: 36, desc: '標準的な対艦誘導弾',   cost: 650,  minStage: 3 },
  { id: 'weapon.missile.cruise.cl',            name: '巡航ミサイル',      type: 'missile', ammo: 20, desc: '長射程・最大威力',     cost: 850,  minStage: 5 },
  { id: 'weapon.missile.battleship.longrange', name: '長射程ミサイル',    type: 'missile', ammo: 64, desc: '超長射程・最大火力',   cost: 1100, minStage: 5 },
  { id: 'weapon.missile.antiship.bb',          name: '対艦ミサイル(重)',   type: 'missile', ammo: 88, desc: '中射程・多装填',       cost: 900,  minStage: 5 },
  { id: 'weapon.missile.dimension',             name: '次元誘導ミサイル',   type: 'missile', ammo: 18, desc: '架空誘導・高威力・高命中', cost: 2100, minStage: 7 },
  { id: 'weapon.missile.vls.multiwarhead',      name: '多弾頭ミサイルVLS', type: 'missile', ammo: 32, desc: 'VLS・多目標制圧', cost: 1500, minStage: 7 },
  { id: 'weapon.missile.vls.special',           name: '特殊弾頭ミサイルVLS', type: 'missile', ammo: 20, desc: 'VLS・高威力特殊弾頭', cost: 1800, minStage: 7 },
  { id: 'weapon.missile.large',                 name: '大型ミサイル', type: 'missile', ammo: 14, desc: '大型誘導弾・重火力', cost: 1700, minStage: 7 },
  { id: 'weapon.missile.rocket.20cm',           name: '20cm 12連装噴進砲', type: 'missile', ammo: 96, desc: '多連装噴進砲・面制圧', cost: 900, minStage: 5 },
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
