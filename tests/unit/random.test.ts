import { describe, it, expect } from 'vitest'
import { SeededRandom, createRngStreams } from '../../src/game/simulation/random'

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = new SeededRandom(42)
    const rng2 = new SeededRandom(42)
    const seq1 = Array.from({ length: 10 }, () => rng1.next())
    const seq2 = Array.from({ length: 10 }, () => rng2.next())
    expect(seq1).toEqual(seq2)
  })

  it('produces different sequences for different seeds', () => {
    const rng1 = new SeededRandom(1)
    const rng2 = new SeededRandom(2)
    const seq1 = Array.from({ length: 5 }, () => rng1.next())
    const seq2 = Array.from({ length: 5 }, () => rng2.next())
    expect(seq1).not.toEqual(seq2)
  })

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRandom(999)
    for (let i = 0; i < 100; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt returns values within [min, max]', () => {
    const rng = new SeededRandom(7)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(3, 9)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(9)
    }
  })

  it('nextFloat returns values within [min, max)', () => {
    const rng = new SeededRandom(13)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextFloat(2.5, 7.5)
      expect(v).toBeGreaterThanOrEqual(2.5)
      expect(v).toBeLessThan(7.5)
    }
  })
})

describe('createRngStreams', () => {
  it('creates four independent streams', () => {
    const streams = createRngStreams(100)
    const combatFirst = streams.combat.next()
    const aiFirst = streams.ai.next()
    const lootFirst = streams.loot.next()
    const scenarioFirst = streams.scenario.next()
    // all should be distinct (with overwhelming probability)
    const vals = [combatFirst, aiFirst, lootFirst, scenarioFirst]
    const unique = new Set(vals)
    expect(unique.size).toBe(4)
  })
})
