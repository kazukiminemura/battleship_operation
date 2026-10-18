import * as THREE from 'three'
import type { ShipEntity } from '../simulation/types'
import { SHIP_DIMS, SHIP_SHAPES, visualScaleForShip } from '../data/ship-dimensions'
import { buildShip } from './three-ship-designer-renderer'
import { combatShipPreviewConfig } from './combat-ship-config'

export interface ShipVisual {
  model: THREE.Object3D
  group: THREE.Group
  weaponMounts: THREE.Group[]
  templateId: string
  scale: number
  team: string
  designKey: string
}

export function shipDesignKey(ship: ShipEntity): string {
  return JSON.stringify([ship.armorBonus, ship.towerMount, ship.designLayout,
    ship.weapons.map(weapon => [weapon.id, weapon.instanceId, weapon.mount, weapon.mounts, weapon.barrels])])
}

export function createShipVisual(ship: ShipEntity, scale: number): ShipVisual {
  const group = new THREE.Group()
  const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
  const shape = SHIP_SHAPES[ship.templateId] ?? 'destroyer'
  const modelScale = scale * visualScaleForShip(shape)
  const l = dim.l * modelScale
  const w = dim.w * modelScale
  const designerShip = buildShip(combatShipPreviewConfig(ship))
  const designerScale = modelScale / 0.04725
  designerShip.rotation.x = Math.PI / 2
  designerShip.scale.setScalar(designerScale)
  designerShip.position.set(0, 0, 10)
  group.add(designerShip)

  const shadow = new THREE.Mesh(
    ellipseShapeGeometry(l * 0.58, w * 0.72, 36),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.30, depthWrite: false }),
  )
  shadow.position.set(-l * 0.02, 5, -5)
  shadow.scale.y = 0.58
  group.add(shadow)

  return { group, model: designerShip, weaponMounts: collectWeaponMounts(designerShip), templateId: ship.templateId, scale, team: ship.team, designKey: shipDesignKey(ship) }
}

function collectWeaponMounts(root: THREE.Object3D): THREE.Group[] {
  const mounts: THREE.Group[] = []
  root.traverse(child => {
    if (child instanceof THREE.Group && child.userData['weaponId']) mounts.push(child)
  })
  return mounts
}

function ellipseShapeGeometry(rx: number, ry: number, steps: number): THREE.ShapeGeometry {
  const path = new THREE.Shape()
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
  return new THREE.ShapeGeometry(path)
}

