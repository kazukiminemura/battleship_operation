import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { projectShipWaterline } from '../../src/game/rendering/ship-waterline'
import { ShipWakeRenderer } from '../../src/game/rendering/wake-renderer'
import { damageSmokeLevel } from '../../src/game/rendering/damage-smoke'
import type { ShipEntity } from '../../src/game/simulation/types'

describe('hull attachments and damage smoke', () => {
  it.each([0, Math.PI / 3, Math.PI, Math.PI * 1.6])('attaches the wake to the model stern at heading %f', angle => {
    const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, -1000, 1000)
    camera.position.z = 500
    camera.lookAt(0, 0, 0)
    const group = new THREE.Group()
    group.position.set(30, 40, 0)
    group.rotation.set(-.5, .08, angle)
    const model = new THREE.Group()
    model.userData.waterlineLength = 10
    model.userData.waterlineBeam = 2
    model.rotation.x = Math.PI / 2
    model.position.z = 10
    model.scale.setScalar(12)
    group.add(model)
    const stern = projectShipWaterline(model, camera, 800, 600, -.5)
    const expected = model.localToWorld(new THREE.Vector3(-5, 0, 0)).project(camera)
    expect(stern[0]).toBeCloseTo((expected.x + 1) * 400, 8)
    expect(stern[1]).toBeCloseTo((1 - expected.y) * 300, 8)
    const wake = new ShipWakeRenderer()
    const ship = { id: 'ship', speed: 2 } as ShipEntity
    wake.update([ship], 2, () => ({ x: stern[0], y: stern[1] }))
    const history = (wake as unknown as { trails: Map<string, { x: number; y: number }[]> }).trails.get(ship.id)!
    expect(history[0]).toMatchObject({ x: stern[0], y: stern[1] })
  })

  it('emits smoke on the first damage, thickens with damage, and leaves smoking ruins', () => {
    expect(damageSmokeLevel(100, 100)).toBe(0)
    expect(damageSmokeLevel(99, 100)).toBeGreaterThan(0)
    expect(damageSmokeLevel(20, 100)).toBeGreaterThan(damageSmokeLevel(99, 100))
    expect(damageSmokeLevel(0, 100, true)).toBe(1)
    expect(damageSmokeLevel(0, 0)).toBe(0)
  })
})
