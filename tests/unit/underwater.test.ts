import { describe, expect, it } from 'vitest'
import { BASE, SITES, newDive, stepDive, pulseSonar, sitePosition, seabed, type Controls } from '../../src/underwater/simulation'
const idle: Controls = { thrust: 0, turn: 0, vertical: 0, boost: false, scan: false }
function run(state: ReturnType<typeof newDive>, seconds: number, input: Partial<Controls> = {}) {
  for (let i = 0; i < seconds * 60; i++) stepDive(state, { ...idle, ...input }, 1 / 60)
}
function diving() { const state = newDive(); state.phase = 'diving'; return state }
describe('underwater exploration', () => {
  it('starts at a safe resupply base and only runs after start', () => {
    const state = newDive(), before = structuredClone(state)
    run(state, 1, { thrust: 1 })
    expect(state).toEqual(before)
    expect(state.pos).toEqual(BASE)
  })
  it('supports thrust, steering, depth and coasting to a stop', () => {
    const state = diving()
    run(state, 2, { thrust: 1, vertical: -1 })
    expect(state.pos.z).toBeLessThan(BASE.z - 15)
    expect(state.pos.y).toBeLessThan(BASE.y)
    run(state, 1, { turn: 1 }); expect(state.yaw).toBeGreaterThan(1)
    run(state, 3); expect(state.speed).toBeLessThan(0.01)
  })
  it('spends battery on boost and regenerates while cruising', () => {
    const state = diving(); run(state, 5, { thrust: 1, boost: true })
    expect(state.battery).toBeLessThan(90); expect(state.speed).toBeGreaterThan(20)
    const remaining = state.battery; run(state, 1)
    expect(state.battery).toBeGreaterThan(remaining)
  })
  it('sonar reveals nearby sites, costs energy and respects cooldown', () => {
    const state = diving()
    expect(pulseSonar(state)).toBe(true)
    expect(state.revealed).toContain('01'); expect(state.revealed).not.toContain('05')
    expect(state.battery).toBe(96); expect(pulseSonar(state)).toBe(false)
    run(state, 5.1); expect(pulseSonar(state)).toBe(true)
  })
  it('requires proximity and a stationary sustained survey, with no duplicates', () => {
    const state = diving()
    run(state, 3, { scan: true }); expect(state.scanned).toHaveLength(0)
    state.pos = sitePosition(SITES[0]!); run(state, 1, { scan: true })
    expect(state.scanProgress).toBeGreaterThan(0)
    run(state, 0.1); expect(state.scanProgress).toBe(0)
    run(state, 3, { scan: true }); expect(state.scanned).toEqual(['01'])
    run(state, 3, { scan: true }); expect(state.scanned).toEqual(['01'])
  })
  it('completes after three distinct surveys and explicit docking at the base', () => {
    const state = diving()
    for (const site of SITES.slice(0, 3)) { state.pos = sitePosition(site); run(state, 3, { scan: true }) }
    expect(state.scanned).toHaveLength(3); expect(state.target).toBe('base')
    expect(state.phase).toBe('diving')
    state.pos = { ...BASE }; run(state, 0.1, { scan: true })
    expect(state.phase).toBe('complete')
    const before = structuredClone(state); run(state, 3, { thrust: 1 }); expect(state).toEqual(before)
  })
  it('prevents an early return from completing the mission and refills supplies', () => {
    const state = diving(); state.oxygen = 35; state.hull = 40
    run(state, 1, { scan: true }); expect(state.phase).toBe('diving')
    expect(state.oxygen).toBeGreaterThan(40); expect(state.hull).toBeGreaterThan(40)
  })
  it('limits depth and damages the hull on seabed contact', () => {
    const state = diving(); state.pos.y = seabed(state.pos.x, state.pos.z) + 2.2
    run(state, 1, { vertical: -1 }); expect(state.hull).toBeLessThan(100)
    expect(state.pos.y).toBeGreaterThan(seabed(state.pos.x, state.pos.z))
    state.pos.y = -4; run(state, 1, { vertical: 1 }); expect(state.pos.y).toBe(-4)
  })
  it('fails away from base on depleted oxygen and resets all progress on retry', () => {
    const state = diving(); state.pos = sitePosition(SITES[0]!); state.oxygen = 0.01
    run(state, 1); expect(state.phase).toBe('failed')
    const fresh = newDive(); expect(fresh.oxygen).toBe(100); expect(fresh.scanned).toEqual([])
  })
  it('pauses both resource use and movement', () => {
    const state = diving(); state.phase = 'paused'
    const before = structuredClone(state); run(state, 5, { thrust: 1 }); expect(state).toEqual(before)
  })
})
