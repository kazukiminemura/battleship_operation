import * as THREE from 'three'
import { WORLD_SIZE } from '../simulation/movement'
import type { ShipEntity } from '../simulation/types'

export type WorldToScreen = (x: number, y: number) => [number, number]

/** Local +X is the bow. Canvas Y points down; Three.js Y points up.
 * Derive both ground axes from the supplied world projection so hulls, movement
 * and waterline attachments share one coordinate conversion.
 */
export function setShipScreenPose(
  group: THREE.Group,
  ship: Pick<ShipEntity, 'pos' | 'angle'>,
  w2s: WorldToScreen,
  scale: number,
  width: number,
  height: number,
): void {
  const { x, y } = ship.pos
  const cos = Math.cos(ship.angle), sin = Math.sin(ship.angle)
  const [sx, sy] = w2s(x, y)
  const forward = w2s(x + cos, y + sin)
  const across = w2s(x - sin, y + cos)
  const depth = Math.max(-30, Math.min(30, (y / WORLD_SIZE) * 60 - 30))
  group.position.set(sx - width / 2, height / 2 - sy, depth)
  group.matrixAutoUpdate = false
  group.matrix.makeBasis(
    new THREE.Vector3((forward[0] - sx) / scale, -(forward[1] - sy) / scale, 0),
    new THREE.Vector3((across[0] - sx) / scale, -(across[1] - sy) / scale, 0),
    new THREE.Vector3(0, 1, 1),
  )
  group.matrix.setPosition(group.position)
  group.matrixWorldNeedsUpdate = true
}
