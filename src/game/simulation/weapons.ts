import type { BuildingEntity, CombatState, ShipEntity, ProjectileEntity, WeaponType, CombatEvent } from './types'
import type { SeededRandom } from './random'
import { applyDamage, checkDestroyed } from './damage'

export interface WeaponConfig {
  speed: number
  damageMin: number
  damageMax: number
  lifetime: number
  cooldown: number
  hitRadius: number
  maxRange: number
  maxHeight: number  // arc peak in world units (0 = flat/torpedo)
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  gun:     { speed: 20, damageMin: 30,  damageMax: 50,  lifetime: 60,  cooldown: 15, hitRadius: 12, maxRange: 1200, maxHeight: 220  },
  torpedo: { speed: 8,  damageMin: 80,  damageMax: 120, lifetime: 150, cooldown: 60, hitRadius: 20, maxRange: 1200, maxHeight: 0    },
  aa:      { speed: 25, damageMin: 15,  damageMax: 25,  lifetime: 40,  cooldown: 8,  hitRadius: 10, maxRange: 1000, maxHeight: 130  },
  missile: { speed: 12, damageMin: 60,  damageMax: 90,  lifetime: 200, cooldown: 90, hitRadius: 25, maxRange: 2400, maxHeight: 450  },
}

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

  const cfg = WEAPON_CONFIGS[weaponType]
  const dx = target.x - ship.pos.x
  const dy = target.y - ship.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // out of range: silently ignore
  if (dist > cfg.maxRange) return state

  const dirX = dist > 0 ? dx / dist : 1
  const dirY = dist > 0 ? dy / dist : 0

  const damage = rng.nextFloat(cfg.damageMin, cfg.damageMax)
  const projId = `proj.${actorId}.${weaponType}.${projectileCounter++}`
  const flightTicks = Math.max(1, Math.ceil(dist / cfg.speed))

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

  const entities = new Map(state.entities)
  entities.set(actorId, { ...ship, weapons: updatedWeapons })
  entities.set(projId, projectile)

  return { ...state, entities, eventLog: [...state.eventLog, firedEvent] }
}

export function stepProjectiles(state: CombatState, rng: SeededRandom): CombatState {
  const entities = new Map(state.entities)
  const events: CombatEvent[] = []
  let metrics = { ...state.metrics }

  const ships = [...entities.values()].filter(
    e => e.kind === 'ship' && !e.destroyed
  ) as ShipEntity[]

  const buildings = [...entities.values()].filter(
    e => e.kind === 'building' && !e.destroyed
  ) as BuildingEntity[]

  for (const [id, entity] of entities) {
    if (entity.kind !== 'projectile' || entity.destroyed) continue

    let proj = { ...entity } as ProjectileEntity

    proj = {
      ...proj,
      pos: { x: proj.pos.x + proj.vel.x, y: proj.pos.y + proj.vel.y, z: 0 },
      lifetime: proj.lifetime - 1,
    }

    if (proj.lifetime <= 0) {
      events.push({
        tick: state.tick,
        type: 'weapon.missed',
        sourceId: proj.ownerId,
        weaponId: proj.weaponType,   // reuse field to pass type to sound system
        position: { ...proj.pos },
      })
      entities.set(id, { ...proj, destroyed: true })
      continue
    }

    const cfg = WEAPON_CONFIGS[proj.weaponType]
    let hit = false

    for (const ship of ships) {
      const owner = entities.get(proj.ownerId)
      if (owner && owner.kind === 'ship' && (owner as ShipEntity).team === ship.team) continue

      const dx = ship.pos.x - proj.pos.x
      const dy = ship.pos.y - proj.pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < cfg.hitRadius) {
        let updatedShip = applyDamage(ship, proj.damage)
        updatedShip = checkDestroyed(updatedShip)

        events.push(
          { tick: state.tick, type: 'weapon.hit',   sourceId: proj.ownerId, targetId: ship.id, damage: proj.damage, position: { ...proj.pos }, weaponId: proj.weaponType },
          { tick: state.tick, type: 'damage.taken', sourceId: proj.ownerId, targetId: ship.id, damage: proj.damage },
        )

        const wType = proj.weaponType
        metrics = {
          ...metrics,
          hitCountByWeapon: { ...metrics.hitCountByWeapon, [wType]: (metrics.hitCountByWeapon[wType] ?? 0) + 1 },
          damageByWeapon:   { ...metrics.damageByWeapon,   [wType]: (metrics.damageByWeapon[wType]   ?? 0) + proj.damage },
        }
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

    if (!hit && proj.weaponType !== 'torpedo') {
      for (const building of buildings) {
        const owner = entities.get(proj.ownerId)
        if (owner && owner.kind === 'ship' && building.team !== 'neutral' && (owner as ShipEntity).team === building.team) continue

        const dx = building.pos.x - proj.pos.x
        const dy = building.pos.y - proj.pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < Math.max(cfg.hitRadius, building.radius)) {
          let updatedBuilding = applyDamage(building, proj.damage)
          updatedBuilding = checkDestroyed(updatedBuilding)

          events.push(
            { tick: state.tick, type: 'weapon.hit', sourceId: proj.ownerId, targetId: building.id, damage: proj.damage, position: { ...proj.pos }, weaponId: proj.weaponType },
            { tick: state.tick, type: 'damage.taken', sourceId: proj.ownerId, targetId: building.id, damage: proj.damage },
          )

          const wType = proj.weaponType
          metrics = {
            ...metrics,
            hitCountByWeapon: { ...metrics.hitCountByWeapon, [wType]: (metrics.hitCountByWeapon[wType] ?? 0) + 1 },
            damageByWeapon:   { ...metrics.damageByWeapon,   [wType]: (metrics.damageByWeapon[wType]   ?? 0) + proj.damage },
          }

          if (updatedBuilding.destroyed && !building.destroyed) {
            events.push({ tick: state.tick, type: 'entity.destroyed', targetId: building.id, position: { ...building.pos } })
          }

          entities.set(building.id, updatedBuilding)
          proj = { ...proj, destroyed: true }
          hit = true
          break
        }
      }
    }

    entities.set(id, proj)
    void hit  // already set proj.destroyed above
  }

  return { ...state, entities, eventLog: [...state.eventLog, ...events], metrics }
}
