import type { CombatState, Command, CommandType, ShipEntity, WeaponType, CombatEvent } from './types'
import type { RngStreams } from './random'
import type { StaticData } from '../data/masterdata'
import { stepMovement, applyMoveCommand, applySpeedUpCommand, applySpeedDownCommand, applyRotateCommand, applyStopCommand } from './movement'
import { stepWeaponCooldowns, fireWeapon, stepProjectiles, WEAPON_CONFIGS } from './weapons'
import { generateAiCommands } from './ai'
import { evaluateMission } from './mission'

export function combatStep(
  state: CombatState,
  commands: Command[],
  rng: RngStreams,
  _staticData: StaticData
): CombatState {
  if (state.missionResult !== 'none') return state

  // 1. increment tick
  let s: CombatState = { ...state, tick: state.tick + 1, eventLog: [] }

  // 2. apply player commands
  s = applyCommands(s, commands, rng)

  // 3. auto-fire commands for weapons in auto mode
  s = applyCommands(s, generateAutoFireCommands(s), rng)

  // 4. generate and apply AI commands
  const aiCmds = generateAiCommands(s, rng.ai)
  s = applyCommands(s, aiCmds, rng)

  // 5. movement step
  s = stepMovement(s)

  // 6. weapon cooldown step
  s = stepWeaponCooldowns(s)

  // 7. projectile step
  s = stepProjectiles(s, rng.combat)

  // 8. mission evaluation
  const missionResult = evaluateMission(s)
  if (missionResult !== 'none') {
    const missionEvent: CombatEvent = {
      tick: s.tick,
      type: missionResult === 'completed' ? 'mission.completed' : 'mission.failed',
    }
    s = {
      ...s,
      missionResult,
      eventLog: [...s.eventLog, missionEvent],
    }
  }

  // 9. update metrics
  s = updateMetrics(s)

  return s
}

function generateAutoFireCommands(state: CombatState): Command[] {
  const cmds: Command[] = []
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship' || player.destroyed) return cmds

  const enemies = [...state.entities.values()].filter(
    e => e.kind === 'ship' && !(e as ShipEntity).destroyed && (e as ShipEntity).team === 'enemy'
  ) as ShipEntity[]
  if (enemies.length === 0) return cmds

  // nearest enemy target
  let nearest = enemies[0]!
  let minDist = Infinity
  for (const e of enemies) {
    const dx = e.pos.x - player.pos.x
    const dy = e.pos.y - player.pos.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < minDist) { minDist = d; nearest = e }
  }

  const WEAPON_CMD: Record<WeaponType, CommandType> = {
    gun: 'fire.primary',
    torpedo: 'fire.torpedo',
    aa: 'fire.aa',
    missile: 'fire.missile',
  }

  for (const weapon of player.weapons) {
    if (!weapon.autoFire || weapon.cooldownTick > 0 || weapon.ammo <= 0) continue
    const maxRange = WEAPON_CONFIGS[weapon.type].maxRange
    if (minDist > maxRange) continue   // target out of range
    cmds.push({
      tick: state.tick,
      actorId: 'ship.player',
      type: WEAPON_CMD[weapon.type],
      target: { ...nearest.pos },
    })
  }

  return cmds
}

function applyCommands(state: CombatState, commands: Command[], rng: RngStreams): CombatState {
  let s = state

  for (const cmd of commands) {
    const entity = s.entities.get(cmd.actorId)
    if (!entity || entity.kind !== 'ship' || entity.destroyed) continue

    const ship = entity as ShipEntity

    if (cmd.type === 'speed.up') {
      const updated = applySpeedUpCommand(ship)
      const entities = new Map(s.entities)
      entities.set(ship.id, updated)
      s = { ...s, entities }
    } else if (cmd.type === 'speed.down') {
      const updated = applySpeedDownCommand(ship)
      const entities = new Map(s.entities)
      entities.set(ship.id, updated)
      s = { ...s, entities }
    } else if (cmd.type === 'move') {
      const updated = applyMoveCommand(ship, cmd)
      const entities = new Map(s.entities)
      entities.set(ship.id, updated)
      s = { ...s, entities }
    } else if (cmd.type === 'rotate') {
      const updated = applyRotateCommand(ship, cmd)
      const entities = new Map(s.entities)
      entities.set(ship.id, updated)
      s = { ...s, entities }
    } else if (cmd.type === 'stop') {
      const updated = applyStopCommand(ship)
      const entities = new Map(s.entities)
      entities.set(ship.id, updated)
      s = { ...s, entities }
    } else if (cmd.type === 'fire.primary') {
      s = fireAndTrack(s, cmd.actorId, 'gun', cmd.target, ship.team, rng)
    } else if (cmd.type === 'fire.torpedo') {
      s = fireAndTrack(s, cmd.actorId, 'torpedo', cmd.target, ship.team, rng)
    } else if (cmd.type === 'fire.aa') {
      s = fireAndTrack(s, cmd.actorId, 'aa', cmd.target, ship.team, rng)
    } else if (cmd.type === 'fire.missile') {
      s = fireAndTrack(s, cmd.actorId, 'missile', cmd.target, ship.team, rng)
    }
  }

  return s
}

function fireAndTrack(
  s: CombatState,
  actorId: string,
  weaponType: WeaponType,
  target: { x: number; y: number; z: number } | undefined,
  team: 'player' | 'enemy',
  rng: RngStreams
): CombatState {
  if (!target) return s
  const before = countAmmo(s, actorId, weaponType)
  s = fireWeapon(s, actorId, weaponType, target, rng.combat)
  const after = countAmmo(s, actorId, weaponType)
  if (team === 'player' && after < before) {
    s = {
      ...s,
      metrics: {
        ...s.metrics,
        playerAmmoSpent: s.metrics.playerAmmoSpent + 1,
        shotCountByWeapon: {
          ...s.metrics.shotCountByWeapon,
          [weaponType]: (s.metrics.shotCountByWeapon[weaponType] ?? 0) + 1,
        },
      },
    }
  }
  return s
}

function countAmmo(state: CombatState, actorId: string, weaponType: string): number {
  const entity = state.entities.get(actorId)
  if (!entity || entity.kind !== 'ship') return 0
  const ship = entity as ShipEntity
  const w = ship.weapons.find(w => w.type === weaponType)
  return w?.ammo ?? 0
}

function updateMetrics(state: CombatState): CombatState {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      result: state.missionResult,
      durationTicks: state.tick,
    },
  }
}
