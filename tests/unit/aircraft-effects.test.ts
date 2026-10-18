import { expect, it } from 'vitest'
import { AircraftEffectsRenderer } from '../../src/game/rendering/aircraft-effects'
import type { AircraftEntity } from '../../src/game/simulation/types'

it('leaves smoke at recorded flight altitudes, records once per tick, fades and resets between sorties', () => {
  const circles: number[][] = []
  const ctx = {
    save() {}, restore() {}, beginPath() {}, fill() {},
    arc(...args: number[]) { circles.push(args) },
    createRadialGradient() { return { addColorStop() {} } },
  } as unknown as CanvasRenderingContext2D
  const renderer = new AircraftEffectsRenderer()
  const plane = { id: 'plane', phase: 'attack', hp: 20, maxHp: 28, destroyed: false, pos: { x: 100, y: 200, z: 150 } } as AircraftEntity
  const w2s = (x: number, y: number): [number, number] => [x, y]
  renderer.render(ctx, [plane], 1, w2s, 2)
  expect(circles).toHaveLength(1)
  expect(circles[0]!.slice(0, 2)).toEqual([100, 50])
  circles.length = 0
  renderer.render(ctx, [plane], 1, w2s, 2)
  expect(circles).toHaveLength(1)
  circles.length = 0
  renderer.render(ctx, [{ ...plane, pos: { x: 120, y: 210, z: 140 } }], 1, w2s, 4)
  expect(circles).toHaveLength(2)
  expect(circles[0]![1]).toBeCloseTo(48.6)
  expect(circles[1]!.slice(0, 2)).toEqual([120, 70])
  circles.length = 0
  renderer.render(ctx, [], 1, w2s, 70)
  expect(circles).toHaveLength(0)
  renderer.render(ctx, [plane], 1, w2s, 72)
  circles.length = 0
  renderer.render(ctx, [], 1, w2s, 0)
  expect(circles).toHaveLength(0)
  renderer.render(ctx, [{ ...plane, hp: 28 }], 1, w2s, 2)
  expect(circles).toHaveLength(0)
})
