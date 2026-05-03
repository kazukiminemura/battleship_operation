import type { CombatState, ShipEntity, ProjectileEntity, WeaponType, CombatEvent } from './types'
import type { SeededRandom } from './random'
import { getWeaponConfig } from './weapon-strategies'
import { GUN_PROFILES, calcDispersionHalfAngle } from './gun-profiles'
import { firingArcForWeapon, isDirectionWithinFiringArc } from './firing-arcs'
export { WEAPON_CONFIGS } from './weapon-strategies'

let projectileCounter = 0

const SHIP_MOUNT_DIMS: Record<string, { l: number; w: number }> = {
  'hull.destroyer.basic':        { l: 145, w: 30 },
  'hull.dd.improved':            { l: 155, w: 32 },
  'hull.dd.elite':               { l: 165, w: 34 },
  'hull.enemy.destroyer.basic':  { l: 90,  w: 20 },
  'hull.cruiser.player':         { l: 205, w: 48 },
  'hull.cl.heavy':               { l: 240, w: 58 },
  'hull.ca.elite':               { l: 250, w: 62 },
  'hull.cruiser.basic':          { l: 165, w: 36 },
  'hull.battleship.basic':       { l: 285, w: 68 },
  'hull.bb.fast':                { l: 290, w: 70 },
  'hull.bb.super':               { l: 310, w: 82 },
  'hull.bb.yukimura':            { l: 278, w: 74 },
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
  const muzzle = weaponMuzzlePosition(ship, weapon, weaponIdx, target)
  const dx = target.x - muzzle.x
  const dy = target.y - muzzle.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist > cfg.maxRange) return state
  if (!isWithinFiringArc(ship, weapon, dx, dy)) return state

  const baseDirX = dist > 0 ? dx / dist : 1
  const baseDirY = dist > 0 ? dy / dist : 0

  const requestedBarrels = weapon.barrels ?? defaultBarrelsForWeapon(weapon.id, weaponType)
  const barrelOffsets = barrelMuzzleOffsets(Math.min(requestedBarrels, weapon.ammo), weaponType)

  const profile = (weaponType === 'gun' || weaponType === 'secondary')
    ? GUN_PROFILES[weapon.id]
    : undefined

  const entities = new Map(state.entities)
  const flightTicks = Math.max(1, Math.ceil(dist / cfg.speed))
  const muzzlePositions: Array<{ x: number; y: number; z: number }> = []

  for (let barrelIndex = 0; barrelIndex < barrelOffsets.length; barrelIndex++) {
    const barrelOffset = barrelOffsets[barrelIndex]!
    let dirX = baseDirX
    let dirY = baseDirY

    if (profile) {
      const halfAngle = calcDispersionHalfAngle(profile, dist, cfg.maxRange)
      const spread = rng.nextFloat(-halfAngle, halfAngle)
      ;[dirX, dirY] = rotateDir(dirX, dirY, spread)
    } else if (weaponType === 'torpedo') {
      ;[dirX, dirY] = rotateDir(dirX, dirY, torpedoFanAngle(barrelIndex, barrelOffsets.length))
    }

    const launchPos = offsetMuzzleByBarrel(muzzle, baseDirX, baseDirY, barrelOffset)
    muzzlePositions.push(launchPos)
    const damage = rng.nextFloat(cfg.damageMin, cfg.damageMax)
    const projId = `proj.${actorId}.${weaponType}.${projectileCounter++}`

    const projectile: ProjectileEntity = {
      kind: 'projectile',
      id: projId,
      pos: launchPos,
      vel: { x: dirX * cfg.speed, y: dirY * cfg.speed, z: 0 },
      ownerId: actorId,
      weaponId: weapon.id,
      weaponType,
      launchPos,
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
    i === weaponIdx ? { ...w, cooldownTick: cfg.cooldown, ammo: Math.max(0, w.ammo - barrelOffsets.length) } : w
  )

  const firedEvent: CombatEvent = {
    tick: state.tick,
    type: 'weapon.fired',
    sourceId: actorId,
    weaponId: weapon.id,
    position: { ...muzzle },
    targetPosition: { ...target },
    salvoCount: barrelOffsets.length,
    muzzlePositions,
  }

  entities.set(actorId, { ...ship, weapons: updatedWeapons })

  return { ...state, entities, eventLog: [...state.eventLog, firedEvent] }
}

function torpedoFanAngle(index: number, count: number): number {
  if (count <= 1) return 0
  const totalFan = Math.min(0.34, 0.10 + count * 0.055)
  return (index - (count - 1) / 2) * (totalFan / (count - 1))
}

function rotateDir(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c - y * s, x * s + y * c]
}

function barrelMuzzleOffsets(barrels: number, weaponType: WeaponType): number[] {
  const count = Math.min(4, Math.max(1, Math.round(Number.isFinite(barrels) ? barrels : 1)))
  const step = weaponType === 'gun' ? 5.2
    : weaponType === 'secondary' ? 3.4
      : weaponType === 'torpedo' ? 4.2
        : weaponType === 'missile' ? 3.2
          : 1.1
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step)
}

function offsetMuzzleByBarrel(
  muzzle: { x: number; y: number; z: number },
  dirX: number,
  dirY: number,
  lateralOffset: number,
): { x: number; y: number; z: number } {
  return {
    x: muzzle.x - dirY * lateralOffset,
    y: muzzle.y + dirX * lateralOffset,
    z: muzzle.z,
  }
}

function defaultBarrelsForWeapon(weaponId: string, weaponType: WeaponType): number {
  if (weaponId.includes('single')) return 1
  if (weaponId.includes('.twin')) return 2
  if (weaponType === 'torpedo' || weaponType === 'missile') return 4
  if (weaponType === 'aa') return 2
  return 1
}

function isWithinFiringArc(ship: ShipEntity, weapon: ShipEntity['weapons'][number], dx: number, dy: number): boolean {
  const relative = Math.atan2(dy, dx) - ship.angle
  const arc = weapon.firingArc ?? firingArcForWeapon(weapon.type, weapon.mount ?? legacyMountFromWeaponId(weapon.id))
  return isDirectionWithinFiringArc(relative, arc)
}

function legacyMountFromWeaponId(weaponId: string): { x: number; y: number } | undefined {
  if (weaponId.includes('.port')) return { x: 0.7, y: 0 }
  if (weaponId.includes('.starboard')) return { x: -0.7, y: 0 }
  if (weaponId.includes('.aft')) return { x: 0, y: 0.7 }
  if (weaponId.includes('.forward')) return { x: 0, y: -0.7 }
  return undefined
}

function weaponMuzzlePosition(
  ship: ShipEntity,
  weapon: ShipEntity['weapons'][number],
  weaponIdx: number,
  target?: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const dim = SHIP_MOUNT_DIMS[ship.templateId] ?? { l: 100, w: 22 }
  const offset = weapon.mount
    ? weaponMountOffset(weapon.mount, dim)
    : weaponLocalOffset(weapon.id, weaponIdx, dim)
  const cosA = Math.cos(ship.angle)
  const sinA = Math.sin(ship.angle)
  const mountWorld = {
    x: ship.pos.x + cosA * offset.lon + sinA * offset.lat,
    y: ship.pos.y + sinA * offset.lon - cosA * offset.lat,
    z: 0,
  }
  if (!target) return mountWorld

  const barrel = weaponMuzzleExtension(weapon.type, weapon.id, dim)
  if (barrel <= 0) return mountWorld

  const dx = target.x - mountWorld.x
  const dy = target.y - mountWorld.y
  const dist = Math.hypot(dx, dy)
  if (dist <= 0.001) return mountWorld

  return {
    x: mountWorld.x + (dx / dist) * barrel,
    y: mountWorld.y + (dy / dist) * barrel,
    z: 0,
  }
}

function weaponMountOffset(mount: { x: number; y: number }, dim: { l: number; w: number }): { lon: number; lat: number } {
  return {
    lon: -mount.y * dim.l * 0.42,
    lat: -mount.x * dim.w * 0.30,
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

function weaponMuzzleExtension(type: WeaponType, weaponId: string, dim: { l: number; w: number }): number {
  if (type === 'torpedo') return dim.w * 0.20
  if (type === 'aa') return dim.w * 0.14
  if (type === 'missile') return dim.w * 0.28
  if (weaponId.includes('460mm')) return dim.l * 0.10
  if (weaponId.includes('406mm')) return dim.l * 0.085
  if (type === 'secondary') return dim.l * 0.045
  return dim.l * 0.060
}
