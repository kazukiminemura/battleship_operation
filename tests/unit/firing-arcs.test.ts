import { describe, expect, it } from 'vitest'
import { firingArcForWeapon, isDirectionWithinFiringArc } from '../../src/game/simulation/firing-arcs'

describe('firing arcs', () => {
  it('limits torpedoes to the side where they are mounted', () => {
    const starboardTorpedo = firingArcForWeapon('torpedo', { x: -0.65, y: 0 })
    expect(isDirectionWithinFiringArc(Math.PI / 2, starboardTorpedo)).toBe(true)
    expect(isDirectionWithinFiringArc(-Math.PI / 2, starboardTorpedo)).toBe(false)
  })

  it('changes large gun arcs by fore and aft placement', () => {
    const foreGun = firingArcForWeapon('gun', { x: 0, y: -0.72 })
    const aftGun = firingArcForWeapon('gun', { x: 0, y: 0.72 })
    expect(isDirectionWithinFiringArc(0, foreGun)).toBe(true)
    expect(isDirectionWithinFiringArc(Math.PI, foreGun)).toBe(false)
    expect(isDirectionWithinFiringArc(Math.PI, aftGun)).toBe(true)
    expect(isDirectionWithinFiringArc(0, aftGun)).toBe(false)
  })

  it('keeps AA mounts all-around', () => {
    const aa = firingArcForWeapon('aa', { x: 0.8, y: 0.8 })
    expect(isDirectionWithinFiringArc(0, aa)).toBe(true)
    expect(isDirectionWithinFiringArc(Math.PI, aa)).toBe(true)
  })

  it('keeps rapid secondary guns all-around near the centerline', () => {
    const rapidGun = firingArcForWeapon('secondary', { x: 0.3, y: 0 })
    expect(isDirectionWithinFiringArc(0, rapidGun)).toBe(true)
    expect(isDirectionWithinFiringArc(Math.PI, rapidGun)).toBe(true)
    expect(isDirectionWithinFiringArc(Math.PI / 2, rapidGun)).toBe(true)
    expect(isDirectionWithinFiringArc(-Math.PI / 2, rapidGun)).toBe(true)
  })
})
