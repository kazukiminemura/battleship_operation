import * as THREE from 'three'
import kit from './assets/battleship-kit.json'
import { timberTexture } from './naval-geometry'
import { navalFinishTexture } from './naval-finish'

type Part = keyof typeof kit.parts
const steelFinish = navalFinishTexture()
const palette: Record<string, THREE.Material> = {
  paint: new THREE.MeshStandardMaterial({ color: 0x737b7c, map: steelFinish, bumpMap: steelFinish, bumpScale: 0.004, roughness: 0.78, metalness: 0.18 }),
  edge: new THREE.MeshStandardMaterial({ color: 0x737d7c, map: steelFinish, roughness: 0.65, metalness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x20292a, roughness: 0.60, metalness: 0.35 }),
  red: new THREE.MeshStandardMaterial({ color: 0x702d25, roughness: 0.82, metalness: 0.1 }),
  timber: new THREE.MeshStandardMaterial({ color: 0xddd0b6, map: timberTexture(), roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x244951, roughness: 0.2, metalness: 0.6 }),
}

// Immutable, shared GPU buffers: creating another ship does not reparse/rebuild
// the Blender mesh. No async arrival can overwrite a user's newer design.
const templates = new Map<Part, THREE.Group>()
export function blenderBattleshipPart(part: Part, scale = 1): THREE.Group {
  let template = templates.get(part)
  if (!template) {
    template = new THREE.Group()
    template.name = `blender-${part}`
    template.userData['assetSource'] = 'Blender'
    for (const data of kit.parts[part]) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3))
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2))
      geometry.setIndex(data.indices)
      geometry.computeBoundingSphere()
      const mesh = new THREE.Mesh(geometry, palette[data.material])
      mesh.name = `blender-surface-${part}-${data.material}`
      mesh.castShadow = true; mesh.receiveShadow = true
      template.add(mesh)
    }
    templates.set(part, template)
  }
  const result = template.clone(true)
  result.scale.setScalar(scale)
  return result
}

export const BLENDER_REFERENCE_LENGTH = kit.referenceLength
