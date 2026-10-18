import { expect, it } from 'vitest'
import { ShipWakeRenderer } from '../../src/game/rendering/wake-renderer'
import type { ShipEntity } from '../../src/game/simulation/types'

it('records wake once per simulation tick and clears a previous sortie', () => {
  const renderer = new ShipWakeRenderer()
  const ship = { id: 'player', templateId: 'hull.destroyer.basic', pos: { x: 0, y: 0, z: 0 }, angle: 0, speed: 2 } as ShipEntity
  const history = (renderer as unknown as { trails: Map<string, unknown[]> }).trails
  const waterline = () => ({ x: -50, y: 0 })
  renderer.update([ship], 2, waterline)
  renderer.update([ship], 2, waterline)
  expect(history.get(ship.id)).toHaveLength(1)
  renderer.update([ship], 4, waterline)
  expect(history.get(ship.id)).toHaveLength(2)
  renderer.update([ship], 0, waterline)
  expect(history.get(ship.id)).toHaveLength(1)
  renderer.update([{ ...ship, speed: 0 }], 200, waterline)
  expect(history.get(ship.id)).toHaveLength(0)
})
