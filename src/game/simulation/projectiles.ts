import type { BuildingEntity, CombatEvent, CombatState, ProjectileEntity, ShipEntity } from './types'
import type { SeededRandom } from './random'
import { applyDamage, checkDestroyed } from './damage'
import { getWeaponStrategy } from './weapon-strategies'

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

  for (const [id, entity] of entities) {
    if (entity.kind !== 'projectile' || entity.destroyed) continue

    let proj = advanceProjectile(entity as ProjectileEntity)

    if (proj.lifetime <= 0) {
      events.push(makeMissEvent(state.tick, proj))
      entities.set(id, { ...proj, destroyed: true })
      continue
    }

    const strategy = getWeaponStrategy(proj.weaponType)
    let hit = false

    for (const ship of ships) {
      const owner = entities.get(proj.ownerId)
      if (owner && owner.kind === 'ship' && owner.team === ship.team) continue
      if (!strategy.canDamageShip(ship)) continue

      if (distance2d(ship.pos, proj.pos) < strategy.config.hitRadius) {
        let updatedShip = applyDamage(ship, proj.damage)
        updatedShip = checkDestroyed(updatedShip)

        events.push(
          makeHitEvent(state.tick, proj, ship.id),
          makeDamageEvent(state.tick, proj, ship.id),
        )
        metrics = recordWeaponHit(metrics, proj.weaponType, proj.damage)

        if (ship.team === 'player') {
          metrics = { ...metrics, playerDamageTaken: metrics.playerDamageTaken + proj.damage }
        }

        if (updatedShip.destroyed && !ship.destroyed) {
          events.push({ tick: state.tick, type: 'entity.destroyed', targetId: ship.id })
          if (ship.team === 'enemy') {
            metrics = { ...metrics, enemiesDestroyed: metrics.enemiesDestroyed + 1 }
          }
        }

        entities.set(ship.id, updatedShip)
        proj = { ...proj, destroyed: true }
        hit = true
        break
      }
    }

    if (!hit) {
      for (const building of buildings) {
        const owner = entities.get(proj.ownerId)
        const ownerTeam = owner?.kind === 'ship' ? owner.team : undefined
        if (ownerTeam && building.team !== 'neutral' && ownerTeam === building.team) continue
        if (!strategy.canTargetBuilding(building)) continue

        if (distance2d(building.pos, proj.pos) < strategy.buildingHitRadius(building)) {
          let updatedBuilding = applyDamage(building, proj.damage)
          updatedBuilding = checkDestroyed(updatedBuilding)

          events.push(
            makeHitEvent(state.tick, proj, building.id),
            makeDamageEvent(state.tick, proj, building.id),
          )
          metrics = recordWeaponHit(metrics, proj.weaponType, proj.damage)

          if (updatedBuilding.destroyed && !building.destroyed) {
            events.push({ tick: state.tick, type: 'entity.destroyed', targetId: building.id, position: { ...building.pos } })
          }

          entities.set(building.id, updatedBuilding)
          proj = { ...proj, destroyed: true }
          break
        }
      }
    }

    entities.set(id, proj)
  }

  return { ...state, entities, eventLog: [...state.eventLog, ...events], metrics }
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
    weaponId: proj.weaponType,
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
    weaponId: proj.weaponType,
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

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}
