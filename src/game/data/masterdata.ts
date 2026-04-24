import { MAX_WEAPON_SLOTS, type BuildingEntity, type ShipEntity, type CombatState, type Entity, type MapObstacle, type Metrics, type WeaponState, type WeaponType } from '../simulation/types'
import shipTemplates from './ships.json'
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
  name?: string
  type: WeaponType
  ammo: number
  mount?: { x: number; y: number }
}

export interface StaticData {
  ships: Record<string, ShipTemplate>
  missionId: string
  stages: StageDefinition[]
}

export const STATIC_DATA: StaticData = {
  missionId: 'mission.mvp.open_water',
  ships: shipTemplates as Record<string, ShipTemplate>,
  stages: [
    { stage: 1, name: 'Outer Patrol', destroyers: 3, cruisers: 0, buildings: 1, mapObstacles: [{ id: 'island.outer-atoll', x: 5000, y: 5050, rx: 540, ry: 340 }] },
    { stage: 2, name: 'Screening Line', destroyers: 5, cruisers: 0, buildings: 1, mapObstacles: [{ id: 'island.west-reef', x: 3600, y: 4800, rx: 500, ry: 330 }] },
    { stage: 3, name: 'Raider Pack', destroyers: 6, cruisers: 1, buildings: 1, mapObstacles: [{ id: 'island.east-rock', x: 6400, y: 4750, rx: 620, ry: 360 }] },
    { stage: 4, name: 'Island Guns', destroyers: 8, cruisers: 1, buildings: 2, mapObstacles: [{ id: 'island.central-fort', x: 5000, y: 5050, rx: 720, ry: 470 }] },
    { stage: 5, name: 'Cruiser Trap', destroyers: 8, cruisers: 2, buildings: 2, mapObstacles: [{ id: 'island.north-key', x: 4400, y: 3850, rx: 460, ry: 300 }, { id: 'island.south-key', x: 6000, y: 6100, rx: 520, ry: 340 }] },
    { stage: 6, name: 'Broken Strait', destroyers: 10, cruisers: 2, buildings: 2, mapObstacles: [{ id: 'island.west-gate', x: 3400, y: 5200, rx: 580, ry: 420 }, { id: 'island.east-gate', x: 6600, y: 5000, rx: 580, ry: 420 }] },
    { stage: 7, name: 'Fleet Vanguard', destroyers: 12, cruisers: 3, buildings: 3, mapObstacles: [{ id: 'island.vanguard-a', x: 3200, y: 4050, rx: 420, ry: 280 }, { id: 'island.vanguard-b', x: 5200, y: 5050, rx: 520, ry: 330 }, { id: 'island.vanguard-c', x: 7200, y: 6100, rx: 430, ry: 290 }] },
    { stage: 8, name: 'Heavy Screen', destroyers: 14, cruisers: 4, buildings: 3, mapObstacles: [{ id: 'island.long-bank', x: 5000, y: 5000, rx: 1080, ry: 300 }] },
    { stage: 9, name: 'Final Approach', destroyers: 16, cruisers: 5, buildings: 3, mapObstacles: [{ id: 'island.approach-left', x: 3800, y: 4300, rx: 520, ry: 360 }, { id: 'island.approach-right', x: 6400, y: 4300, rx: 520, ry: 360 }, { id: 'island.approach-rear', x: 5100, y: 6400, rx: 680, ry: 310 }] },
    { stage: 10, name: 'Dreadnought Core', destroyers: 10, cruisers: 4, buildings: 3, boss: true, mapObstacles: [{ id: 'island.boss-core', x: 5000, y: 4550, rx: 840, ry: 480 }, { id: 'island.boss-screen-left', x: 2900, y: 6200, rx: 430, ry: 280 }, { id: 'island.boss-screen-right', x: 7100, y: 6200, rx: 430, ry: 280 }] },
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
}

// Speed reduction per armor point: heavier armor = more displacement = slower hull
const ARMOR_WEIGHT_K = 0.004

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
  return makeShipFromTemplate({
    id: 'ship.player',
    templateId: customTemplateId ?? PLAYER_TEMPLATE_BY_TYPE[type],
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
    armor: template.armor ?? 0,
    speed: 0,
    targetSpeed: 0,
    speedLevel: 'stop',
    maxSpeed: template.maxSpeed / (1 + (template.armor ?? 0) * ARMOR_WEIGHT_K),
    turnRate: template.turnRate,
    detectionRange: template.detectionRange,
    weapons: template.weapons.slice(0, MAX_WEAPON_SLOTS).map(makeWeaponState),
    team: spawn.team,
    destroyed: false,
    templateId: template.id,
  }
}

function makeWeaponState(template: WeaponTemplate): WeaponState {
  return {
    id: template.id,
    name: template.name ?? template.id,
    type: template.type,
    mount: template.mount ? { ...template.mount } : undefined,
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
): CombatState {
  const stage = getStageDefinition(stageNumber)
  const entities = new Map<string, Entity>()
  const playerShip = makePlayerShip(playerType, customTemplateId)
  const finalPlayer = customLoadout
    ? { ...playerShip, weapons: customLoadout.slice(0, MAX_WEAPON_SLOTS).map(makeWeaponState) }
    : playerShip
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
    mapObstacles: DEBUG_MAP_OBSTACLES.map(obstacle => ({ ...obstacle })),
    entities,
    eventLog: [],
    missionResult: 'none',
    metrics,
    detectedByPlayer: new Set<string>(),
    enemyContacts: new Map(),
  }
}

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
  return buildings
}

function makeDebugBuildings(): [string, number, number, number, number, string][] {
  return [
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
