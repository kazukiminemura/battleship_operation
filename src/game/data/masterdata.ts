import { MAX_WEAPON_SLOTS, type BuildingEntity, type ShipEntity, type CombatState, type Entity, type MapObstacle, type Metrics, type WeaponState, type WeaponType, type WeatherCondition } from '../simulation/types'
import { naturalCoastline } from './coastlines'
import shipTemplates from './ships.json'
import { getDefaultLoadout } from './weapon-catalog'
import type { ShipDesignLayout } from './ship-design-layout'
import { KNOTS_PER_UNIT, WORLD_SIZE } from '../simulation/movement'

export type PlayerShipType = 'destroyer' | 'cruiser' | 'battleship'

export interface ShipTemplate {
  id: string
  hp: number
  armor: number
  maxSpeed: number
  turnRate: number
  detectionRange: number
  weapons: WeaponTemplate[]
}

export interface WeaponTemplate {
  id: string
  instanceId?: string
  name?: string
  type: WeaponType
  ammo: number
  barrels?: number
  mount?: { x: number; y: number }
  firingArc?: { center: number; width: number }
  mounts?: Array<{
    instanceId?: string
    mount?: { x: number; y: number }
    firingArc?: { center: number; width: number }
    barrels?: number
  }>
}

export interface StaticData {
  ships: Record<string, ShipTemplate>
  missionId: string
  stages: StageDefinition[]
}

// Converts polar-form island definition to a world-coordinate polygon.
// pts: [angleDegrees, radiusFactor][] going clockwise from East.
function islandPoly(
  cx: number, cy: number, rx: number, ry: number,
  pts: [number, number][],
): { x: number; y: number }[] {
  return pts.map(([deg, r]) => ({
    x: Math.round(cx + Math.cos(deg * Math.PI / 180) * rx * r),
    y: Math.round(cy + Math.sin(deg * Math.PI / 180) * ry * r),
  }))
}

export const STATIC_DATA: StaticData = {
  missionId: 'mission.mvp.open_water',
  ships: shipTemplates as Record<string, ShipTemplate>,
  stages: [
    {
      stage: 1, name: 'Outer Patrol', destroyers: 3, cruisers: 0, buildings: 1, weather: 'clear',
      mapObstacles: [{
        id: 'island.outer-atoll', x: 5000, y: 5050, rx: 540, ry: 340,
        points: islandPoly(5000, 5050, 540, 340, [
          [0,0.90],[20,0.98],[40,0.88],[55,0.95],[70,0.82],
          [85,0.75],[100,0.82],[115,0.88],[130,0.80],[150,1.00],
          [165,0.92],[180,0.88],[195,0.70],[210,0.58],[225,0.52],
          [240,0.62],[255,0.75],[270,0.82],[290,0.88],[315,0.92],[340,0.88],
        ]),
      }],
    },
    {
      stage: 2, name: 'Screening Line', destroyers: 5, cruisers: 0, buildings: 1, weather: 'clear',
      mapObstacles: [{
        id: 'island.west-reef', x: 3600, y: 4800, rx: 500, ry: 330,
        points: islandPoly(3600, 4800, 500, 330, [
          [0,0.60],[20,0.80],[40,0.92],[60,1.00],[80,0.95],
          [100,0.88],[120,0.80],[140,0.90],[160,0.98],[180,0.88],
          [200,0.78],[220,0.72],[240,0.80],[260,0.75],[280,0.65],
          [305,0.55],[330,0.50],[355,0.55],
        ]),
      }],
    },
    {
      stage: 3, name: 'Raider Pack', destroyers: 6, cruisers: 1, buildings: 1, weather: 'rain',
      mapObstacles: [{
        id: 'island.east-rock', x: 6400, y: 4750, rx: 620, ry: 360,
        points: islandPoly(6400, 4750, 620, 360, [
          [0,0.88],[20,1.02],[40,0.88],[60,0.95],[80,0.78],
          [100,0.90],[120,0.82],[140,1.00],[160,0.88],[180,0.82],
          [200,0.70],[215,0.62],[230,0.72],[250,0.80],[270,0.75],
          [290,0.82],[315,0.78],[340,0.90],
        ]),
      }],
    },
    {
      stage: 4, name: 'Island Guns', destroyers: 8, cruisers: 1, buildings: 2,
      mapObstacles: [{
        id: 'island.central-fort', x: 5000, y: 5050, rx: 720, ry: 470,
        points: islandPoly(5000, 5050, 720, 470, [
          [0,0.90],[20,1.00],[40,0.92],[60,0.88],[80,0.96],
          [100,0.88],[120,1.00],[140,0.92],[160,0.85],[180,0.92],
          [200,0.80],[215,0.72],[230,0.62],[245,0.55],[260,0.60],
          [275,0.68],[290,0.82],[310,0.90],[330,0.88],[350,0.92],
        ]),
      }],
    },
    {
      stage: 5, name: 'Cruiser Trap', destroyers: 8, cruisers: 2, buildings: 2,
      mapObstacles: [
        {
          id: 'island.north-key', x: 4400, y: 3850, rx: 460, ry: 300,
          points: islandPoly(4400, 3850, 460, 300, [
            [0,0.80],[25,0.92],[50,0.88],[70,1.00],[90,0.88],
            [110,0.80],[130,0.92],[150,0.85],[170,0.95],[190,0.88],
            [210,0.72],[230,0.62],[250,0.68],[270,0.75],[290,0.80],
            [315,0.72],[340,0.78],
          ]),
        },
        {
          id: 'island.south-key', x: 6000, y: 6100, rx: 520, ry: 340,
          points: islandPoly(6000, 6100, 520, 340, [
            [0,0.88],[25,0.95],[50,0.80],[70,0.72],[90,0.80],
            [110,0.92],[135,1.00],[160,0.88],[180,0.80],[205,0.85],
            [225,1.00],[250,0.88],[270,0.80],[290,0.90],[315,0.82],[340,0.90],
          ]),
        },
      ],
    },
    {
      stage: 6, name: 'Broken Strait', destroyers: 10, cruisers: 2, buildings: 2,
      mapObstacles: [
        {
          id: 'island.west-gate', x: 3400, y: 5200, rx: 580, ry: 420,
          points: islandPoly(3400, 5200, 580, 420, [
            [0,0.60],[20,0.75],[40,0.90],[60,1.00],[80,0.92],
            [100,0.88],[120,0.95],[145,1.00],[165,0.92],[180,0.98],
            [200,0.88],[220,0.80],[240,0.85],[260,0.72],[275,0.58],
            [290,0.55],[305,0.62],[325,0.68],[345,0.62],
          ]),
        },
        {
          id: 'island.east-gate', x: 6600, y: 5000, rx: 580, ry: 420,
          points: islandPoly(6600, 5000, 580, 420, [
            [0,0.92],[20,0.88],[40,0.75],[60,0.82],[80,0.95],
            [100,1.00],[120,0.88],[140,0.78],[160,0.65],[180,0.55],
            [195,0.62],[210,0.72],[230,0.82],[250,0.88],[270,0.90],
            [295,1.00],[320,0.92],[345,0.88],
          ]),
        },
      ],
    },
    {
      stage: 7, name: 'Fleet Vanguard', destroyers: 12, cruisers: 3, buildings: 3,
      mapObstacles: [
        {
          id: 'island.vanguard-a', x: 3200, y: 4050, rx: 420, ry: 280,
          points: islandPoly(3200, 4050, 420, 280, [
            [0,0.85],[30,1.00],[60,0.80],[90,0.88],[120,0.75],
            [150,0.92],[175,0.85],[200,0.68],[225,0.75],[255,0.82],
            [285,0.90],[315,0.85],[345,0.80],
          ]),
        },
        {
          id: 'island.vanguard-b', x: 5200, y: 5050, rx: 520, ry: 330,
          points: islandPoly(5200, 5050, 520, 330, [
            [0,0.85],[22,0.98],[45,0.82],[65,0.90],[85,0.75],
            [105,0.85],[130,1.00],[155,0.88],[175,0.72],[195,0.65],
            [215,0.72],[240,0.82],[265,0.90],[290,0.82],[315,0.75],[340,0.88],
          ]),
        },
        {
          id: 'island.vanguard-c', x: 7200, y: 6100, rx: 430, ry: 290,
          points: islandPoly(7200, 6100, 430, 290, [
            [0,0.88],[30,0.78],[60,0.92],[90,1.00],[125,0.82],
            [155,0.90],[185,0.80],[210,0.68],[240,0.75],[270,0.85],
            [305,0.90],[340,0.82],
          ]),
        },
      ],
    },
    {
      stage: 8, name: 'Heavy Screen', destroyers: 14, cruisers: 4, buildings: 3,
      mapObstacles: [{
        id: 'island.long-bank', x: 5000, y: 5000, rx: 1080, ry: 300,
        points: islandPoly(5000, 5000, 1080, 300, [
          [0,0.88],[15,0.95],[30,1.00],[50,0.90],[70,0.82],
          [90,0.85],[110,0.92],[130,0.88],[150,0.82],[165,0.90],
          [180,0.88],[200,0.82],[220,0.78],[240,0.85],[260,0.80],
          [280,0.85],[305,0.88],[330,0.92],[355,0.88],
        ]),
      }],
    },
    {
      stage: 9, name: 'Final Approach', destroyers: 16, cruisers: 5, buildings: 3,
      mapObstacles: [
        {
          id: 'island.approach-left', x: 3800, y: 4300, rx: 520, ry: 360,
          points: islandPoly(3800, 4300, 520, 360, [
            [0,0.88],[22,0.80],[45,0.95],[68,1.00],[88,0.85],
            [110,0.78],[130,0.92],[155,0.85],[175,0.75],[195,0.68],
            [215,0.72],[240,0.80],[265,0.85],[290,0.90],[315,0.88],
            [340,0.82],[358,0.88],
          ]),
        },
        {
          id: 'island.approach-right', x: 6400, y: 4300, rx: 520, ry: 360,
          points: islandPoly(6400, 4300, 520, 360, [
            [0,0.90],[22,0.98],[45,0.85],[68,0.75],[88,0.85],
            [110,1.00],[135,0.88],[158,0.78],[178,0.68],[200,0.72],
            [220,0.80],[245,0.85],[265,0.90],[285,0.80],[315,0.88],
            [340,0.92],[358,0.88],
          ]),
        },
        {
          id: 'island.approach-rear', x: 5100, y: 6400, rx: 680, ry: 310,
          points: islandPoly(5100, 6400, 680, 310, [
            [0,0.90],[18,1.00],[36,0.88],[55,0.92],[72,0.82],
            [90,0.85],[108,0.90],[126,0.88],[144,0.82],[162,0.90],
            [180,0.88],[198,0.82],[216,0.85],[234,0.78],[252,0.82],
            [270,0.85],[288,0.90],[306,0.88],[324,0.92],[342,0.88],
          ]),
        },
      ],
    },
    {
      stage: 10, name: 'Dreadnought Core', destroyers: 10, cruisers: 4, buildings: 3, boss: true,
      mapObstacles: [
        {
          id: 'island.boss-core', x: 5000, y: 4550, rx: 840, ry: 480,
          points: islandPoly(5000, 4550, 840, 480, [
            [0,0.88],[16,1.00],[32,0.90],[48,0.82],[65,0.92],
            [82,0.85],[98,0.78],[115,0.88],[132,1.00],[148,0.88],
            [165,0.80],[182,0.75],[198,0.68],[215,0.72],[230,0.65],
            [248,0.72],[265,0.80],[282,0.72],[298,0.80],[315,0.88],
            [332,0.92],[348,0.88],
          ]),
        },
        {
          id: 'island.boss-screen-left', x: 2900, y: 6200, rx: 430, ry: 280,
          points: islandPoly(2900, 6200, 430, 280, [
            [0,0.85],[30,1.00],[65,0.88],[95,0.80],[125,0.90],
            [155,0.82],[185,0.70],[215,0.78],[250,0.85],[285,0.90],
            [320,0.88],[350,0.82],
          ]),
        },
        {
          id: 'island.boss-screen-right', x: 7100, y: 6200, rx: 430, ry: 280,
          points: islandPoly(7100, 6200, 430, 280, [
            [0,0.82],[35,0.90],[65,1.00],[95,0.85],[125,0.78],
            [155,0.88],[185,0.75],[210,0.68],[240,0.80],[270,0.88],
            [305,0.92],[340,0.85],
          ]),
        },
      ],
    },
  ],
}

export interface StageDefinition {
  stage: number
  name: string
  destroyers: number
  cruisers: number
  buildings: number
  mapObstacles: MapObstacle[]
  boss?: boolean
  weather?: WeatherCondition
}

// Speed reduction per armor point: heavier armor = more displacement = slower hull
export const ARMOR_WEIGHT_K = 0.004

const DEBUG_STAGE_NUMBER = 99
const DEBUG_ENEMY_HP_MULTIPLIER = 4
const DEBUG_BOSS_HP_MULTIPLIER = 2.5
const DEBUG_PLAYER_SPEED_KNOTS = 200
const DEBUG_PLAYER_SPEED = DEBUG_PLAYER_SPEED_KNOTS / KNOTS_PER_UNIT
const DEBUG_PLAYER_DETECTION_RANGE = WORLD_SIZE * 2
const DEBUG_MAP_OBSTACLES: MapObstacle[] = [
  { id: 'debug.island.north-wall-a', x: 3300, y: 3600, rx: 900, ry: 470 },
  { id: 'debug.island.north-wall-b', x: 5650, y: 3150, rx: 1120, ry: 380 },
  { id: 'debug.island.north-wall-c', x: 8500, y: 3550, rx: 1040, ry: 520 },
  { id: 'debug.island.north-wall-d', x: 11800, y: 3250, rx: 980, ry: 430 },
  { id: 'debug.island.mid-left', x: 3600, y: 7000, rx: 1080, ry: 720 },
  { id: 'debug.island.mid-spine-a', x: 6750, y: 7600, rx: 700, ry: 1420 },
  { id: 'debug.island.mid-spine-b', x: 8500, y: 7850, rx: 660, ry: 1160 },
  { id: 'debug.island.mid-right', x: 12400, y: 7200, rx: 1060, ry: 720 },
  { id: 'debug.island.south-left', x: 3000, y: 11200, rx: 980, ry: 620 },
  { id: 'debug.island.south-gate', x: 6500, y: 11900, rx: 1320, ry: 430 },
  { id: 'debug.island.south-right', x: 11800, y: 11100, rx: 1120, ry: 660 },
  { id: 'debug.island.far-east-reef', x: 14500, y: 8600, rx: 620, ry: 1180 },
  { id: 'debug.island.far-west-reef', x: 1450, y: 8800, rx: 620, ry: 1180 },
]

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

function makePlayerShip(type: PlayerShipType, customTemplateId?: string): ShipEntity {
  return {
    ...makeShipFromTemplate({
    id: 'ship.player',
    templateId: customTemplateId ?? PLAYER_TEMPLATE_BY_TYPE[type],
    x: 5000,
    y: 9200,
    angle: -Math.PI / 2,
    team: 'player',
    }),
    weapons: getDefaultLoadout(type).map(makeWeaponState),
    autoPilot: true,
  }
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
    armor: template.armor ?? 0,
    speed: 0,
    targetSpeed: 0,
    speedLevel: 'stop',
    maxSpeed: template.maxSpeed,
    turnRate: template.turnRate,
    detectionRange: template.detectionRange,
    weapons: template.weapons.slice(0, MAX_WEAPON_SLOTS).map(makeWeaponState),
    team: spawn.team,
    destroyed: false,
    templateId: template.id,
  }
}

function applyArmorBonus(ship: ShipEntity, bonus: number): ShipEntity {
  const template = STATIC_DATA.ships[ship.templateId]!
  const totalArmor = template.armor + bonus
  return {
    ...ship,
    armor: totalArmor,
    armorBonus: bonus,
    maxSpeed: template.maxSpeed / (1 + bonus * ARMOR_WEIGHT_K),
  }
}

function makeWeaponState(template: WeaponTemplate): WeaponState {
  return {
    id: template.id,
    instanceId: template.instanceId,
    name: template.name ?? template.id,
    type: template.type,
    mount: template.mount ? { ...template.mount } : undefined,
    firingArc: template.firingArc ? { ...template.firingArc } : undefined,
    mounts: template.mounts?.map(mount => ({
      ...mount,
      mount: mount.mount ? { ...mount.mount } : undefined,
      firingArc: mount.firingArc ? { ...mount.firingArc } : undefined,
    })),
    barrels: template.barrels,
    cooldownTick: 0,
    ammo: template.ammo,
    maxAmmo: template.ammo,
    autoFire: true,
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

export function createInitialState(
  playerType: PlayerShipType = 'destroyer',
  stageNumber = 1,
  customLoadout?: WeaponTemplate[],
  customTemplateId?: string,
  armorBonus = 0,
  towerMount?: { x: number; y: number },
  designLayout?: ShipDesignLayout,
): CombatState {
  const stage = getStageDefinition(stageNumber)
  const entities = new Map<string, Entity>()
  const playerShip = makePlayerShip(playerType, customTemplateId)
  const armoredShip = armorBonus > 0 ? applyArmorBonus(playerShip, armorBonus) : playerShip
  const finalPlayer = customLoadout
    ? { ...armoredShip, weapons: customLoadout.map(makeWeaponState), towerMount, designLayout: designLayout ? structuredClone(designLayout) : undefined }
    : armoredShip
  entities.set('ship.player', finalPlayer)

  for (const [index, x, y, angle] of makeEnemyFormation(stage.destroyers, 1200, 7200)) {
    const id = `ship.enemy.destroyer.${String(index + 1).padStart(2, '0')}`
    entities.set(id, makeShipFromTemplate({
      id,
      templateId: 'hull.enemy.destroyer.basic',
      x,
      y,
      angle,
      team: 'enemy',
    }))
  }

  for (const [index, x, y, angle] of makeEnemyFormation(stage.cruisers, 900, 5600)) {
    const id = `ship.enemy.cruiser.${String(index + 1).padStart(2, '0')}`
    entities.set(id, makeShipFromTemplate({
      id,
      templateId: 'hull.cruiser.basic',
      x,
      y,
      angle,
      team: 'enemy',
    }))
  }

  if (stage.boss) {
    entities.set('ship.enemy.boss.dreadnought', makeShipFromTemplate({
      id: 'ship.enemy.boss.dreadnought',
      templateId: 'hull.enemy.boss.dreadnought',
      x: 5000,
      y: 1550,
      angle: Math.PI / 2,
      team: 'enemy',
    }))
  }

  const islandBuildings = makeStageBuildings(stage)
  for (const [id, x, y, hp, radius, templateId] of islandBuildings) {
    entities.set(id, makeBuilding(id, x, y, hp, radius, templateId))
  }

  const metrics: Metrics = {
    result: 'none', durationTicks: 0, playerDamageTaken: 0, playerAmmoSpent: 0,
    hitCountByWeapon: {}, shotCountByWeapon: {}, damageByWeapon: {}, enemiesDestroyed: 0,
  }

  return {
    tick: 0,
    stage: stage.stage,
    stageName: stage.name,
    maxStage: STATIC_DATA.stages.length,
    weather: stage.weather ?? 'clear',
    mapObstacles: stage.mapObstacles.map(obstacle => ({ ...obstacle })),
    entities,
    eventLog: [],
    missionResult: 'none',
    metrics,
    detectedByPlayer: new Set<string>(),
    enemyContacts: new Map(),
  }
}

export function createDebugState(playerType: PlayerShipType = 'battleship'): CombatState {
  const entities = new Map<string, Entity>()
  const player = makePlayerShip(playerType)
  entities.set('ship.player', {
    ...player,
    pos: { x: 8000, y: 15000, z: 0 },
    angle: -Math.PI / 2,
    speed: DEBUG_PLAYER_SPEED,
    targetSpeed: DEBUG_PLAYER_SPEED,
    speedLevel: 'full',
    maxSpeed: DEBUG_PLAYER_SPEED,
    detectionRange: DEBUG_PLAYER_DETECTION_RANGE,
    armor: 9900,
  })

  for (const [index, x, y, angle, templateId] of makeDebugEnemySpawns()) {
    const className = templateId.includes('cruiser') ? 'cruiser' : 'destroyer'
    const id = `ship.debug.enemy.${className}.${String(index + 1).padStart(2, '0')}`
    entities.set(id, hardenDebugEnemy(makeShipFromTemplate({
      id,
      templateId,
      x,
      y,
      angle,
      team: 'enemy',
    })))
  }

  entities.set('ship.debug.enemy.boss.dreadnought', hardenDebugEnemy(makeShipFromTemplate({
    id: 'ship.debug.enemy.boss.dreadnought',
    templateId: 'hull.enemy.boss.dreadnought',
    x: 8000,
    y: 1450,
    angle: Math.PI / 2,
    team: 'enemy',
  })))

  for (const [id, x, y, hp, radius, templateId] of makeDebugBuildings()) {
    entities.set(id, makeBuilding(id, x, y, hp, radius, templateId))
  }

  const metrics: Metrics = {
    result: 'none', durationTicks: 0, playerDamageTaken: 0, playerAmmoSpent: 0,
    hitCountByWeapon: {}, shotCountByWeapon: {}, damageByWeapon: {}, enemiesDestroyed: 0,
  }

  return {
    tick: 0,
    stage: DEBUG_STAGE_NUMBER,
    stageName: 'Debug Maze Fleet',
    maxStage: DEBUG_STAGE_NUMBER,
    weather: 'clear',
    mapObstacles: DEBUG_MAP_OBSTACLES.map(obstacle => ({ ...obstacle })),
    entities,
    eventLog: [],
    missionResult: 'none',
    metrics,
    detectedByPlayer: new Set<string>(),
    enemyContacts: new Map(),
  }
}

for (const stage of STATIC_DATA.stages) {
  stage.mapObstacles.forEach((obstacle, i) => { obstacle.points = naturalCoastline(obstacle, stage.stage + i) })
}
DEBUG_MAP_OBSTACLES.forEach((obstacle, i) => { obstacle.points = naturalCoastline(obstacle, i) })

function hardenDebugEnemy(ship: ShipEntity): ShipEntity {
  const multiplier = ship.templateId === 'hull.enemy.boss.dreadnought'
    ? DEBUG_BOSS_HP_MULTIPLIER
    : DEBUG_ENEMY_HP_MULTIPLIER
  const maxHp = Math.round(ship.maxHp * multiplier)
  return { ...ship, hp: maxHp, maxHp }
}

function makeStageBuildings(stage: StageDefinition): [string, number, number, number, number, string][] {
  const templates: [string, number, number, string][] = [
    ['command', 180, 44, 'building.command.bunker'],
    ['radar', 95, 34, 'building.radar.tower'],
    ['depot', 130, 40, 'building.supply.depot'],
  ]
  const buildings: [string, number, number, number, number, string][] = []
  for (let i = 0; i < Math.min(stage.buildings, templates.length); i++) {
    const obstacle = stage.mapObstacles[i % stage.mapObstacles.length]!
    const [name, hp, radius, templateId] = templates[i]!
    const angle = -Math.PI / 2 + i * 2.2
    buildings.push([
      `building.stage${stage.stage}.${name}`,
      obstacle.x + Math.cos(angle) * obstacle.rx * 0.28,
      obstacle.y + Math.sin(angle) * obstacle.ry * 0.25,
      hp,
      radius,
      templateId,
    ])
  }
  const airfieldIsland = stage.mapObstacles[0]
  if (airfieldIsland) buildings.push([
    `building.stage${stage.stage}.airfield`, airfieldIsland.x, airfieldIsland.y, 240, 85, 'building.airfield.base',
  ])
  return buildings
}

function makeDebugBuildings(): [string, number, number, number, number, string][] {
  return [
    ['building.debug.airfield', 6750, 7600, 300, 85, 'building.airfield.base'],
    ['building.debug.command.north', 8000, 3400, 220, 50, 'building.command.bunker'],
    ['building.debug.radar.west', 3520, 6380, 120, 34, 'building.radar.tower'],
    ['building.debug.radar.east', 12400, 6850, 120, 34, 'building.radar.tower'],
    ['building.debug.depot.south-a', 6500, 11780, 160, 42, 'building.supply.depot'],
    ['building.debug.depot.south-b', 11800, 10850, 160, 42, 'building.supply.depot'],
  ]
}

function getStageDefinition(stageNumber: number): StageDefinition {
  const clamped = Math.max(1, Math.min(STATIC_DATA.stages.length, Math.trunc(stageNumber)))
  return STATIC_DATA.stages[clamped - 1]!
}

function makeEnemyFormation(count: number, minY: number, maxY: number): [number, number, number, number][] {
  const spawns: [number, number, number, number][] = []
  if (count <= 0) return spawns

  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(count))))
  const rows = Math.ceil(count / columns)
  for (let i = 0; i < count; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    const xRatio = columns === 1 ? 0.5 : col / (columns - 1)
    const yRatio = rows === 1 ? 0.5 : row / (rows - 1)
    const stagger = row % 2 === 0 ? -140 : 140
    const x = 1300 + xRatio * 7400 + stagger
    const y = minY + yRatio * (maxY - minY)
    spawns.push([i, Math.max(800, Math.min(9200, x)), y, Math.PI / 2])
  }
  return spawns
}

function makeDebugEnemySpawns(): [number, number, number, number, string][] {
  const spawns: [number, number, number, number, string][] = []
  const lanes = [
    { x: 1250, y0: 2200, y1: 14050, count: 14 },
    { x: 2350, y0: 2050, y1: 14350, count: 14 },
    { x: 4300, y0: 3600, y1: 14500, count: 12 },
    { x: 6100, y0: 4100, y1: 14600, count: 13 },
    { x: 9900, y0: 4100, y1: 14600, count: 13 },
    { x: 11700, y0: 3600, y1: 14500, count: 12 },
    { x: 13650, y0: 2050, y1: 14350, count: 14 },
    { x: 14750, y0: 2200, y1: 14050, count: 14 },
  ]

  for (const lane of lanes) {
    for (let i = 0; i < lane.count; i++) {
      const t = lane.count === 1 ? 0.5 : i / (lane.count - 1)
      const wave = Math.sin((i + lane.x) * 0.61) * 120
      const templateId = (spawns.length + i) % 5 === 0 ? 'hull.cruiser.basic' : 'hull.enemy.destroyer.basic'
      spawns.push([
        spawns.length,
        lane.x + wave,
        lane.y0 + (lane.y1 - lane.y0) * t,
        Math.PI / 2,
        templateId,
      ])
    }
  }

  const ambushes: [number, number, string][] = [
    [3200, 7850, 'hull.enemy.destroyer.basic'],
    [4550, 9800, 'hull.cruiser.basic'],
    [5000, 10450, 'hull.enemy.destroyer.basic'],
    [5550, 9600, 'hull.enemy.destroyer.basic'],
    [6100, 10850, 'hull.cruiser.basic'],
    [6900, 8750, 'hull.enemy.destroyer.basic'],
    [10300, 10100, 'hull.cruiser.basic'],
    [10850, 11050, 'hull.enemy.destroyer.basic'],
    [11300, 9600, 'hull.enemy.destroyer.basic'],
    [12400, 7900, 'hull.enemy.destroyer.basic'],
    [7600, 5200, 'hull.cruiser.basic'],
    [8000, 5850, 'hull.enemy.destroyer.basic'],
    [8700, 5400, 'hull.enemy.destroyer.basic'],
    [7200, 11800, 'hull.enemy.destroyer.basic'],
    [8000, 12800, 'hull.cruiser.basic'],
    [8550, 12150, 'hull.enemy.destroyer.basic'],
    [9050, 13200, 'hull.enemy.destroyer.basic'],
    [3650, 13250, 'hull.cruiser.basic'],
    [4750, 13900, 'hull.enemy.destroyer.basic'],
    [11250, 13950, 'hull.enemy.destroyer.basic'],
    [12300, 13250, 'hull.cruiser.basic'],
  ]

  for (const [x, y, templateId] of ambushes) {
    spawns.push([spawns.length, x, y, Math.PI / 2, templateId])
  }

  return spawns
}
