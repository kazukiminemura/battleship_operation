import type { BuildingEntity, CombatState, Command, Entity, ShipEntity, Vec3, ProjectileEntity } from './types'
import { isInterceptableProjectile } from './interception'
import { getWeaponConfig } from './weapon-strategies'
import { effectiveDetectionRange } from './detection'

/**
 * Generates fire commands for all player weapons that have autoFire enabled.
 * Pure function: only reads state, returns commands.
 */
export function generateAutoFireCommands(state: CombatState): Command[] {
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

  const surfaceTargets: { pos: Vec3; vel: Vec3; kind: 'ship' | 'building' }[] = [
    ...enemies.map(e => ({ pos: e.pos, vel: e.vel, kind: 'ship' as const })),
    ...buildings.map(b => ({ pos: b.pos, vel: { x: 0, y: 0, z: 0 }, kind: 'building' as const })),
  ]

  const projectileTargets: { pos: Vec3; vel: Vec3; kind: 'projectile' }[] = [...state.entities.values()]
    .filter(e => e.kind === 'projectile')
    .map(e => e as ProjectileEntity)
    .filter(p => isIncomingThreat(p, playerShip, state.entities, state.weather))
    .map(p => ({ pos: p.pos, vel: p.vel, kind: 'projectile' as const }))

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

    const cfg = getWeaponConfig(weapon.id, weapon.type)
    if (minDist > cfg.maxRange) continue
    const aimPos = (weapon.type !== 'aa' && nearest.kind === 'ship')
      ? predictLeadPosition(player.pos, nearest, cfg.speed)
      : { ...nearest.pos }
    cmds.push({
      tick: state.tick,
      actorId: 'ship.player',
      type: 'fire.slot',
      value: weaponSlot,
      target: aimPos,
    })
  }

  return cmds
}

function isIncomingThreat(
  projectile: ProjectileEntity,
  player: ShipEntity,
  entities: Map<string, Entity>,
  weather: CombatState['weather'],
): boolean {
  if (!isInterceptableProjectile(projectile)) return false
  const owner = entities.get(projectile.ownerId)
  const ownerTeam = owner?.kind === 'ship' ? owner.team : undefined
  if (ownerTeam !== 'enemy') return false
  const dx = projectile.pos.x - player.pos.x
  const dy = projectile.pos.y - player.pos.y
  const detectionRange = effectiveDetectionRange(player.detectionRange, weather)
  return dx * dx + dy * dy <= detectionRange * detectionRange
}

function predictLeadPosition(
  shooterPos: Vec3,
  target: { pos: Vec3; vel: Vec3 },
  projectileSpeed: number,
): Vec3 {
  let predicted = { ...target.pos }
  for (let i = 0; i < 3; i++) {
    const dx = predicted.x - shooterPos.x
    const dy = predicted.y - shooterPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const tof = dist / projectileSpeed
    predicted = {
      x: target.pos.x + target.vel.x * tof,
      y: target.pos.y + target.vel.y * tof,
      z: 0,
    }
  }
  return predicted
}
