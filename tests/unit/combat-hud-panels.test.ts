import { describe, expect, it } from 'vitest'
import { HUD } from '../../src/game/ui/hud'
import { commandLayout } from '../../src/game/ui/command-layout'

describe('combat instrument panels', () => {
  it('blocks shots through the bridge, chart, and radar while keeping the sea interactive', () => {
    const hud = new HUD({ width: 1440, height: 900, getContext: () => ({}) } as unknown as HTMLCanvasElement)
    const panelY = 900 - commandLayout(1440).height - 90
    expect(hud.containsPanel(80, panelY)).toBe(true)
    expect(hud.containsPanel(1200, panelY)).toBe(true)
    expect(hud.containsPanel(1350, panelY)).toBe(true)
    expect(hud.containsPanel(720, panelY)).toBe(false)
    expect(hud.containsPanel(720, 420)).toBe(false)
  })
})
