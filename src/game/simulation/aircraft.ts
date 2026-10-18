import type { AircraftEntity, CombatState, ProjectileEntity } from './types'
import { TICKS_PER_SECOND } from './ticker'
import { isOnLand } from './movement'

export function stepAircraft(state: CombatState): CombatState {
  if (state.missionResult !== 'none') return state
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship' || player.destroyed) return state
  const entities = new Map(state.entities)
  const events = [...state.eventLog]
  const interval = 18 * TICKS_PER_SECOND
  for (const base of state.entities.values()) {
    if (base.kind !== 'building' || base.destroyed || !base.templateId.includes('airfield')) continue
    const airborne = [...entities.values()].filter(e => e.kind === 'aircraft' && e.homeId === base.id && !e.destroyed).length
    if (state.tick % interval !== 90 || airborne >= 3) continue
    const id = `aircraft:${base.id}:${state.tick}`
    if (entities.has(id)) continue
    const plane: AircraftEntity = {
      kind: 'aircraft', id, homeId: base.id, bornTick: state.tick,
      pos: { x: base.pos.x - 160, y: base.pos.y, z: 0 },
      vel: { x: 0, y: 0, z: 0 }, angle: 0,
      hp: 28, maxHp: 28, team: 'enemy', destroyed: false, phase: 'takeoff',
    }
    entities.set(id, plane)
    events.push({ tick: state.tick, type: 'entity.spawned', sourceId: base.id, targetId: id, position: { ...plane.pos } })
  }
  for (const entity of entities.values()) {
    if (entity.kind !== 'aircraft') continue
    if (entity.phase === 'crashed') {
      if (state.tick - (entity.impactTick ?? state.tick) >= 2 * TICKS_PER_SECOND) entities.delete(entity.id)
      continue
    }
    if (entity.phase === 'crashing') {
      // Destroyed aircraft remain visible, but cannot attack, return or be targeted.
      const angle = entity.angle + .025
      const speed = Math.hypot(entity.vel.x, entity.vel.y) * .995
      const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: entity.vel.z - .12 }
      const pos = { x: entity.pos.x + vel.x, y: entity.pos.y + vel.y, z: Math.max(0, entity.pos.z + vel.z) }
      entities.set(entity.id, { ...entity, angle, vel, pos,
        ...(pos.z === 0 ? { phase: 'crashed', impactTick: state.tick, impactOnLand: isOnLand(pos.x, pos.y, state.mapObstacles), vel: { x: 0, y: 0, z: 0 } } : {}),
      })
      continue
    }
    if (entity.destroyed || state.tick - entity.bornTick > 90 * TICKS_PER_SECOND) { entities.delete(entity.id); continue }
    const plane = { ...entity, pos: { ...entity.pos }, vel: { ...entity.vel } }
    const home = entities.get(plane.homeId)
    const age = state.tick - plane.bornTick
    if (plane.phase === 'takeoff') {
      plane.vel.x = Math.min(6, 1.2 + age * .06)
      plane.pos.x += plane.vel.x
      plane.pos.z = Math.min(150, Math.max(0, age - 20) * 3)
      if (age >= 75) plane.phase = 'attack'
    } else {
      const target = plane.phase === 'attack' ? player.pos : home && home.kind === 'building' ? home.pos : { x: plane.pos.x + 2000, y: plane.pos.y }
      const dx = target.x - plane.pos.x, dy = target.y - plane.pos.y
      const distance = Math.hypot(dx, dy)
      const desired = Math.atan2(dy, dx)
      const turn = Math.atan2(Math.sin(desired - plane.angle), Math.cos(desired - plane.angle))
      plane.angle += Math.max(-.035, Math.min(.035, turn))
      plane.vel = { x: Math.cos(plane.angle) * 8, y: Math.sin(plane.angle) * 8, z: 0 }
      plane.pos.x += plane.vel.x
      plane.pos.y += plane.vel.y
      plane.pos.z = 150
      if (plane.phase === 'attack' && distance < 220) {
        const flight = 24
        const aim = { x: player.pos.x + player.vel.x * flight, y: player.pos.y + player.vel.y * flight, z: 0 }
        const bomb: ProjectileEntity = {
          kind: 'projectile', id: `bomb:${plane.id}`, ownerId: plane.id,
          weaponType: 'gun', weaponId: 'weapon.aircraft.bomb', pos: { ...plane.pos }, launchPos: { ...plane.pos }, targetPos: aim,
          vel: { x: (aim.x - plane.pos.x) / flight, y: (aim.y - plane.pos.y) / flight, z: 0 },
          lifetime: flight, initialLifetime: flight, maxHeight: 0, damage: 22, destroyed: false,
        }
        entities.set(bomb.id, bomb)
        events.push({ tick: state.tick, type: 'weapon.fired', sourceId: plane.id, weaponId: bomb.weaponId, position: { ...plane.pos }, targetPosition: aim })
        plane.phase = 'return'
      } else if (plane.phase === 'return' && distance < 180) { entities.delete(plane.id); continue }
    }
    entities.set(plane.id, plane)
  }
  return { ...state, entities, eventLog: events }
}
