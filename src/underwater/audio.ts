export class DiveAudio {
  enabled = true
  private context: AudioContext | undefined
  unlock(): void { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}) }
  tone(frequency: number, duration: number, volume = 0.07): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain()
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, ctx.currentTime + duration)
    gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + duration)
  }
}
