import type { BuildingEntity, CombatEvent, CombatState, ProjectileEntity, ShipEntity } from './types'
import type { SeededRandom } from './random'
import { applyDamage, checkDestroyed } from './damage'
import { isInterceptableProjectile, projectileInterceptRadius } from './interception'
import { getWeaponConfig, getWeaponStrategy } from './weapon-strategies'

export function stepProjectiles(state: CombatState, _rng: SeededRandom): CombatState {
  const entities = new Map(state.entities)
  const events: CombatEvent[] = []
  let metrics = { ...state.metrics }

  const ships = [...entities.values()].filter(
    e => e.kind === 'ship' && !e.destroyed,
  ) as ShipEntity[]

  const buildings = [...entities.values()].filter(
    e => e.kind === 'building' && !e.destroyed,
  ) as BuildingEntity[]

  const projectiles = [...entities.values()].filter(
    e => e.kind === 'projectile' && !e.destroyed,
  ) as ProjectileEntity[]

  const projectileEntries = [...entities.entries()]
    .filter(([, entity]) => entity.kind === 'projectile')
    .sort(([, a], [, b]) => projectilePriority(b as ProjectileEntity) - projectilePriority(a as ProjectileEntity))

  for (const [id] of projectileEntries) {
    const entity = entities.get(id)
    if (!entity || entity.kind !== 'projectile' || entity.destroyed) continue

    const prevProj = entity as ProjectileEntity
    let proj = advanceProjectile(prevProj)

    const strategy = getWeaponStrategy(proj.weaponType)
    const config = getWeaponConfig(proj.weaponId ?? proj.weaponType, proj.weaponType)
    const owner = entities.get(proj.ownerId)
    const ownerTeam = owner && (owner.kind === 'ship' || owner.kind === 'aircraft') ? owner.team : undefined
    let hit = false

    if (proj.weaponType === 'aa') {
      for (const targetProjectile of projectiles) {
        const currentProjectile = entities.get(targetProjectile.id)
        if (!currentProjectile || currentProjectile.kind !== 'projectile' || currentProjectile.destroyed) continue
        if (currentProjectile.id === proj.id) continue
        if (!isInterceptableProjectile(currentProjectile)) continue

        const targetOwner = entities.get(currentProjectile.ownerId)
        const targetOwnerTeam = targetOwner?.kind === 'ship' ? targetOwner.team : undefined
        if (ownerTeam && targetOwnerTeam && ownerTeam === targetOwnerTeam) continue

        const impactRadius = config.hitRadius + projectileInterceptRadius(currentProjectile)
        const impact = segmentCircleImpact(prevProj.pos, proj.pos, currentProjectile.pos, impactRadius)
        if (impact) {
          const impactProj = { ...proj, pos: impact }
          events.push(
            makeHitEvent(state.tick, impactProj, currentProjectile.id),
            { tick: state.tick, type: 'entity.destroyed', targetId: currentProjectile.id, position: { ...currentProjectile.pos } },
          )
          metrics = recordWeaponIntercept(metrics, proj.weaponType)
          entities.set(currentProjectile.id, { ...currentProjectile, destroyed: true })
          proj = { ...proj, pos: impact, destroyed: true }
          hit = true
          break
        }
      }
    }

    if (!hit && proj.weaponType === 'aa') {
      for (const plane of entities.values()) {
        if (plane.kind !== 'aircraft' || plane.destroyed || plane.team === ownerTeam) continue
        const impact = segmentCircleImpact(prevProj.pos, proj.pos, plane.pos, config.hitRadius + 22)
        if (!impact) continue
        const hp = Math.max(0, plane.hp - proj.damage)
        entities.set(plane.id, hp === 0
          ? { ...plane, hp, destroyed: true, phase: 'crashing', crashTick: state.tick, vel: { ...plane.vel, z: -.4 } }
          : { ...plane, hp })
        events.push(makeHitEvent(state.tick, proj, plane.id))
        metrics = recordWeaponHit(metrics, proj.weaponType, proj.damage)
        if (hp === 0) events.push({ tick: state.tick, type: 'entity.destroyed', targetId: plane.id, position: { ...plane.pos } })
        proj = { ...proj, destroyed: true }
        hit = true
        break
      }
    }

    if (hit) {
      entities.set(id, proj)
      continue
    }

    for (const ship of ships) {
      const currentShip = entities.get(ship.id)
      if (!currentShip || currentShip.kind !== 'ship' || currentShip.destroyed) continue
      if (ownerTeam && ownerTeam === currentShip.team) continue
      if (!strategy.canDamageShip(currentShip)) continue

      const impact = segmentCircleImpact(prevProj.pos, proj.pos, currentShip.pos, config.hitRadius)
      if (impact) {
        const impactProj = { ...proj, pos: impact }
        let updatedShip = applyDamage(currentShip, proj.damage)
        updatedShip = checkDestroyed(updatedShip)

        events.push(
          makeHitEvent(state.tick, impactProj, currentShip.id),
          makeDamageEvent(state.tick, impactProj, currentShip.id),
        )
        metrics = recordWeaponHit(metrics, proj.weaponType, proj.damage)

        if (currentShip.team === 'player') {
          metrics = { ...metrics, playerDamageTaken: metrics.playerDamageTaken + proj.damage }
        }

        if (updatedShip.destroyed && !currentShip.destroyed) {
          events.push({ tick: state.tick, type: 'entity.destroyed', targetId: currentShip.id, position: { ...currentShip.pos } })
          if (currentShip.team === 'enemy') {
            metrics = { ...metrics, enemiesDestroyed: metrics.enemiesDestroyed + 1 }
          }
        }

        entities.set(currentShip.id, updatedShip)
        proj = { ...proj, destroyed: true }
        hit = true
        break
      }
    }

    if (!hit) {
      for (const building of buildings) {
        const currentBuilding = entities.get(building.id)
        if (!currentBuilding || currentBuilding.kind !== 'building' || currentBuilding.destroyed) continue
        if (ownerTeam && currentBuilding.team !== 'neutral' && ownerTeam === currentBuilding.team) continue
        if (!strategy.canTargetBuilding(currentBuilding)) continue

        const impact = segmentCircleImpact(prevProj.pos, proj.pos, currentBuilding.pos, Math.max(config.hitRadius, currentBuilding.radius))
        if (impact) {
          const impactProj = { ...proj, pos: impact }
          let updatedBuilding = applyDamage(currentBuilding, proj.damage)
          updatedBuilding = checkDestroyed(updatedBuilding)

          events.push(
            makeHitEvent(state.tick, impactProj, currentBuilding.id),
            makeDamageEvent(state.tick, impactProj, currentBuilding.id),
          )
          metrics = recordWeaponHit(metrics, proj.weaponType, proj.damage)

          if (updatedBuilding.destroyed && !currentBuilding.destroyed) {
            events.push({ tick: state.tick, type: 'entity.destroyed', targetId: currentBuilding.id, position: { ...currentBuilding.pos } })
          }

          entities.set(currentBuilding.id, updatedBuilding)
          proj = { ...proj, destroyed: true }
          hit = true
          break
        }
      }
    }

    if (!hit && proj.lifetime <= 0) {
      events.push(makeMissEvent(state.tick, proj))
      entities.set(id, { ...proj, destroyed: true })
      continue
    }

    entities.set(id, proj)
  }

  return { ...state, entities, eventLog: [...state.eventLog, ...events], metrics }
}

function projectilePriority(proj: ProjectileEntity): number {
  return proj.weaponType === 'aa' ? 1 : 0
}

function advanceProjectile(proj: ProjectileEntity): ProjectileEntity {
  return {
    ...proj,
    pos: { x: proj.pos.x + proj.vel.x, y: proj.pos.y + proj.vel.y, z: 0 },
    lifetime: proj.lifetime - 1,
  }
}

function makeMissEvent(tick: number, proj: ProjectileEntity): CombatEvent {
  return {
    tick,
    type: 'weapon.missed',
    sourceId: proj.ownerId,
    weaponId: proj.weaponId ?? proj.weaponType,
    position: { ...proj.pos },
  }
}

function makeHitEvent(tick: number, proj: ProjectileEntity, targetId: string): CombatEvent {
  return {
    tick,
    type: 'weapon.hit',
    sourceId: proj.ownerId,
    targetId,
    damage: proj.damage,
    position: { ...proj.pos },
    weaponId: proj.weaponId ?? proj.weaponType,
  }
}

function makeDamageEvent(tick: number, proj: ProjectileEntity, targetId: string): CombatEvent {
  return {
    tick,
    type: 'damage.taken',
    sourceId: proj.ownerId,
    targetId,
    damage: proj.damage,
  }
}

function recordWeaponHit(
  metrics: CombatState['metrics'],
  weaponType: ProjectileEntity['weaponType'],
  damage: number,
): CombatState['metrics'] {
  return {
    ...metrics,
    hitCountByWeapon: {
      ...metrics.hitCountByWeapon,
      [weaponType]: (metrics.hitCountByWeapon[weaponType] ?? 0) + 1,
    },
    damageByWeapon: {
      ...metrics.damageByWeapon,
      [weaponType]: (metrics.damageByWeapon[weaponType] ?? 0) + damage,
    },
  }
}

function recordWeaponIntercept(
  metrics: CombatState['metrics'],
  weaponType: ProjectileEntity['weaponType'],
): CombatState['metrics'] {
  return {
    ...metrics,
    hitCountByWeapon: {
      ...metrics.hitCountByWeapon,
      [weaponType]: (metrics.hitCountByWeapon[weaponType] ?? 0) + 1,
    },
  }
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function segmentCircleImpact(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  center: { x: number; y: number; z: number },
  radius: number,
): { x: number; y: number; z: number } | undefined {
  const sx = to.x - from.x
  const sy = to.y - from.y
  const lenSq = sx * sx + sy * sy
  const t = lenSq > 0
    ? Math.max(0, Math.min(1, ((center.x - from.x) * sx + (center.y - from.y) * sy) / lenSq))
    : 0
  const impact = {
    x: from.x + sx * t,
    y: from.y + sy * t,
    z: 0,
  }

  return distance2d(impact, center) <= radius ? impact : undefined
}
