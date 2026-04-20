import type { CombatEvent, WeaponType } from '../simulation/types'
import surfaceExplosionUrl from '../../assets/audio/soundeffect-lab/bomb4.mp3?url'
import heavyExplosionUrl from '../../assets/audio/soundeffect-lab/big-explosion1.mp3?url'
import { inferWeaponSoundClass, inferWeaponType, type WeaponSoundClass } from './weapon-audio'

type ExplosionSample = keyof typeof EXPLOSION_SAMPLE_URLS
type SpeedDirection = 'up' | 'down'

const EXPLOSION_SAMPLE_URLS = {
  surface: surfaceExplosionUrl,
  heavy: heavyExplosionUrl,
} as const

export class SoundSystem {
  private actx: AudioContext | null = null
  private bus: DynamicsCompressorNode | null = null
  private lastProcessedTick = -1
  private explosionBuffers: Partial<Record<ExplosionSample, AudioBuffer>> = {}
  private explosionLoads: Partial<Record<ExplosionSample, Promise<AudioBuffer | null>>> = {}

  reset(): void {
    this.lastProcessedTick = -1
  }

  processEvents(events: CombatEvent[], currentTick: number): void {
    for (const ev of events) {
      if (ev.tick <= this.lastProcessedTick) continue
      if (ev.type === 'weapon.fired' && ev.weaponId) {
        this.playFired(inferWeaponSoundClass(ev.weaponId))
      } else if (ev.type === 'weapon.hit') {
        this.playShipHit(ev.damage ?? 30, ev.weaponId ?? 'gun')
      } else if (ev.type === 'weapon.missed' && ev.weaponId) {
        this.playSplash(inferWeaponType(ev.weaponId))
      }
    }
    this.lastProcessedTick = currentTick
  }

  playWeaponSelected(type: WeaponType): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    const baseFreq: Record<WeaponType, number> = {
      gun: 310,
      secondary: 360,
      torpedo: 230,
      aa: 420,
      missile: 270,
    }
    const freq = baseFreq[type]

    filteredNoise(ctx, dst, now + 0.000, 0.070, 'bandpass',  420, 1.2, 0.001, 0.060)
    filteredNoise(ctx, dst, now + 0.014, 0.030, 'highpass', 2600, 0.7, 0.001, 0.040)
    pulseTone(ctx, dst, now + 0.028, freq,        0.035, 0.060, 'triangle')
    pulseTone(ctx, dst, now + 0.090, freq * 1.34, 0.026, 0.060, 'sine')
  }

  playSpeedChange(direction: SpeedDirection): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    const startFreq = direction === 'up' ? 82 : 132
    const endFreq = direction === 'up' ? 132 : 74

    filteredNoise(ctx, dst, now + 0.000, 0.075, 'bandpass',  260, 1.4, 0.002, 0.075)
    filteredNoise(ctx, dst, now + 0.030, 0.035, 'lowpass',   120, 0.9, 0.010, 0.210)
    sweepTone(ctx, dst, now + 0.018, startFreq, endFreq, 0.070, 0.210)
    pulseTone(ctx, dst, now + 0.190, direction === 'up' ? 410 : 260, 0.026, 0.060, 'triangle')
  }

  private getCtx(): AudioContext {
    if (!this.actx) {
      this.actx = new AudioContext()
      // Master bus compressor prevents clipping when many guns fire at once
      this.bus = this.actx.createDynamicsCompressor()
      this.bus.threshold.value = -16
      this.bus.knee.value    = 8
      this.bus.ratio.value   = 5
      this.bus.attack.value  = 0.003
      this.bus.release.value = 0.12
      this.bus.connect(this.actx.destination)
      this.preloadExplosionSamples(this.actx)
    }
    if (this.actx.state === 'suspended') this.actx.resume()
    return this.actx
  }

  private dest(): AudioNode {
    this.getCtx()
    return this.bus!
  }

  private playFired(type: WeaponSoundClass): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime

    if (type === 'cannon') {
      filteredNoise(ctx, dst, now + 0.000, 0.72, 'highpass',  1350, 0.7, 0.001, 0.040)
      filteredNoise(ctx, dst, now + 0.003, 0.82, 'bandpass',   250, 0.9, 0.004, 0.170)
      filteredNoise(ctx, dst, now + 0.018, 0.36, 'lowpass',     70, 0.8, 0.018, 0.520)
      sineDecay   (ctx, dst, now + 0.005, 38,   0.92,          0.006, 0.420)
      sineDecay   (ctx, dst, now + 0.012, 86,   0.30,          0.003, 0.130)
    } else if (type === 'torpedo') {
      filteredNoise(ctx, dst, now + 0.000, 0.12, 'highpass',  1900, 0.8, 0.001, 0.060)
      filteredNoise(ctx, dst, now + 0.012, 0.28, 'bandpass',   170, 1.0, 0.025, 0.700)
      filteredNoise(ctx, dst, now + 0.050, 0.16, 'lowpass',     70, 0.7, 0.050, 0.950)
      sineDecay   (ctx, dst, now + 0.016, 54,   0.46,          0.040, 0.850)
    } else if (type === 'machineGun') {
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.035
        filteredNoise(ctx, dst, t + 0.000, 0.34, 'highpass', 1850, 0.9, 0.001, 0.020)
        filteredNoise(ctx, dst, t + 0.001, 0.18, 'bandpass',  520, 1.6, 0.001, 0.032)
        sineDecay   (ctx, dst, t + 0.000, 145,  0.075,        0.001, 0.028)
      }
      filteredNoise(ctx, dst, now + 0.002, 0.12, 'lowpass',  180, 0.7, 0.006, 0.180)
    } else if (type === 'missile') {
      filteredNoise(ctx, dst, now + 0.000, 0.18, 'highpass', 2400, 0.7, 0.001, 0.055)
      filteredNoise(ctx, dst, now + 0.010, 0.32, 'bandpass',  520, 0.9, 0.018, 0.650)
      filteredNoise(ctx, dst, now + 0.050, 0.38, 'lowpass',   135, 0.8, 0.070, 1.050)
      sweepTone    (ctx, dst, now + 0.010, 92, 58, 0.22, 0.850)
      sineDecay    (ctx, dst, now + 0.020, 44,    0.50,       0.080, 1.150)
    } else {
      sweepTone(ctx, dst, now + 0.000, 520, 1480, 0.13, 0.180)
      pulseTone(ctx, dst, now + 0.020, 1860, 0.060, 0.100, 'triangle')
      filteredNoise(ctx, dst, now + 0.030, 0.080, 'bandpass', 2100, 2.2, 0.010, 0.180)
    }
  }

  private playShipHit(damage: number, weaponId: string): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    const vol = Math.min(damage / 100, 1) * 0.4 + 0.20

    if (inferWeaponSoundClass(weaponId) === 'torpedo') {
      // Underwater explosion: sampled blast, filtered down into a deep hull-shaking thump.
      this.playExplosionSample('heavy', now + 0.000, vol * 0.55, 0.76, { type: 'lowpass', freq: 520, Q: 0.65 })
      filteredNoise(ctx, dst, now + 0.000, vol * 0.22, 'bandpass',  700, 1.3, 0.002, 0.075)
      filteredNoise(ctx, dst, now + 0.005, vol * 0.82, 'lowpass',   140, 0.8, 0.012, 0.680)
      sineDecay   (ctx, dst, now + 0.005, 30,          vol * 0.95,       0.015, 1.000)
      filteredNoise(ctx, dst, now + 0.060, vol * 0.48, 'lowpass',    72, 0.8, 0.050, 1.150)
      sineDecay   (ctx, dst, now + 0.080, 21,          vol * 0.42,       0.060, 0.900)
    } else {
      // Surface explosion: Effect Lab "bomb4" sample with extra naval low-end.
      this.playExplosionSample('surface', now + 0.000, vol * 0.78, 0.92)
      filteredNoise(ctx, dst, now + 0.000, vol * 0.22, 'bandpass', 3200, 2.5, 0.001, 0.045)
      filteredNoise(ctx, dst, now + 0.004, vol * 0.52, 'lowpass',   360, 0.8, 0.004, 0.300)
      sineDecay   (ctx, dst, now + 0.006, 40,          vol * 0.68,       0.007, 0.540)
      filteredNoise(ctx, dst, now + 0.035, vol * 0.34, 'lowpass',    95, 0.8, 0.030, 0.760)
    }
  }

  private preloadExplosionSamples(ctx: AudioContext): void {
    this.loadExplosionSample(ctx, 'surface')
    this.loadExplosionSample(ctx, 'heavy')
  }

  private loadExplosionSample(ctx: AudioContext, sample: ExplosionSample): Promise<AudioBuffer | null> {
    const loaded = this.explosionBuffers[sample]
    if (loaded) return Promise.resolve(loaded)

    const loading = this.explosionLoads[sample]
    if (loading) return loading

    const url = EXPLOSION_SAMPLE_URLS[sample]
    const request = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load explosion sample: ${res.status}`)
        return res.arrayBuffer()
      })
      .then((data) => ctx.decodeAudioData(data.slice(0)))
      .then((buffer) => {
        this.explosionBuffers[sample] = buffer
        return buffer
      })
      .catch(() => null)

    this.explosionLoads[sample] = request
    return request
  }

  private playExplosionSample(
    sample: ExplosionSample,
    start: number,
    volume: number,
    playbackRate: number,
    filter?: { type: BiquadFilterType, freq: number, Q: number },
  ): void {
    const ctx = this.getCtx()
    const buffer = this.explosionBuffers[sample]
    if (!buffer) {
      this.loadExplosionSample(ctx, sample)
      return
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.setValueAtTime(playbackRate, start)

    const gain = ctx.createGain()
    const duration = buffer.duration / playbackRate
    const fadeOutStart = Math.max(start + 0.03, start + duration - 0.060)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.006)
    gain.gain.setValueAtTime(volume, fadeOutStart)
    gain.gain.linearRampToValueAtTime(0, start + duration)

    if (filter) {
      const filt = ctx.createBiquadFilter()
      filt.type = filter.type
      filt.frequency.value = filter.freq
      filt.Q.value = filter.Q
      src.connect(filt)
      filt.connect(gain)
    } else {
      src.connect(gain)
    }

    gain.connect(this.dest())
    src.start(start)
    src.stop(start + duration + 0.02)
  }

  private playSplash(type: WeaponType): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime

    // Scale splash size to weapon caliber
    const volScale = type === 'missile' ? 1.1 : type === 'torpedo' ? 1.0 : type === 'gun' ? 0.75 : 0.45

    // Initial water impact thwack
    filteredNoise(ctx, dst, now + 0.000, 0.35 * volScale, 'bandpass',  480, 1.5, 0.002, 0.090)
    // Water column rising
    filteredNoise(ctx, dst, now + 0.015, 0.28 * volScale, 'lowpass',   200, 0.8, 0.025, 0.350)
    // Fine spray hiss
    filteredNoise(ctx, dst, now + 0.000, 0.12 * volScale, 'bandpass', 2200, 2.0, 0.008, 0.250)
    // Low thud (larger calibers only)
    if (type !== 'aa') {
      sineDecay   (ctx, dst, now + 0.005, 55, 0.20 * volScale,          0.010, 0.300)
    }
  }
}

// White noise through a biquad filter with envelope
function filteredNoise(
  ctx:    AudioContext,
  dst:    AudioNode,
  start:  number,
  volume: number,
  type:   BiquadFilterType,
  freq:   number,
  Q:      number,
  attack: number,
  decay:  number,
): void {
  const len = Math.ceil(ctx.sampleRate * (attack + decay + 0.02))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buf

  const filt = ctx.createBiquadFilter()
  filt.type = type
  filt.frequency.value = freq
  filt.Q.value = Q

  const gain = ctx.createGain()
  const t0 = start
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + Math.max(attack, 0.001))
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)

  src.connect(filt)
  filt.connect(gain)
  gain.connect(dst)
  src.start(t0)
  src.stop(t0 + attack + decay + 0.02)
}

// Sine oscillator with pitch drop and envelope
function sineDecay(
  ctx:    AudioContext,
  dst:    AudioNode,
  start:  number,
  freq:   number,
  volume: number,
  attack: number,
  decay:  number,
): void {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.35, start + attack + decay)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + Math.max(attack, 0.001))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)

  osc.connect(gain)
  gain.connect(dst)
  osc.start(start)
  osc.stop(start + attack + decay + 0.02)
}

function pulseTone(
  ctx: AudioContext,
  dst: AudioNode,
  start: number,
  freq: number,
  volume: number,
  duration: number,
  type: OscillatorType,
): void {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(gain)
  gain.connect(dst)
  osc.start(start)
  osc.stop(start + duration + 0.01)
}

function sweepTone(
  ctx: AudioContext,
  dst: AudioNode,
  start: number,
  startFreq: number,
  endFreq: number,
  volume: number,
  duration: number,
): void {
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(startFreq, start)
  osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration)

  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.setValueAtTime(1000, start)
  filt.frequency.exponentialRampToValueAtTime(520, start + duration)
  filt.Q.value = 0.7

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.010)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(filt)
  filt.connect(gain)
  gain.connect(dst)
  osc.start(start)
  osc.stop(start + duration + 0.01)
}
