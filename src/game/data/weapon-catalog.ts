import type { PlayerShipType, WeaponTemplate } from './masterdata'
import { DEFAULT_ARMAMENT } from './default-armament'
import { firingArcForWeapon } from '../simulation/firing-arcs'

export interface WeaponOption extends WeaponTemplate {
  name: string   // always required in catalog entries
  desc: string
}

export interface SlotCatalog {
  label: string
  options: WeaponOption[]
}

export const WEAPON_CATALOG: Record<PlayerShipType, SlotCatalog[]> = {
  destroyer: [
    {
      label: '主砲',
      options: [
        { id: 'weapon.gun.127mm.twin',      name: '12.7cm HE 連装砲', type: 'gun',     ammo: 220, desc: '高発射速度・汎用榴弾' },
        { id: 'weapon.gun.127mm.ap',        name: '12.7cm AP 連装砲', type: 'gun',     ammo: 160, desc: '徹甲弾・高威力・長射程' },
      ],
    },
    {
      label: '魚雷',
      options: [
        { id: 'weapon.torpedo.533mm.basic', name: '53.3cm 魚雷',    type: 'torpedo', ammo: 24, desc: '標準魚雷・取り回し良好' },
        { id: 'weapon.torpedo.610mm.dd',    name: '61cm 重魚雷',    type: 'torpedo', ammo: 14, desc: '超高威力・弾数少なめ' },
      ],
    },
    {
      label: '対空',
      options: [
        { id: 'weapon.aa.20mm.dd',          name: '20mm 機銃',      type: 'aa',      ammo: 1200, desc: '超高発射速度・豊富な弾薬' },
        { id: 'weapon.aa.cruiser',          name: '40mm 対空砲',    type: 'aa',      ammo: 600,  desc: '高威力・中射程' },
      ],
    },
    {
      label: 'ミサイル',
      options: [
        { id: 'weapon.missile.antiship.dd', name: '対艦ミサイル',    type: 'missile', ammo: 16, desc: '標準的な対艦誘導弾' },
        { id: 'weapon.missile.sam.dd',      name: '短距離 SAM',     type: 'missile', ammo: 24, desc: '高速・防空特化' },
      ],
    },
  ],

  cruiser: [
    {
      label: '前部主砲',
      options: [
        { id: 'weapon.gun.152mm.twin', name: '15.2cm 連装砲', type: 'gun', ammo: 160, desc: '均衡型・連射性能良好' },
        { id: 'weapon.gun.203mm',      name: '20.3cm 重砲',   type: 'gun', ammo:  90, desc: '重砲・高威力・長射程' },
      ],
    },
    {
      label: '後部主砲',
      options: [
        { id: 'weapon.gun.152mm.twin', name: '15.2cm 連装砲', type: 'gun', ammo: 160, desc: '均衡型・連射性能良好' },
        { id: 'weapon.gun.203mm',      name: '20.3cm 重砲',   type: 'gun', ammo:  90, desc: '重砲・高威力・長射程' },
      ],
    },
    {
      label: '副砲',
      options: [
        { id: 'weapon.secondary.127mm.twin',    name: '12.7cm 副砲',   type: 'secondary', ammo: 400, desc: '高発射速度・汎用' },
        { id: 'weapon.secondary.100mm.cl',      name: '10cm 高角砲',   type: 'secondary', ammo: 560, desc: '高角射撃対応・豊富な弾数' },
      ],
    },
    {
      label: '魚雷',
      options: [
        { id: 'weapon.torpedo.533mm.basic',     name: '53.3cm 魚雷',   type: 'torpedo', ammo: 42, desc: '標準魚雷・多数装填' },
        { id: 'weapon.torpedo.610mm.cl',        name: '61cm 重魚雷',   type: 'torpedo', ammo: 24, desc: '超高威力・弾数少なめ' },
      ],
    },
    {
      label: '対空',
      options: [
        { id: 'weapon.aa.cruiser',              name: '中対空砲',       type: 'aa',      ammo: 900, desc: '汎用対空・対艦両用' },
        { id: 'weapon.aa.sam.cl',               name: '艦対空 SAM',    type: 'aa',      ammo:  60, desc: '超長射程・高高度対応' },
      ],
    },
    {
      label: 'ミサイル',
      options: [
        { id: 'weapon.missile.cruiser.standard', name: '艦対艦ミサイル', type: 'missile', ammo: 36, desc: '標準的な対艦誘導弾' },
        { id: 'weapon.missile.cruise.cl',        name: '巡航ミサイル',   type: 'missile', ammo: 20, desc: '長射程・最大威力' },
      ],
    },
  ],

  battleship: [
    {
      label: '前部主砲',
      options: [
        { id: 'weapon.gun.406mm.twin', name: '40.6cm AP 連装砲', type: 'gun', ammo: 180, desc: '徹甲弾・重装甲貫通' },
        { id: 'weapon.gun.406mm.he',   name: '40.6cm HE 連装砲', type: 'gun', ammo: 220, desc: '榴弾・範囲威力・多装填' },
        { id: 'weapon.gun.460mm',      name: '46cm 超重砲',       type: 'gun', ammo: 120, desc: '超重砲・最大破壊力' },
      ],
    },
    {
      label: '中央主砲',
      options: [
        { id: 'weapon.gun.406mm.twin', name: '40.6cm AP 連装砲', type: 'gun', ammo: 180, desc: '徹甲弾・重装甲貫通' },
        { id: 'weapon.gun.406mm.he',   name: '40.6cm HE 連装砲', type: 'gun', ammo: 220, desc: '榴弾・範囲威力・多装填' },
        { id: 'weapon.gun.460mm',      name: '46cm 超重砲',       type: 'gun', ammo: 120, desc: '超重砲・最大破壊力' },
      ],
    },
    {
      label: '後部主砲',
      options: [
        { id: 'weapon.gun.406mm.twin', name: '40.6cm AP 連装砲', type: 'gun', ammo: 180, desc: '徹甲弾・重装甲貫通' },
        { id: 'weapon.gun.406mm.he',   name: '40.6cm HE 連装砲', type: 'gun', ammo: 220, desc: '榴弾・範囲威力・多装填' },
        { id: 'weapon.gun.460mm',      name: '46cm 超重砲',       type: 'gun', ammo: 120, desc: '超重砲・最大破壊力' },
      ],
    },
    {
      label: '左舷副砲',
      options: [
        { id: 'weapon.secondary.152mm.twin', name: '15.2cm 重副砲',  type: 'secondary', ammo: 260, desc: '重副砲・高威力' },
        { id: 'weapon.secondary.127mm.bb',   name: '12.7cm 速射砲',  type: 'secondary', ammo: 400, desc: '速射副砲・多装填' },
      ],
    },
    {
      label: '右舷副砲',
      options: [
        { id: 'weapon.secondary.152mm.twin', name: '15.2cm 重副砲', type: 'secondary', ammo: 260, desc: '重副砲・高威力' },
        { id: 'weapon.secondary.127mm.bb',   name: '12.7cm 速射砲', type: 'secondary', ammo: 400, desc: '速射副砲・多装填' },
      ],
    },
    {
      label: '魚雷',
      options: [
        { id: 'weapon.torpedo.533mm.basic',     name: '53.3cm 魚雷',      type: 'torpedo', ammo: 56, desc: '多数装填・取り回し良好' },
        { id: 'weapon.torpedo.610mm.bb',        name: '61cm 重魚雷',      type: 'torpedo', ammo: 36, desc: '超高威力・広範囲着弾' },
      ],
    },
    {
      label: '対空',
      options: [
        { id: 'weapon.aa.heavy',                name: '重対空砲',          type: 'aa',      ammo: 1200, desc: '汎用高威力対空砲' },
        { id: 'weapon.aa.ciws.bb',              name: 'CIWS',             type: 'aa',      ammo: 2400, desc: '近接防御・超高射速' },
      ],
    },
    {
      label: 'ミサイル',
      options: [
        { id: 'weapon.missile.battleship.longrange', name: '長射程ミサイル', type: 'missile', ammo: 64, desc: '超長射程・最大火力' },
        { id: 'weapon.missile.antiship.bb',          name: '対艦ミサイル',   type: 'missile', ammo: 88, desc: '中射程・多装填' },
      ],
    },
  ],
}

export function getDefaultLoadout(shipType: PlayerShipType): WeaponTemplate[] {
  return WEAPON_CATALOG[shipType].map((slot, index) => {
    const opt = slot.options[0]!
    const mounts = DEFAULT_ARMAMENT[shipType][index]!.map((position, i) => ({
      instanceId: `standard.${index}.${i}`,
      mount: { x: position.x, y: position.y },
      barrels: position.barrels,
      firingArc: firingArcForWeapon(opt.type, position),
    }))
    return { id: opt.id, name: mounts[0]?.barrels === 3 && opt.type === 'gun' ? opt.name.replace('連装', '三連装') : opt.name,
      type: opt.type, ammo: opt.ammo * mounts.length, barrels: mounts[0]?.barrels,
      mount: mounts[0]?.mount, firingArc: mounts[0]?.firingArc, mounts }
  })
}
