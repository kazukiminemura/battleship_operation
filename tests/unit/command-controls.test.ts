import { afterEach, describe, expect, it, vi } from 'vitest'
import { commandLayout } from '../../src/game/ui/command-layout'
import { InputAdapter } from '../../src/game/input/adapter'
import type { CanvasRenderer } from '../../src/game/rendering/canvas'

afterEach(() => { vi.unstubAllGlobals() })

describe('clickable command controls', () => {
  it.each([320, 375, 640, 900, 1440])('keeps every button in bounds at width %i', width => {
    const layout = commandLayout(width)
    expect(layout.buttons).toHaveLength(8)
    for (const button of layout.buttons) {
      expect(button.x).toBeGreaterThanOrEqual(0)
      expect(button.x + button.w).toBeLessThanOrEqual(width)
      expect(button.y + button.h).toBeLessThanOrEqual(layout.height)
    }
  })

  function makeInput() {
    vi.stubGlobal('window', { addEventListener: vi.fn() })
    const canvas = { addEventListener: vi.fn() } as unknown as HTMLCanvasElement
    return new InputAdapter(canvas, {} as CanvasRenderer)
  }

  it('queues speed and steering commands, never accidental shots', () => {
    const input = makeInput()
    for (const action of ['speed.up', 'speed.down', 'turn.left', 'turn.right']) input.performControl(action)
    const commands = input.pollCommands(10)
    expect(commands.map(c => c.type)).toEqual(['speed.up', 'speed.down', 'rotate', 'rotate'])
    expect(commands[2]!.value).toBeLessThan(0)
    expect(commands[3]!.value).toBeGreaterThan(0)
  })

  it('selects and cycles weapons and suppresses controls while suspended', () => {
    const input = makeInput()
    input.selectWeaponMode(7)
    input.performControl('weapon.next')
    expect(input.getWeaponMode()).toBe(0)
    input.setSuspended(true)
    input.performControl('speed.up')
    input.performControl('turn.left')
    expect(input.pollCommands(1)).toEqual([])
  })
})
