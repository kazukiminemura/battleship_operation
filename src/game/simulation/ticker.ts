export const TICKS_PER_SECOND = 30
export const TICK_DT = 1 / TICKS_PER_SECOND

export interface TickerOptions {
  onTick: (tick: number) => void
  onRender: (alpha: number) => void
}

export class FixedTicker {
  private accumulator = 0
  private lastTime = 0
  private tickCount = 0
  private running = false
  private rafId = 0
  private options: TickerOptions

  constructor(options: TickerOptions) {
    this.options = options
  }

  start(): void {
    this.running = true
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private loop = (now: number): void => {
    if (!this.running) return
    const delta = Math.min((now - this.lastTime) / 1000, 0.1) // cap at 100ms to avoid spiral
    this.lastTime = now
    this.accumulator += delta

    while (this.accumulator >= TICK_DT) {
      this.options.onTick(this.tickCount++)
      this.accumulator -= TICK_DT
    }

    const alpha = this.accumulator / TICK_DT
    this.options.onRender(alpha)

    this.rafId = requestAnimationFrame(this.loop)
  }
}
