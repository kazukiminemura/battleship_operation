import type * as THREE from 'three'
import type { CombatEvent, CombatState, ShipEntity, Vec3 } from '../simulation/types'

export function updateWeaponTraverse(mounts: readonly THREE.Group[], ship: ShipEntity, state: CombatState): void {
  if (mounts.length === 0) return

  for (const mount of mounts) {
    if (!mount.userData['canTraverse']) continue
    const weaponId = String(mount.userData['weaponId'] ?? '')
    const target = weaponAimTarget(ship, weaponId, state)
    const baseRotationY = Number(mount.userData['baseRotationY'] ?? 0)
    const desired = target ? turretYawToWorldTarget(ship, target) : baseRotationY
    const current = mount.rotation.y
    mount.rotation.y = current + angularDelta(current, desired) * 0.16
  }
}

function weaponAimTarget(ship: ShipEntity, weaponId: string, state: CombatState): Vec3 | null {
  const recent = recentWeaponTarget(ship, weaponId, state)
  if (recent) return recent
  return nearestHostileTarget(ship, state)
}

function recentWeaponTarget(ship: ShipEntity, weaponId: string, state: CombatState): Vec3 | null {
  let best: CombatEvent | null = null
  for (const ev of state.eventLog) {
    if (ev.type !== 'weapon.fired' || ev.sourceId !== ship.id || !ev.targetPosition) continue
    if (weaponId && ev.weaponId !== weaponId) continue
    if (!best || ev.tick > best.tick) best = ev
  }
  return best?.targetPosition ?? null
}

function nearestHostileTarget(ship: ShipEntity, state: CombatState): Vec3 | null {
  let best: { pos: Vec3; d2: number } | null = null
  for (const entity of state.entities.values()) {
    if (entity.kind !== 'ship') continue
    const target = entity as ShipEntity
    if (target.destroyed || target.team === ship.team) continue
    if (ship.team === 'player' && !state.detectedByPlayer.has(target.id)) continue
    const dx = target.pos.x - ship.pos.x
    const dy = target.pos.y - ship.pos.y
    const d2 = dx * dx + dy * dy
    if (!best || d2 < best.d2) best = { pos: target.pos, d2 }
  }
  return best?.pos ?? null
}

function turretYawToWorldTarget(ship: ShipEntity, target: Vec3): number {
  const dx = target.x - ship.pos.x
  const dy = target.y - ship.pos.y
  const forward = dx * Math.cos(ship.angle) + dy * Math.sin(ship.angle)
  const starboard = dx * Math.sin(ship.angle) - dy * Math.cos(ship.angle)
  return Math.atan2(-forward, -starboard)
}

function angularDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

