import { describe, expect, it } from 'vitest'
import { createIslandSurface } from '../../src/game/rendering/island-terrain'
import { projectileVisualPoint } from '../../src/game/rendering/projectile-renderer'
import type { ProjectileEntity } from '../../src/game/simulation/types'

describe('terrain and projectile visuals', () => {
  it('bakes repeatable, varied terrain while leaving sea transparent', () => {
    const island = { id: 'test', x: 100, y: 100, rx: 80, ry: 60 }
    const a = createIslandSurface(island, 32)
    expect(a.pixels).toEqual(createIslandSurface(island, 32).pixels)
    expect(a.pixels[3]).toBe(0)
    expect(a.pixels[(16 * 32 + 16) * 4 + 3]).toBe(255)
    const colors = new Set(Array.from({ length: 32 * 32 }, (_, i) => a.pixels[i * 4 + 1]))
    expect(colors.size).toBeGreaterThan(12)
  })

  it('keeps shells on their projected path and torpedoes at sea level', () => {
    const proj = { weaponType: 'gun', pos: { x: 50, y: 0, z: 0 }, vel: { x: 1, y: 0, z: 0 }, launchPos: { x: 0, y: 0, z: 0 }, initialLifetime: 100, lifetime: 50, maxHeight: 20 } as ProjectileEntity
    const project = (x: number, y: number): [number, number] => [x, y]
    expect(projectileVisualPoint({ scale: 1 }, project, proj, 0).heightPx).toBe(0)
    expect(projectileVisualPoint({ scale: 1 }, project, proj, 1).heightPx).toBe(0)
    expect(projectileVisualPoint({ scale: 1 }, project, proj, 0.5)).toMatchObject({ hx: 50, hy: -20 })
    expect(projectileVisualPoint({ scale: 1 }, project, { ...proj, weaponType: 'torpedo' }, 0.5).heightPx).toBe(0)
  })
})
