import type { CombatState, ShipEntity, ProjectileEntity, WeaponType, CombatEvent } from './types'
import type { SeededRandom } from './random'
import { getWeaponStrategy } from './weapon-strategies'
import { GUN_PROFILES, calcDispersionHalfAngle } from './gun-profiles'
export { WEAPON_CONFIGS } from './weapon-strategies'

let projectileCounter = 0

export function stepWeaponCooldowns(state: CombatState): CombatState {
  const entities = new Map(state.entities)

  for (const [id, entity] of entities) {
    if (entity.kind !== 'ship' || entity.destroyed) continue
    const ship = entity as ShipEntity
    const weapons = ship.weapons.map(w =>
      w.cooldownTick > 0 ? { ...w, cooldownTick: w.cooldownTick - 1 } : w
    )
    entities.set(id, { ...ship, weapons })
  }

  return { ...state, entities }
}

export function fireWeapon(
  state: CombatState,
  actorId: string,
  weaponType: WeaponType,
  target: { x: number; y: number; z: number },
  rng: SeededRandom
): CombatState {
  const actor = state.entities.get(actorId)
  if (!actor || actor.kind !== 'ship' || actor.destroyed) return state

  const ship = actor as ShipEntity
  const weaponIdx = ship.weapons.findIndex(w => w.type === weaponType)
  if (weaponIdx < 0) return state

  const weapon = ship.weapons[weaponIdx]!
  if (weapon.cooldownTick > 0 || weapon.ammo <= 0) return state

  const cfg = getWeaponStrategy(weaponType).config
  const dx = target.x - ship.pos.x
  const dy = target.y - ship.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > cfg.maxRange) return state

  const baseDirX = dist > 0 ? dx / dist : 1
  const baseDirY = dist > 0 ? dy / dist : 0

  // 連装砲は左右砲身をわずかにオフセットして2発発射
  const isTwin = weapon.id.includes('.twin')
  const barrelOffsets = isTwin ? [-0.008, 0.008] : [0]

  const profile = (weaponType === 'gun' || weaponType === 'secondary')
    ? GUN_PROFILES[weapon.id]
    : undefined

  const entities = new Map(state.entities)
  const flightTicks = Math.max(1, Math.ceil(dist / cfg.speed))

  for (const barrelOffset of barrelOffsets) {
    let dirX = baseDirX
    let dirY = baseDirY

    if (profile) {
      const halfAngle = calcDispersionHalfAngle(profile, dist, cfg.maxRange)
      const spread = rng.nextFloat(-halfAngle, halfAngle) + barrelOffset
      const c = Math.cos(spread)
      const s = Math.sin(spread)
      ;[dirX, dirY] = [dirX * c - dirY * s, dirX * s + dirY * c]
    }

    const damage = rng.nextFloat(cfg.damageMin, cfg.damageMax)
    const projId = `proj.${actorId}.${weaponType}.${projectileCounter++}`

    const projectile: ProjectileEntity = {
      kind: 'projectile',
      id: projId,
      pos: { x: ship.pos.x, y: ship.pos.y, z: 0 },
      vel: { x: dirX * cfg.speed, y: dirY * cfg.speed, z: 0 },
      ownerId: actorId,
      weaponType,
      damage,
      lifetime: Math.min(cfg.lifetime, flightTicks),
      initialLifetime: Math.min(cfg.lifetime, flightTicks),
      maxHeight: cfg.maxHeight,
      destroyed: false,
    }

    entities.set(projId, projectile)
  }

  const updatedWeapons = ship.weapons.map((w, i) =>
    i === weaponIdx ? { ...w, cooldownTick: cfg.cooldown, ammo: w.ammo - 1 } : w
  )

  const firedEvent: CombatEvent = {
    tick: state.tick,
    type: 'weapon.fired',
    sourceId: actorId,
    weaponId: weapon.id,
    position: { ...ship.pos },
  }

  entities.set(actorId, { ...ship, weapons: updatedWeapons })

  return { ...state, entities, eventLog: [...state.eventLog, firedEvent] }
}
