import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputAdapter } from '../../src/game/input/adapter'
import type { CanvasRenderer } from '../../src/game/rendering/canvas'
import { createInitialState, STATIC_DATA } from '../../src/game/data/masterdata'
import { combatStep } from '../../src/game/simulation/combat'
import { createRngStreams } from '../../src/game/simulation/random'
import type { ShipEntity } from '../../src/game/simulation/types'

afterEach(() => { vi.unstubAllGlobals() })

function setup() {
  const events = new EventTarget()
  vi.stubGlobal('window', events)
  const input = new InputAdapter(new EventTarget() as HTMLCanvasElement, {} as CanvasRenderer)
  const key = (type: string, code: string, altKey = false) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { code, altKey, repeat: false })
    events.dispatchEvent(event)
    return event
  }
  return { events, input, key }
}

describe('keyboard helm takeover', () => {
  it('preserves a short arrow tap between ticks without doubling held steering', () => {
    const { input, key } = setup()
    key('keydown', 'ArrowLeft')
    key('keyup', 'ArrowLeft')
    expect(input.pollCommands(1)).toEqual([{ tick: 1, actorId: 'ship.player', type: 'rotate', value: -0.04 }])
    expect(input.pollCommands(2)).toEqual([])
    key('keydown', 'ArrowRight')
    expect(input.pollCommands(3)).toHaveLength(1)
    expect(input.pollCommands(4)).toHaveLength(1)
  })
  it.each(['ArrowLeft', 'ArrowRight'])('%s turns an auto-piloted ship until released', code => {
    const { input, key } = setup()
    const state = createInitialState('battleship')
    const player = state.entities.get('ship.player') as ShipEntity
    state.entities.set(player.id, { ...player, autoPilot: true })
    expect(key('keydown', code).defaultPrevented).toBe(true)
    const rng = createRngStreams(12345)
    const next = combatStep(state, input.pollCommands(1), rng, STATIC_DATA)
    const turned = next.entities.get(player.id) as ShipEntity
    expect(turned.autoPilot).toBe(false)
    const step = Math.min(0.04, player.turnRate)
    expect(turned.angle - player.angle).toBeCloseTo(code === 'ArrowLeft' ? -step : step)
    expect(input.pollCommands(2)).toHaveLength(1)
    key('keyup', code)
    expect(input.pollCommands(3)).toEqual([])
  })

  it.each(['ArrowUp', 'ArrowDown'])('%s also takes manual control', code => {
    const { input, key } = setup()
    const state = createInitialState()
    const player = state.entities.get('ship.player') as ShipEntity
    state.entities.set(player.id, { ...player, autoPilot: true })
    key('keydown', code)
    const next = combatStep(state, input.pollCommands(1), createRngStreams(12345), STATIC_DATA)
    expect((next.entities.get(player.id) as ShipEntity).autoPilot).toBe(false)
  })

  it('does not stick on focus loss or act while paused or using Alt shortcuts', () => {
    const { input, key, events } = setup()
    key('keydown', 'ArrowLeft')
    events.dispatchEvent(new Event('blur'))
    expect(input.pollCommands(1)).toEqual([])
    key('keydown', 'ArrowLeft', true)
    expect(input.pollCommands(2)).toEqual([])
    input.setSuspended(true)
    key('keydown', 'ArrowRight')
    expect(input.pollCommands(3)).toEqual([])
  })

  it('keeps auto-pilot on when firing without helm input', () => {
    const state = createInitialState()
    const player = state.entities.get('ship.player') as ShipEntity
    state.entities.set(player.id, { ...player, autoPilot: true })
    const next = combatStep(state, [{ tick: 1, actorId: player.id, type: 'fire.slot', value: 0, target: { x: 5000, y: 5000, z: 0 } }], createRngStreams(12345), STATIC_DATA)
    expect((next.entities.get(player.id) as ShipEntity).autoPilot).toBe(true)
  })
})
