import type { ShipEntity, CombatState, Metrics } from '../simulation/types'

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
      hp: 200, maxSpeed: 5, turnRate: 0.04,
      weapons: [
        { id: 'weapon.gun.127mm.single',    type: 'gun',     ammo: 60  },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 8   },
        { id: 'weapon.aa.basic',            type: 'aa',      ammo: 200 },
        { id: 'weapon.missile.basic',       type: 'missile', ammo: 6   },
      ],
    },
    'hull.cruiser.player': {
      id: 'hull.cruiser.player',
      hp: 350, maxSpeed: 3.5, turnRate: 0.03,
      weapons: [
        { id: 'weapon.gun.152mm.single',    type: 'gun',     ammo: 80  },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 16  },
        { id: 'weapon.aa.basic',            type: 'aa',      ammo: 300 },
        { id: 'weapon.missile.basic',       type: 'missile', ammo: 12  },
      ],
    },
    'hull.battleship.basic': {
      id: 'hull.battleship.basic',
      hp: 600, maxSpeed: 2.0, turnRate: 0.02,
      weapons: [
        { id: 'weapon.gun.406mm.single',    type: 'gun',     ammo: 120 },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', ammo: 20  },
        { id: 'weapon.aa.basic',            type: 'aa',      ammo: 400 },
        { id: 'weapon.missile.basic',       type: 'missile', ammo: 20  },
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
      ...base, hp: 350, maxHp: 350, maxSpeed: 3.5, turnRate: 0.03,
      templateId: 'hull.cruiser.player',
      weapons: [
        { id: 'weapon.gun.152mm.single',    type: 'gun',     cooldownTick: 0, ammo: 80,  maxAmmo: 80,  autoFire: false },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 16,  maxAmmo: 16,  autoFire: false },
        { id: 'weapon.aa.basic',            type: 'aa',      cooldownTick: 0, ammo: 300, maxAmmo: 300, autoFire: false },
        { id: 'weapon.missile.basic',       type: 'missile', cooldownTick: 0, ammo: 12,  maxAmmo: 12,  autoFire: false },
      ],
    }
  }
  if (type === 'battleship') {
    return {
      ...base, hp: 600, maxHp: 600, maxSpeed: 2.0, turnRate: 0.02,
      templateId: 'hull.battleship.basic',
      weapons: [
        { id: 'weapon.gun.406mm.single',    type: 'gun',     cooldownTick: 0, ammo: 120, maxAmmo: 120, autoFire: false },
        { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 20,  maxAmmo: 20,  autoFire: false },
        { id: 'weapon.aa.basic',            type: 'aa',      cooldownTick: 0, ammo: 400, maxAmmo: 400, autoFire: false },
        { id: 'weapon.missile.basic',       type: 'missile', cooldownTick: 0, ammo: 20,  maxAmmo: 20,  autoFire: false },
      ],
    }
  }
  // destroyer (default)
  return {
    ...base, hp: 200, maxHp: 200, maxSpeed: 5.0, turnRate: 0.04,
    templateId: 'hull.destroyer.basic',
    weapons: [
      { id: 'weapon.gun.127mm.single',    type: 'gun',     cooldownTick: 0, ammo: 60,  maxAmmo: 60,  autoFire: false },
      { id: 'weapon.torpedo.533mm.basic', type: 'torpedo', cooldownTick: 0, ammo: 8,   maxAmmo: 8,   autoFire: false },
      { id: 'weapon.aa.basic',            type: 'aa',      cooldownTick: 0, ammo: 200, maxAmmo: 200, autoFire: false },
      { id: 'weapon.missile.basic',       type: 'missile', cooldownTick: 0, ammo: 6,   maxAmmo: 6,   autoFire: false },
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

export function createInitialState(playerType: PlayerShipType = 'destroyer'): CombatState {
  const entities = new Map<string, ShipEntity>()
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
  ]
  for (const [id, x, y, angle] of destroyers) entities.set(id, makeDestroyer(id, x, y, angle))

  const cruisers: [string, number, number, number][] = [
    ['ship.enemy.cruiser.01',  5000,   700,  Math.PI / 2],
    ['ship.enemy.cruiser.02',  2200,  3200,  0],
    ['ship.enemy.cruiser.03',  8200,  3000,  Math.PI],
  ]
  for (const [id, x, y, angle] of cruisers) entities.set(id, makeCruiser(id, x, y, angle))

  const metrics: Metrics = {
    result: 'none', durationTicks: 0, playerDamageTaken: 0, playerAmmoSpent: 0,
    hitCountByWeapon: {}, shotCountByWeapon: {}, damageByWeapon: {}, enemiesDestroyed: 0,
  }

  return {
    tick: 0,
    entities: entities as Map<string, import('../simulation/types').Entity>,
    eventLog: [],
    missionResult: 'none',
    metrics,
  }
}
