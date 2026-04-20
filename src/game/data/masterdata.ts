import type { BuildingEntity, ShipEntity, CombatState, Metrics } from '../simulation/types'

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
  type: 'gun' | 'torpedo' | 'aa' | 'missile'
  ammo: number
}

export interface StaticData {
  ships: Record<string, ShipTemplate>
  missionId: string
}

export const STATIC_DATA: StaticData = {
  missionId: 'mission.mvp.open_water',
  ships: {
    'hull.destroyer.basic': {
      id: 'hull.destroyer.basic',
      hp: 420, maxSpeed: 5, turnRate: 0.04,
      weapons: [
        { id: 'weapon.gun.127mm.single',    type: 'gun',     ammo: 220 },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 24  },
        { id: 'weapon.aa.basic',            type: 'aa',      ammo: 800 },
        { id: 'weapon.missile.basic',       type: 'missile', ammo: 24  },
      ],
    },
    'hull.cruiser.player': {
      id: 'hull.cruiser.player',
      hp: 760, maxSpeed: 3.5, turnRate: 0.03,
      weapons: [
        { id: 'weapon.gun.152mm.single',    type: 'gun',     ammo: 280 },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 42  },
        { id: 'weapon.aa.basic',            type: 'aa',      ammo: 1000 },
        { id: 'weapon.missile.basic',       type: 'missile', ammo: 42  },
      ],
    },
    'hull.battleship.basic': {
      id: 'hull.battleship.basic',
      hp: 1400, maxSpeed: 2.0, turnRate: 0.02,
      weapons: [
        { id: 'weapon.gun.406mm.single',    type: 'gun',     ammo: 420 },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 56  },
        { id: 'weapon.aa.basic',            type: 'aa',      ammo: 1400 },
        { id: 'weapon.missile.basic',       type: 'missile', ammo: 64  },
      ],
    },
    'hull.enemy.destroyer.basic': {
      id: 'hull.enemy.destroyer.basic',
      hp: 80, maxSpeed: 3, turnRate: 0.05,
      weapons: [{ id: 'weapon.gun.127mm.single', type: 'gun', ammo: 40 }],
    },
    'hull.cruiser.basic': {
      id: 'hull.cruiser.basic',
      hp: 150, maxSpeed: 2.5, turnRate: 0.03,
      weapons: [
        { id: 'weapon.gun.152mm.single',    type: 'gun',     ammo: 30 },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 12 },
      ],
    },
  },
}

function makePlayerShip(type: PlayerShipType): ShipEntity {
  const base = {
    kind: 'ship' as const,
    id: 'ship.player',
    pos: { x: 5000, y: 9200, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    angle: -Math.PI / 2,
    speed: 0, targetSpeed: 0, speedLevel: 'stop' as const,
    team: 'player' as const, destroyed: false,
  }
  if (type === 'cruiser') {
    return {
      ...base, hp: 760, maxHp: 760, maxSpeed: 3.5, turnRate: 0.03,
      templateId: 'hull.cruiser.player',
      weapons: [
        { id: 'weapon.gun.152mm.single',    type: 'gun',     cooldownTick: 0, ammo: 280,  maxAmmo: 280,  autoFire: false },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 42,   maxAmmo: 42,   autoFire: false },
        { id: 'weapon.aa.basic',            type: 'aa',      cooldownTick: 0, ammo: 1000, maxAmmo: 1000, autoFire: false },
        { id: 'weapon.missile.basic',       type: 'missile', cooldownTick: 0, ammo: 42,   maxAmmo: 42,   autoFire: false },
      ],
    }
  }
  if (type === 'battleship') {
    return {
      ...base, hp: 1400, maxHp: 1400, maxSpeed: 2.0, turnRate: 0.02,
      templateId: 'hull.battleship.basic',
      weapons: [
        { id: 'weapon.gun.406mm.single',    type: 'gun',     cooldownTick: 0, ammo: 420,  maxAmmo: 420,  autoFire: false },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 56,   maxAmmo: 56,   autoFire: false },
        { id: 'weapon.aa.basic',            type: 'aa',      cooldownTick: 0, ammo: 1400, maxAmmo: 1400, autoFire: false },
        { id: 'weapon.missile.basic',       type: 'missile', cooldownTick: 0, ammo: 64,   maxAmmo: 64,   autoFire: false },
      ],
    }
  }
  // destroyer (default)
  return {
    ...base, hp: 420, maxHp: 420, maxSpeed: 5.0, turnRate: 0.04,
    templateId: 'hull.destroyer.basic',
    weapons: [
      { id: 'weapon.gun.127mm.single',    type: 'gun',     cooldownTick: 0, ammo: 220, maxAmmo: 220, autoFire: false },
      { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 24,  maxAmmo: 24,  autoFire: false },
      { id: 'weapon.aa.basic',            type: 'aa',      cooldownTick: 0, ammo: 800, maxAmmo: 800, autoFire: false },
      { id: 'weapon.missile.basic',       type: 'missile', cooldownTick: 0, ammo: 24,  maxAmmo: 24,  autoFire: false },
    ],
  }
}

function makeDestroyer(id: string, x: number, y: number, angle: number): ShipEntity {
  return {
    kind: 'ship', id,
    pos: { x, y, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    angle, hp: 80, maxHp: 80,
    speed: 0, targetSpeed: 0, speedLevel: 'stop',
    maxSpeed: 3, turnRate: 0.05,
    weapons: [
      { id: 'weapon.gun.127mm.single', type: 'gun', cooldownTick: 0, ammo: 40, maxAmmo: 40, autoFire: false },
    ],
    team: 'enemy', destroyed: false,
    templateId: 'hull.enemy.destroyer.basic',
  }
}

function makeCruiser(id: string, x: number, y: number, angle: number): ShipEntity {
  return {
    kind: 'ship', id,
    pos: { x, y, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    angle, hp: 150, maxHp: 150,
    speed: 0, targetSpeed: 0, speedLevel: 'stop',
    maxSpeed: 2.5, turnRate: 0.03,
    weapons: [
      { id: 'weapon.gun.152mm.single',    type: 'gun',     cooldownTick: 0, ammo: 30, maxAmmo: 30, autoFire: false },
      { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 12, maxAmmo: 12, autoFire: false },
    ],
    team: 'enemy', destroyed: false,
    templateId: 'hull.cruiser.basic',
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
  const entities = new Map<string, import('../simulation/types').Entity>()
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
  for (const [id, x, y, angle] of destroyers) entities.set(id, makeDestroyer(id, x, y, angle))

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
  for (const [id, x, y, angle] of cruisers) entities.set(id, makeCruiser(id, x, y, angle))

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
