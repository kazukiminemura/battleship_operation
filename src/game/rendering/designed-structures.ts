import * as THREE from 'three'
import type { DesignedStructure } from '../data/ship-design-layout'
import type { HistoricalShipProfile } from './historical-ship-profiles'
import { addHistoricalSuperstructure } from './historical-superstructure'
import { bowSheer } from './naval-geometry'
import { blenderBattleshipPart } from './blender-battleship'

type Palette = Record<'hull' | 'metal' | 'dark' | 'armor' | 'glass', THREE.Material>

export function addDesignedStructures(parent: THREE.Group, parts: readonly DesignedStructure[], profile: HistoricalShipProfile, length: number, beam: number, height: number, materials: Palette): void {
  for (const part of parts) {
    const group = new THREE.Group()
    group.name = part.name
    group.userData = { designInstanceId: part.instanceId, partId: part.partId, category: part.category, internal: part.internal }
    const x = -part.mount.y * length * 0.42
    group.position.set(x, height * 0.44 + bowSheer(0.5 + x / length, height), part.mount.x * beam * 0.30)
    group.rotation.y = -part.rotation * Math.PI / 180
    parent.add(group)
    // Internal machinery remains in the design snapshot, below the opaque weather deck.
    if (part.internal) { group.visible = false; continue }
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh)
      return mesh
    }
    const width = Math.max(0.08, beam * part.footprint.beam * 0.60)
    const depth = Math.max(0.10, length * part.footprint.length * 0.84)
    if (part.category === 'bridge') {
      addHistoricalSuperstructure(group, profile, length, beam, 0, { x: 0, y: 0 }, materials, [], true)
      if (part.partId.includes('.rear.')) group.scale.y = 0.72
    } else if (part.category === 'funnel') {
      const h = length * profile.funnelHeight * (part.partId.includes('small') ? 0.8 : 1)
      if (profile.kind === 'battleship') {
        const funnel = blenderBattleshipPart('funnel')
        funnel.scale.set(depth / 0.88, h / 0.955, width / 0.61)
        group.add(funnel)
        continue
      }
      const stack = add(new THREE.CylinderGeometry(width * 0.43, width * 0.50, h, 24), materials.hull, h / 2)
      stack.scale.x = depth / width
      const cap = add(new THREE.CylinderGeometry(width * 0.45, width * 0.45, h * 0.12, 24), materials.dark, h)
      cap.scale.x = depth / width
    } else {
      add(new THREE.BoxGeometry(depth, 0.10, width), materials.hull, 0.05)
      if (part.partId.includes('radar') || part.partId.includes('aim')) {
        add(new THREE.CylinderGeometry(0.013, 0.018, 0.3, 8), materials.metal, 0.23)
        add(new THREE.BoxGeometry(0.025, 0.12, Math.max(width, 0.22)), materials.dark, 0.39)
      } else {
        add(new THREE.CylinderGeometry(width * 0.30, width * 0.35, 0.12, 12), materials.metal, 0.15)
      }
    }
  }
}
