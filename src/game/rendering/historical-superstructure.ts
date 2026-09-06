import * as THREE from 'three'
import type { HistoricalShipProfile } from './historical-ship-profiles'
import { blenderBattleshipPart, BLENDER_REFERENCE_LENGTH } from './blender-battleship'

type Palette = Record<'hull' | 'metal' | 'dark' | 'armor' | 'glass', THREE.Material>
interface MountFootprint { x: number; z: number; radius: number }

/** Builds fixed naval architecture separately from the game's traversable weapon mounts. */
export function addHistoricalSuperstructure(
  parent: THREE.Group, profile: HistoricalShipProfile, l: number, w: number, deckY: number,
  tower: { x: number; y: number }, materials: Palette, occupied: readonly MountFootprint[],
  bridgeOnly = false,
): void {
  const root = new THREE.Group()
  root.name = `historical-${profile.kind}`
  parent.add(root)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, group = root) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m)
    return m
  }
  const box = (x: number, y: number, z: number, a: number, b: number, c: number, mat = materials.hull, group = root) =>
    add(new THREE.BoxGeometry(a, b, c), mat, x, y, z, group)
  const pole = (from: THREE.Vector3, to: THREE.Vector3, radius: number, group = root) => {
    const direction = to.clone().sub(from)
    const m = add(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), materials.metal, 0, 0, 0, group)
    m.position.copy(from).add(to).multiplyScalar(0.5)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  }
  const clear = (x: number, z: number, r: number) => occupied.every(m => Math.hypot(m.x - x, m.z - z) > m.radius + r)
  const dd = profile.kind === 'destroyer', bb = profile.kind === 'battleship'
  const bh = l * profile.bridgeHeight
  const bw = w * (dd ? 0.58 : bb ? 0.46 : 0.65)
  const bx = -tower.y * l * 0.36, bz = tower.x * w * 0.34
  const bridge = new THREE.Group()
  bridge.name = `${profile.kind}-bridge`
  bridge.position.set(bx, deckY, bz)
  root.add(bridge)

  if (bb) bridge.add(blenderBattleshipPart('bridge', l / BLENDER_REFERENCE_LENGTH))
  else {
  // Rounded/chamfered houses, with projecting observation decks, rather than a stepped pyramid.
  const house = (x: number, y: number, length: number, height: number, beam: number, group = bridge) => {
    const s = new THREE.Shape()
    const a = length / 2, b = beam / 2, bevel = Math.min(a, b) * 0.3
    s.moveTo(-a, -b); s.lineTo(a - bevel, -b); s.lineTo(a, -b + bevel)
    s.lineTo(a, b - bevel); s.lineTo(a - bevel, b); s.lineTo(-a, b); s.closePath()
    const geometry = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false })
    geometry.rotateX(-Math.PI / 2)
    return add(geometry, materials.hull, x, y, 0, group)
  }
  house(0, 0, bw * 1.05, bh * 0.24, bw)
  if (dd) {
    house(bw * 0.10, bh * 0.24, bw * 0.75, bh * 0.25, bw * 0.88)
    house(bw * 0.10, bh * 0.49, bw * 0.85, bh * 0.04, bw * 1.08)
  } else if (bb) {
    const towerBody = add(new THREE.CylinderGeometry(bw * 0.23, bw * 0.31, bh * 0.64, 10), materials.hull, 0, bh * 0.49, 0, bridge)
    towerBody.scale.x = 0.92
    for (const level of [0.28, 0.43, 0.63, 0.79]) {
      house(bw * 0.05, bh * level, bw * 0.80, bh * 0.026, bw * (level === 0.63 ? 1.08 : 0.85))
    }
    house(bw * 0.08, bh * 0.66, bw * 0.61, bh * 0.12, bw * 0.72)
  } else {
    house(-bw * 0.08, bh * 0.24, bw * 0.85, bh * 0.27, bw * 0.77)
    house(bw * 0.04, bh * 0.51, bw * 0.74, bh * 0.16, bw * 0.84)
    house(bw * 0.07, bh * 0.67, bw * 0.82, bh * 0.03, bw * 1.10)
    house(-bw * 0.12, bh * 0.70, bw * 0.48, bh * 0.13, bw * 0.48)
  }
  const windowY = bh * (dd ? 0.40 : bb ? 0.73 : 0.59)
  for (let i = -2; i <= 2; i++) {
    box(bw * (dd ? 0.48 : bb ? 0.385 : 0.41), windowY, i * bw * 0.115,
      0.008, bh * 0.047, bw * 0.078, materials.glass, bridge)
  }
  // Optical rangefinder, bridge wings, and exposed tripod/yard rigging.
  const directorY = bh * (dd ? 0.57 : 0.87)
  add(new THREE.CylinderGeometry(bw * 0.14, bw * 0.17, bh * 0.10, 12), materials.metal, 0, directorY, 0, bridge)
  box(0, directorY + bh * 0.025, 0, bw * 0.18, bh * 0.048, bw * (bb ? 1.50 : 0.90), materials.metal, bridge)
  for (const side of [-1, 1]) {
    box(0, bh * 0.27, side * bw * 0.6, bw * 0.55, 0.025, bw * 0.24, materials.metal, bridge)
    pole(new THREE.Vector3(-bw * 0.38, bh * 0.15, side * bw * 0.25), new THREE.Vector3(-bw * 0.28, bh * 1.20, 0), l * 0.0015, bridge)
  }
  pole(new THREE.Vector3(-bw * 0.28, bh * 0.4, 0), new THREE.Vector3(-bw * 0.28, bh * 1.35, 0), l * 0.0014, bridge)
  box(-bw * 0.28, bh * 1.13, 0, l * 0.0016, l * 0.0016, w * 0.80, materials.dark, bridge)

  }
  if (bridgeOnly) return
  const placedFunnels: { x: number; radius: number }[] = []
  for (const [index, fraction] of profile.funnelPositions.entries()) {
    const fh = l * profile.funnelHeight
    const radius = w * (bb ? 0.16 : 0.13)
    const x = [0, -0.03, 0.03, -0.06, 0.06].map(offset => l * (fraction + offset)).find(candidate =>
      clear(candidate, 0, radius * 1.1) && Math.abs(candidate - bx) > bw * 0.55 + radius &&
      placedFunnels.every(funnel => Math.abs(candidate - funnel.x) > funnel.radius + radius * 1.4))
    if (x === undefined) continue
    placedFunnels.push({ x, radius })
    const funnel = new THREE.Group()
    funnel.name = `funnel-${index}`
    funnel.position.set(x, deckY, 0); root.add(funnel)
    if (bb) {
      funnel.add(blenderBattleshipPart('funnel', l / BLENDER_REFERENCE_LENGTH))
      continue
    }
    const stack = add(new THREE.CylinderGeometry(radius * 0.85, radius, fh, 24), materials.hull, 0, fh / 2, 0, funnel)
    stack.scale.x = bb ? 1.65 : 1.25
    stack.rotation.z = 0.14
    const cap = add(new THREE.CylinderGeometry(radius * 0.88, radius * 0.90, fh * 0.14, 24), materials.dark, -fh * 0.07, fh, 0, funnel)
    cap.scale.x = stack.scale.x
    cap.rotation.z = 0.14
    // Exhaust lip and ventilation piping.
    for (const side of [-1, 1]) {
      pole(new THREE.Vector3(x + radius * 0.9, deckY, side * radius * 0.8), new THREE.Vector3(x + radius * 0.9, deckY + fh * 0.72, side * radius * 0.8), l * 0.0018)
    }
    box(x, deckY + 0.055, 0, radius * 3.2, 0.11, radius * 2.3)
  }

  // Aft lattice mast and boat-handling cranes give the long middle deck a working-ship silhouette.
  const mx = -l * 0.22, mh = bh * 0.80
  if (clear(mx, 0, w * 0.13)) {
    for (const side of [-1, 1]) pole(new THREE.Vector3(mx + l * 0.018, deckY, side * w * 0.14), new THREE.Vector3(mx, deckY + mh, 0), l * 0.0014)
    pole(new THREE.Vector3(mx - l * 0.02, deckY, 0), new THREE.Vector3(mx, deckY + mh * 1.12, 0), l * 0.0015)
    box(mx, deckY + mh * 0.85, 0, 0.015, 0.015, w * 0.70, materials.dark)
    const cable = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(bx - bw * 0.28, deckY + bh * 1.2, bz), new THREE.Vector3(mx, deckY + mh, 0),
    ])
    root.add(new THREE.Line(cable, new THREE.LineBasicMaterial({ color: 0x465052, transparent: true, opacity: 0.6 })))
  }
  for (const side of [-1, 1]) {
    for (const fraction of (dd ? [-0.075] : [-0.10, -0.185])) {
      const x = l * fraction, z = side * w * 0.32
      if (!clear(x, z, l * 0.035)) continue
      const boat = add(new THREE.SphereGeometry(1, 16, 8), materials.metal, x, deckY + 0.09, z)
      boat.scale.set(l * 0.030, 0.065, w * 0.075)
      const inside = add(new THREE.SphereGeometry(1, 12, 6), materials.armor, x, deckY + 0.145, z)
      inside.scale.set(l * 0.025, 0.013, w * 0.054)
      for (const dx of [-0.016, 0.016]) {
        pole(new THREE.Vector3(x + l * dx, deckY, z - side * w * 0.1), new THREE.Vector3(x + l * dx, deckY + 0.23, z), l * 0.001)
      }
    }
  }

  // Deck hardware and stern handling gear are unarmed fittings, never extra gameplay weapons.
  for (const side of [-1, 1]) {
    for (const fraction of [-0.37, 0.37]) {
      const x = fraction * l, z = side * w * 0.20
      if (!clear(x, z, l * 0.012)) continue
      box(x, deckY + 0.015, z, l * 0.023, 0.025, w * 0.075, materials.dark)
      for (const dx of [-0.006, 0.006]) add(new THREE.CylinderGeometry(l * 0.0025, l * 0.003, l * 0.009, 8), materials.metal, x + l * dx, deckY + l * 0.005, z)
    }
    const sx = -l * 0.38, sz = side * w * 0.22
    if (dd && clear(sx, sz, l * 0.04)) {
      for (const dz of [-0.025, 0.025]) box(sx, deckY + 0.04, sz + dz, l * 0.075, 0.017, 0.012, materials.metal)
      for (let i = 0; i < 4; i++) {
        const drum = add(new THREE.CylinderGeometry(l * 0.004, l * 0.004, w * 0.10, 8), materials.dark, sx + (i - 1.5) * l * 0.015, deckY + 0.06, sz)
        drum.rotation.x = Math.PI / 2
      }
    } else if (!dd && clear(-l * 0.25, side * w * 0.3, l * 0.04)) {
      const base = new THREE.Vector3(-l * 0.25, deckY, side * w * 0.30)
      const top = base.clone().add(new THREE.Vector3(0, bh * 0.33, 0))
      const tip = base.clone().add(new THREE.Vector3(-l * 0.085, bh * 0.18, side * w * 0.08))
      pole(base, top, l * 0.0025); pole(top, tip, l * 0.0018)
      pole(base.clone().add(new THREE.Vector3(0, bh * 0.10, 0)), tip, l * 0.001)
    }
  }
}
