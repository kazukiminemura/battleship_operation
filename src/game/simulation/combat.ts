import type { BuildingEntity, CombatState, Command, Entity, ShipEntity, Vec3, WeaponType, CombatEvent, ProjectileEntity } from './types'
import type { RngStreams } from './random'
import type { StaticData } from '../data/masterdata'
import { stepMovement, applyMoveCommand, applySpeedUpCommand, applySpeedDownCommand, applyRotateCommand, applyStopCommand } from './movement'
import { stepWeaponCooldowns, fireWeapon, fireWeaponAtSlot } from './weapons'
import { stepProjectiles } from './projectiles'
import { isInterceptableProjectile } from './interception'
import { getWeaponConfig } from './weapon-strategies'
import { generateAiCommands, generateAutoPilotCommands } from './ai'
import { evaluateMission } from './mission'
import { stepDetection } from './detection'

export function combatStep(
  state: CombatState,
  commands: Command[],
  rng: RngStreams,
  _staticData: StaticData
): CombatState {
  if (state.missionResult !== 'none') return state

  // 1. increment tick
  let s: CombatState = { ...state, tick: state.tick + 1, eventLog: [] }

  // 1.5. update current visibility before command generation
  s = stepDetection(s)

  // 2. apply player commands (auto-pilot overrides movement; fire commands always pass through)
  const playerShip = s.entities.get('ship.player') as ShipEntity | undefined
  const effectiveCmds = playerShip?.autoPilot
    ? [...commands.filter(c => c.type === 'fire.slot' || c.type.startsWith('fire.')),
       ...generateAutoPilotCommands(s)]
    : commands
  s = applyCommands(s, effectiveCmds, rng)

  // 3. auto-fire commands for weapons in auto mode
  s = applyCommands(s, generateAutoFireCommands(s), rng)

  // 4. generate and apply AI commands
  const aiCmds = generateAiCommands(s, rng.ai)
  s = applyCommands(s, aiCmds, rng)

  // 5. movement step
  s = stepMovement(s)

  // 5.5. detection update (uses current positions after movement)
  s = stepDetection(s)

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
  const playerShip = player as ShipEntity

  const enemies = [...state.entities.values()].filter(
    e => e.kind === 'ship' && !(e as ShipEntity).destroyed && (e as ShipEntity).team === 'enemy' &&
         state.detectedByPlayer.has(e.id)
  ) as ShipEntity[]

  const buildings = [...state.entities.values()].filter(
    e => e.kind === 'building' && !(e as BuildingEntity).destroyed && (e as BuildingEntity).team === 'enemy' &&
         state.detectedByPlayer.has(e.id)
  ) as BuildingEntity[]

  const surfaceTargets: { pos: Vec3; kind: 'ship' | 'building' }[] = [
    ...enemies.map(e => ({ pos: e.pos, kind: 'ship' as const })),
    ...buildings.map(b => ({ pos: b.pos, kind: 'building' as const })),
  ]

  const projectileTargets: { pos: Vec3; kind: 'projectile' }[] = [...state.entities.values()]
    .filter(e => e.kind === 'projectile')
    .map(e => e as ProjectileEntity)
    .filter(p => isIncomingThreat(p, playerShip, state.entities))
    .map(p => ({ pos: p.pos, kind: 'projectile' as const }))

  if (surfaceTargets.length === 0 && projectileTargets.length === 0) return cmds

  for (const [weaponSlot, weapon] of player.weapons.entries()) {
    if (!weapon.autoFire || weapon.cooldownTick > 0 || weapon.ammo <= 0) continue

    const candidates = weapon.type === 'torpedo'
      ? surfaceTargets.filter(t => t.kind === 'ship')
      : weapon.type === 'aa' && projectileTargets.length > 0
        ? projectileTargets
        : surfaceTargets
    if (candidates.length === 0) continue

    let nearest = candidates[0]!
    let minDist = Infinity
    for (const target of candidates) {
      const dx = target.pos.x - player.pos.x
      const dy = target.pos.y - player.pos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < minDist) { minDist = d; nearest = target }
    }

    const maxRange = getWeaponConfig(weapon.id, weapon.type).maxRange
    if (minDist > maxRange) continue   // target out of range
    cmds.push({
      tick: state.tick,
      actorId: 'ship.player',
      type: 'fire.slot',
      value: weaponSlot,
      target: { ...nearest.pos },
    })
  }

  return cmds
}

function isIncomingThreat(projectile: ProjectileEntity, player: ShipEntity, entities: Map<string, Entity>): boolean {
  if (!isInterceptableProjectile(projectile)) return false
  const owner = entities.get(projectile.ownerId)
  const ownerTeam = owner?.kind === 'ship' ? owner.team : undefined
  if (ownerTeam !== 'enemy') return false
  const dx = projectile.pos.x - player.pos.x
  const dy = projectile.pos.y - player.pos.y
  return dx * dx + dy * dy <= player.detectionRange * player.detectionRange
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
    } else if (cmd.type === 'fire.slot') {
      s = fireSlotAndTrack(s, cmd.actorId, cmd.value, cmd.target, ship.team, rng)
    } else if (cmd.type === 'fire.primary') {
      s = fireAndTrack(s, cmd.actorId, 'gun', cmd.target, ship.team, rng)
    } else if (cmd.type === 'fire.secondary') {
      s = fireAndTrack(s, cmd.actorId, 'secondary', cmd.target, ship.team, rng)
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

function fireSlotAndTrack(
  s: CombatState,
  actorId: string,
  weaponSlot: number | undefined,
  target: { x: number; y: number; z: number } | undefined,
  team: 'player' | 'enemy',
  rng: RngStreams
): CombatState {
  if (!target || weaponSlot === undefined) return s
  const slot = Math.trunc(weaponSlot)
  const weapon = getWeaponAtSlot(s, actorId, slot)
  if (!weapon) return s

  const before = countAmmoAtSlot(s, actorId, slot)
  s = fireWeaponAtSlot(s, actorId, slot, target, rng.combat)
  const after = countAmmoAtSlot(s, actorId, slot)
  if (team === 'player' && after < before) {
    s = {
      ...s,
      metrics: {
        ...s.metrics,
        playerAmmoSpent: s.metrics.playerAmmoSpent + 1,
        shotCountByWeapon: {
          ...s.metrics.shotCountByWeapon,
          [weapon.id]: (s.metrics.shotCountByWeapon[weapon.id] ?? 0) + 1,
        },
      },
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

function getWeaponAtSlot(state: CombatState, actorId: string, weaponSlot: number): ShipEntity['weapons'][number] | undefined {
  const entity = state.entities.get(actorId)
  if (!entity || entity.kind !== 'ship') return undefined
  const ship = entity as ShipEntity
  return ship.weapons[weaponSlot]
}

function countAmmoAtSlot(state: CombatState, actorId: string, weaponSlot: number): number {
  return getWeaponAtSlot(state, actorId, weaponSlot)?.ammo ?? 0
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
