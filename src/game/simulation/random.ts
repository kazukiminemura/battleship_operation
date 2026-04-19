export class SeededRandom {
  private state: number
  constructor(seed: number) { this.state = seed >>> 0 }
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6D2B79F5) >>> 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min
  }
}

export interface RngStreams {
  combat: SeededRandom
  ai: SeededRandom
  loot: SeededRandom
  scenario: SeededRandom
}

export function createRngStreams(baseSeed: number): RngStreams {
  // different seeds per stream to avoid correlation
  return {
    combat: new SeededRandom(baseSeed ^ 0x11111111),
    ai: new SeededRandom(baseSeed ^ 0x22222222),
    loot: new SeededRandom(baseSeed ^ 0x33333333),
    scenario: new SeededRandom(baseSeed ^ 0x44444444),
  }
}
