import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { setShipScreenPose } from '../../src/game/rendering/ship-projection'
import { projectShipWaterline } from '../../src/game/rendering/ship-waterline'
import type { ShipEntity } from '../../src/game/simulation/types'
import { createInitialState } from '../../src/game/data/masterdata'
import { createShipVisual } from '../../src/game/rendering/combat-ship-visual'
import { shipContactDimensions } from '../../src/game/simulation/ship-contact'

describe('ship heading in the battlefield', () => {
  it.each(['destroyer', 'cruiser', 'battleship'] as const)('%s keeps the actual model, stern and contact footprint aligned through turns and zoom', kind => {
    const ship = createInitialState(kind).entities.get('ship.player') as ShipEntity
    const before = JSON.stringify(ship)
    const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, -1000, 1000)
    camera.position.z = 500
    camera.lookAt(0, 0, 0)
    const dimensions = shipContactDimensions(ship)
    for (const scale of [.65, 1.35, 2.4]) {
      const visual = createShipVisual(ship, scale)
      for (const tilt of [.3, .8]) {
        const w2s = (x: number, y: number): [number, number] => [400 + (x - y) * scale, 300 + (x + y) * scale * tilt]
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8
          const pose = { pos: ship.pos, angle }
          setShipScreenPose(visual.group, pose, w2s, scale, 800, 600)
          const bow = projectShipWaterline(visual.model, camera, 800, 600, .5)
          const stern = projectShipWaterline(visual.model, camera, 800, 600, -.5)
          const head = w2s(ship.pos.x + dimensions.length / 2 * Math.cos(angle), ship.pos.y + dimensions.length / 2 * Math.sin(angle))
          const tail = w2s(ship.pos.x - dimensions.length / 2 * Math.cos(angle), ship.pos.y - dimensions.length / 2 * Math.sin(angle))
          // Compare displacements: the model's height adds the same screen offset to both anchors.
          expect(bow[0] - stern[0]).toBeCloseTo(head[0] - tail[0], 6)
          expect(bow[1] - stern[1]).toBeCloseTo(head[1] - tail[1], 6)
        }
      }
    }
    expect(JSON.stringify(ship)).toBe(before)
  })

  it.each(Array.from({ length: 16 }, (_, i) => i * Math.PI / 8))('points the bow along forward motion at %f radians', angle => {
    const scale = 1.35
    const tiltFactor = Math.sin(.6)
    const w2s = (x: number, y: number): [number, number] => [400 + (x - y) * scale, 300 + (x + y) * scale * tiltFactor]
    const group = new THREE.Group()
    const model = new THREE.Group()
    model.userData.waterlineLength = 10
    model.userData.waterlineBeam = 2
    model.rotation.x = Math.PI / 2
    model.scale.setScalar(scale)
    group.add(model)
    const ship = { angle, pos: { x: 40, y: 60, z: 0 } } as ShipEntity
    setShipScreenPose(group, ship, w2s, scale, 800, 600)
    const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, -1000, 1000)
    camera.position.z = 500
    camera.lookAt(0, 0, 0)
    const bow = projectShipWaterline(model, camera, 800, 600, .5)
    const stern = projectShipWaterline(model, camera, 800, 600, -.5)
    const origin = w2s(ship.pos.x, ship.pos.y)
    const forward = w2s(ship.pos.x + 10 * Math.cos(angle), ship.pos.y + 10 * Math.sin(angle))
    expect(bow[0] - stern[0]).toBeCloseTo(forward[0] - origin[0], 8)
    expect(bow[1] - stern[1]).toBeCloseTo(forward[1] - origin[1], 8)
  })
})
