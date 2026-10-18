import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputAdapter } from '../../src/game/input/adapter'
import type { CanvasRenderer } from '../../src/game/rendering/canvas'
import { createInitialState, STATIC_DATA } from '../../src/game/data/masterdata'
import { combatStep } from '../../src/game/simulation/combat'
import { createRngStreams } from '../../src/game/simulation/random'
import type { ShipEntity } from '../../src/game/simulation/types'

afterEach(() => { vi.unstubAllGlobals() })

function setup() {
  const windowEvents = new EventTarget()
  vi.stubGlobal('window', windowEvents)
  const canvas = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 10, top: 20 }) })
  let cameraOffset = 0
  const input = new InputAdapter(canvas as unknown as HTMLCanvasElement, {
    s2w: (x: number, y: number) => [x + cameraOffset, y],
  } as CanvasRenderer, { canFireAt: (x, y) => x > 0 && y > 0 })
  const pointer = (type: string, clientX = 110, clientY = 220, extra = {}) => {
    const event = Object.assign(new Event(type), { clientX, clientY, button: 0, isPrimary: true, detail: 1, ...extra })
    ;(type === 'pointerup' || type === 'pointercancel' ? windowEvents : canvas).dispatchEvent(event)
  }
  return { input, pointer, windowEvents, moveCamera: () => { cameraOffset = 1000 } }
}

describe('maneuvering while firing', () => {
  it('fires once per tick while held, follows the pointer and camera, and switches weapons', () => {
    const { input, pointer, moveCamera } = setup()
    pointer('pointerdown')
    expect(input.pollCommands(1)).toEqual([{ tick: 1, actorId: 'ship.player', type: 'fire.slot', value: 0, target: { x: 100, y: 200, z: 0 } }])
    moveCamera()
    expect(input.pollCommands(2)[0]!.target).toEqual({ x: 1100, y: 200, z: 0 })
    input.selectWeaponMode(2)
    pointer('pointermove', 210, 320)
    expect(input.pollCommands(3)[0]).toMatchObject({ value: 2, target: { x: 1200, y: 300, z: 0 } })
    pointer('pointerup')
    expect(input.pollCommands(4)).toEqual([])
  })

  it('preserves a brief tap without duplicating the subsequent click', () => {
    const { input, pointer } = setup()
    pointer('pointerdown'); pointer('pointerup'); pointer('click')
    expect(input.pollCommands(1)).toHaveLength(1)
    expect(input.pollCommands(2)).toEqual([])
    pointer('click', 110, 220, { detail: 0 })
    expect(input.pollCommands(3)).toHaveLength(1)
  })

  it('does not shoot through HUD space or retain a trigger after cancellation, pause or blur', () => {
    const { input, pointer, windowEvents } = setup()
    pointer('pointerdown', 0, 0)
    expect(input.pollCommands(1)).toEqual([])
    pointer('pointerdown'); input.pollCommands(2)
    pointer('pointermove', 0, 0)
    expect(input.pollCommands(3)).toEqual([])
    pointer('pointermove')
    expect(input.pollCommands(4)).toHaveLength(1)
    pointer('pointercancel')
    expect(input.pollCommands(5)).toEqual([])
    pointer('pointerdown'); input.setSuspended(true); input.setSuspended(false)
    expect(input.pollCommands(6)).toEqual([])
    pointer('pointerdown'); windowEvents.dispatchEvent(new Event('blur'))
    expect(input.pollCommands(7)).toEqual([])
  })

  it('gives manual aim priority over automatic targeting for the selected slot', () => {
    const initial = createInitialState('destroyer')
    const player = initial.entities.get('ship.player') as ShipEntity
    const enemy = [...initial.entities.values()].find(e => e.kind === 'ship' && e.team === 'enemy') as ShipEntity
    const state = { ...initial, mapObstacles: [], entities: new Map(initial.entities) }
    state.entities.set(player.id, { ...player, pos: { x: 1000, y: 1000, z: 0 }, autoPilot: false })
    state.entities.set(enemy.id, { ...enemy, pos: { x: 1600, y: 1000, z: 0 } })
    const normal = combatStep(state, [], createRngStreams(42), STATIC_DATA)
    expect(normal.eventLog.some(e => e.type === 'weapon.fired' && e.sourceId === player.id && e.weaponId === player.weapons[0]!.id)).toBe(true)
    const manual = combatStep(state, [{ tick: 1, actorId: player.id, type: 'fire.slot', value: 0, target: { x: 15000, y: 15000, z: 0 } }], createRngStreams(42), STATIC_DATA)
    expect(manual.eventLog.some(e => e.type === 'weapon.fired' && e.sourceId === player.id && e.weaponId === player.weapons[0]!.id)).toBe(false)
  })
})
