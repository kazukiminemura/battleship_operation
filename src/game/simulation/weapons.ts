import type { CombatState, ShipEntity, ProjectileEntity, WeaponType, CombatEvent } from './types'
import type { SeededRandom } from './random'
import { getWeaponConfig } from './weapon-strategies'
import { GUN_PROFILES, calcDispersionHalfAngle } from './gun-profiles'
export { WEAPON_CONFIGS } from './weapon-strategies'

let projectileCounter = 0

const SHIP_MOUNT_DIMS: Record<string, { l: number; w: number }> = {
  'hull.destroyer.basic': { l: 145, w: 30 },
  'hull.enemy.destroyer.basic': { l: 90, w: 20 },
  'hull.cruiser.basic': { l: 165, w: 36 },
  'hull.cruiser.player': { l: 205, w: 48 },
  'hull.battleship.basic': { l: 285, w: 68 },
  'hull.enemy.boss.dreadnought': { l: 340, w: 82 },
}

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

  return fireWeaponAtSlot(state, actorId, weaponIdx, target, rng)
}

export function fireWeaponAtSlot(
  state: CombatState,
  actorId: string,
  weaponIdx: number,
  target: { x: number; y: number; z: number },
  rng: SeededRandom
): CombatState {
  const actor = state.entities.get(actorId)
  if (!actor || actor.kind !== 'ship' || actor.destroyed) return state

  const ship = actor as ShipEntity
  const weapon = ship.weapons[weaponIdx]!
  if (!weapon) return state
  if (weapon.cooldownTick > 0 || weapon.ammo <= 0) return state

  const weaponType = weapon.type
  const cfg = getWeaponConfig(weapon.id, weaponType)
  const muzzle = weaponMuzzlePosition(ship, weapon.id, weaponIdx)
  const dx = target.x - muzzle.x
  const dy = target.y - muzzle.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > cfg.maxRange) return state
  if (!isWithinFiringArc(ship, weapon.id, dx, dy)) return state

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
      pos: { ...muzzle },
      vel: { x: dirX * cfg.speed, y: dirY * cfg.speed, z: 0 },
      ownerId: actorId,
      weaponId: weapon.id,
      weaponType,
      launchPos: { ...muzzle },
      targetPos: { ...target },
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
    position: { ...muzzle },
    targetPosition: { ...target },
  }

  entities.set(actorId, { ...ship, weapons: updatedWeapons })

  return { ...state, entities, eventLog: [...state.eventLog, firedEvent] }
}

function isWithinFiringArc(ship: ShipEntity, weaponId: string, dx: number, dy: number): boolean {
  const isPort = weaponId.includes('.port')
  const isStarboard = weaponId.includes('.starboard')
  if (!isPort && !isStarboard) return true

  const portX = Math.sin(ship.angle)
  const portY = -Math.cos(ship.angle)
  const sideDot = dx * portX + dy * portY

  if (isPort) return sideDot >= 0
  return sideDot <= 0
}

function weaponMuzzlePosition(ship: ShipEntity, weaponId: string, weaponIdx: number): { x: number; y: number; z: number } {
  const dim = SHIP_MOUNT_DIMS[ship.templateId] ?? { l: 100, w: 22 }
  const offset = weaponLocalOffset(weaponId, weaponIdx, dim)
  const cosA = Math.cos(ship.angle)
  const sinA = Math.sin(ship.angle)
  return {
    x: ship.pos.x + cosA * offset.lon + sinA * offset.lat,
    y: ship.pos.y + sinA * offset.lon - cosA * offset.lat,
    z: 0,
  }
}

function weaponLocalOffset(weaponId: string, weaponIdx: number, dim: { l: number; w: number }): { lon: number; lat: number } {
  if (weaponId.includes('forward')) return { lon: dim.l * 0.34, lat: 0 }
  if (weaponId.includes('center')) return { lon: dim.l * 0.10, lat: 0 }
  if (weaponId.includes('aft')) return { lon: -dim.l * 0.32, lat: 0 }
  if (weaponId.includes('port')) return { lon: -dim.l * 0.08, lat: dim.w * 0.28 }
  if (weaponId.includes('starboard')) return { lon: -dim.l * 0.08, lat: -dim.w * 0.28 }
  if (weaponId.includes('torpedo')) return { lon: -dim.l * 0.03, lat: weaponIdx % 2 === 0 ? dim.w * 0.36 : -dim.w * 0.36 }
  if (weaponId.includes('aa')) return { lon: -dim.l * 0.02, lat: 0 }
  if (weaponId.includes('missile')) return { lon: -dim.l * 0.18, lat: 0 }
  if (weaponIdx === 0) return { lon: dim.l * 0.26, lat: 0 }
  if (weaponIdx === 1) return { lon: -dim.l * 0.26, lat: 0 }
  return { lon: 0, lat: 0 }
}
