import type { BuildingEntity, ShipEntity, CombatState, Entity, Metrics, WeaponState, WeaponType } from '../simulation/types'
import shipTemplates from './ships.json'

export type PlayerShipType = 'destroyer' | 'cruiser' | 'battleship'

export interface ShipTemplate {
  id: string
  hp: number
  maxSpeed: number
  turnRate: number
  weapons: WeaponTemplate[]
}

export interface WeaponTemplate {
  id: string
  type: WeaponType
  ammo: number
}

export interface StaticData {
  ships: Record<string, ShipTemplate>
  missionId: string
}

export const STATIC_DATA: StaticData = {
  missionId: 'mission.mvp.open_water',
  ships: shipTemplates as Record<string, ShipTemplate>,
}

const PLAYER_TEMPLATE_BY_TYPE: Record<PlayerShipType, string> = {
  destroyer: 'hull.destroyer.basic',
  cruiser: 'hull.cruiser.player',
  battleship: 'hull.battleship.basic',
}

interface ShipSpawn {
  id: string
  templateId: string
  x: number
  y: number
  angle: number
  team: ShipEntity['team']
}

function makePlayerShip(type: PlayerShipType): ShipEntity {
  return makeShipFromTemplate({
    id: 'ship.player',
    templateId: PLAYER_TEMPLATE_BY_TYPE[type],
    x: 5000,
    y: 9200,
    angle: -Math.PI / 2,
    team: 'player',
  })
}

function makeShipFromTemplate(spawn: ShipSpawn): ShipEntity {
  const template = STATIC_DATA.ships[spawn.templateId]
  if (!template) throw new Error(`Unknown ship template: ${spawn.templateId}`)

  return {
    kind: 'ship',
    id: spawn.id,
    pos: { x: spawn.x, y: spawn.y, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    angle: spawn.angle,
    hp: template.hp,
    maxHp: template.hp,
    speed: 0,
    targetSpeed: 0,
    speedLevel: 'stop',
    maxSpeed: template.maxSpeed,
    turnRate: template.turnRate,
    weapons: template.weapons.map(makeWeaponState),
    team: spawn.team,
    destroyed: false,
    templateId: template.id,
  }
}

function makeWeaponState(template: WeaponTemplate): WeaponState {
  return {
    id: template.id,
    type: template.type,
    cooldownTick: 0,
    ammo: template.ammo,
    maxAmmo: template.ammo,
    autoFire: false,
  }
}

function makeBuilding(id: string, x: number, y: number, hp: number, radius: number, templateId: string): BuildingEntity {
  return {
    kind: 'building',
    id,
    pos: { x, y, z: 0 },
    hp,
    maxHp: hp,
    radius,
    team: 'enemy',
    destroyed: false,
    templateId,
  }
}

export function createInitialState(playerType: PlayerShipType = 'destroyer'): CombatState {
  const entities = new Map<string, Entity>()
  entities.set('ship.player', makePlayerShip(playerType))

  const destroyers: [string, number, number, number][] = [
    ['ship.enemy.destroyer.01',  1500,  1200,  Math.PI / 2],
    ['ship.enemy.destroyer.02',  3500,   900,  Math.PI / 2],
    ['ship.enemy.destroyer.03',  5000,  1000,  Math.PI / 2],
    ['ship.enemy.destroyer.04',  6800,  1100,  Math.PI / 2],
    ['ship.enemy.destroyer.05',  8800,  1600,  Math.PI],
    ['ship.enemy.destroyer.06',  1000,  4500,  0],
    ['ship.enemy.destroyer.07',  9200,  4000,  Math.PI],
    ['ship.enemy.destroyer.08',  2800,  7000,  Math.PI / 2],
    ['ship.enemy.destroyer.09',  1400,  2600,  Math.PI / 3],
    ['ship.enemy.destroyer.10',  2600,  1800,  Math.PI / 2],
    ['ship.enemy.destroyer.11',  4300,  2100,  Math.PI / 2],
    ['ship.enemy.destroyer.12',  6100,  2200,  Math.PI / 2],
    ['ship.enemy.destroyer.13',  7700,  2400,  Math.PI],
    ['ship.enemy.destroyer.14',  9000,  2900,  Math.PI],
    ['ship.enemy.destroyer.15',  1350,  6100,  0],
    ['ship.enemy.destroyer.16',  3600,  6100, -Math.PI / 2],
    ['ship.enemy.destroyer.17',  6500,  6500,  Math.PI],
    ['ship.enemy.destroyer.18',  8500,  6100,  Math.PI],
    ['ship.enemy.destroyer.19',  1800,  8300, -Math.PI / 4],
    ['ship.enemy.destroyer.20',  7400,  8200, -Math.PI / 2],
  ]
  for (const [id, x, y, angle] of destroyers) {
    entities.set(id, makeShipFromTemplate({
      id,
      templateId: 'hull.enemy.destroyer.basic',
      x,
      y,
      angle,
      team: 'enemy',
    }))
  }

  const cruisers: [string, number, number, number][] = [
    ['ship.enemy.cruiser.01',  5000,   700,  Math.PI / 2],
    ['ship.enemy.cruiser.02',  2200,  3200,  0],
    ['ship.enemy.cruiser.03',  8200,  3000,  Math.PI],
    ['ship.enemy.cruiser.04',  3900,  3550,  Math.PI / 2],
    ['ship.enemy.cruiser.05',  6500,  3600,  Math.PI],
    ['ship.enemy.cruiser.06',  2300,  5400,  0],
    ['ship.enemy.cruiser.07',  7700,  5200,  Math.PI],
    ['ship.enemy.cruiser.08',  5100,  7600, -Math.PI / 2],
  ]
  for (const [id, x, y, angle] of cruisers) {
    entities.set(id, makeShipFromTemplate({
      id,
      templateId: 'hull.cruiser.basic',
      x,
      y,
      angle,
      team: 'enemy',
    }))
  }

  const islandBuildings: [string, number, number, number, number, string][] = [
    ['building.island.command', 5000, 4930, 180, 44, 'building.command.bunker'],
    ['building.island.radar',   4850, 5100,  95, 34, 'building.radar.tower'],
    ['building.island.depot',   5180, 5120, 130, 40, 'building.supply.depot'],
  ]
  for (const [id, x, y, hp, radius, templateId] of islandBuildings) {
    entities.set(id, makeBuilding(id, x, y, hp, radius, templateId))
  }

  const metrics: Metrics = {
    result: 'none', durationTicks: 0, playerDamageTaken: 0, playerAmmoSpent: 0,
    hitCountByWeapon: {}, shotCountByWeapon: {}, damageByWeapon: {}, enemiesDestroyed: 0,
  }

  return {
    tick: 0,
    entities,
    eventLog: [],
    missionResult: 'none',
    metrics,
  }
}
