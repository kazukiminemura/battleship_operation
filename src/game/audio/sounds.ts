import type { CombatEvent } from '../simulation/types'

type WeaponType = 'gun' | 'torpedo' | 'aa' | 'missile'

export class SoundSystem {
  private actx: AudioContext | null = null
  private bus: DynamicsCompressorNode | null = null
  private lastProcessedTick = -1

  reset(): void {
    this.lastProcessedTick = -1
  }

  processEvents(events: CombatEvent[], currentTick: number): void {
    for (const ev of events) {
      if (ev.tick <= this.lastProcessedTick) continue
      if (ev.type === 'weapon.fired' && ev.weaponId) {
        this.playFired(inferWeaponType(ev.weaponId))
      } else if (ev.type === 'weapon.hit') {
        this.playShipHit(ev.damage ?? 30, ev.weaponId ?? 'gun')
      } else if (ev.type === 'weapon.missed' && ev.weaponId) {
        this.playSplash(inferWeaponType(ev.weaponId))
      }
    }
    this.lastProcessedTick = currentTick
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
    }
    if (this.actx.state === 'suspended') this.actx.resume()
    return this.actx
  }

  private dest(): AudioNode {
    this.getCtx()
    return this.bus!
  }

  private playFired(type: WeaponType): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime

    if (type === 'gun') {
      // Realistic naval gun: crack + discharge + low boom + rumble
      filteredNoise(ctx, dst, now + 0.000, 0.55, 'highpass',  1100, 0.8, 0.001, 0.045)  // muzzle crack
      filteredNoise(ctx, dst, now + 0.002, 0.70, 'bandpass',   320, 1.0, 0.003, 0.130)  // main discharge
      filteredNoise(ctx, dst, now + 0.008, 0.30, 'lowpass',     90, 0.8, 0.010, 0.350)  // low rumble
      sineDecay   (ctx, dst, now + 0.005, 50,   0.65,          0.006, 0.280)             // low boom
      sineDecay   (ctx, dst, now + 0.000, 140,  0.20,          0.002, 0.060)             // mid thud
    } else if (type === 'torpedo') {
      // Deep underwater launch: hiss + low drone
      filteredNoise(ctx, dst, now,         0.25, 'bandpass',   180, 1.2, 0.020, 0.600)
      filteredNoise(ctx, dst, now,         0.12, 'highpass',   800, 0.8, 0.010, 0.300)
      sineDecay   (ctx, dst, now,          65,   0.45,          0.050, 0.800)
    } else if (type === 'aa') {
      // Fast sharp pop
      filteredNoise(ctx, dst, now,         0.40, 'highpass',  900,  0.9, 0.001, 0.030)
      filteredNoise(ctx, dst, now,         0.30, 'bandpass',  500,  1.5, 0.002, 0.055)
      sineDecay   (ctx, dst, now,          200,  0.15,         0.001, 0.040)
    } else {
      // Missile: ignition rumble + whoosh
      filteredNoise(ctx, dst, now,         0.20, 'lowpass',   200, 0.8, 0.050, 1.000)
      filteredNoise(ctx, dst, now,         0.15, 'bandpass',  500, 1.0, 0.020, 0.800)
      sineDecay   (ctx, dst, now,          48,   0.55,         0.080, 1.200)
    }
  }

  private playShipHit(damage: number, weaponId: string): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    const vol = Math.min(damage / 100, 1) * 0.4 + 0.20

    if (inferWeaponType(weaponId) === 'torpedo') {
      // Underwater explosion: deep rumble dominant, less crack
      filteredNoise(ctx, dst, now + 0.000, vol * 0.30, 'bandpass',  800, 1.5, 0.002, 0.080)  // dull thud
      filteredNoise(ctx, dst, now + 0.005, vol * 1.00, 'lowpass',   150, 0.8, 0.010, 0.600)  // deep burst
      sineDecay   (ctx, dst, now + 0.005, 32,          vol * 0.90,       0.015, 0.900)        // subsonic boom
      filteredNoise(ctx, dst, now + 0.050, vol * 0.50, 'lowpass',    80, 0.8, 0.040, 1.000)  // long roll
      sineDecay   (ctx, dst, now + 0.080, 22,          vol * 0.40,       0.060, 0.800)        // hull resonance
    } else {
      // Surface explosion: sharp crack + explosion
      filteredNoise(ctx, dst, now + 0.000, vol * 0.55, 'bandpass', 2800, 2.5, 0.001, 0.050)  // metal crack
      filteredNoise(ctx, dst, now + 0.001, vol * 0.90, 'lowpass',   380, 0.8, 0.003, 0.220)  // explosion burst
      sineDecay   (ctx, dst, now + 0.003, 42,          vol * 0.70,       0.006, 0.450)        // low boom
      filteredNoise(ctx, dst, now + 0.010, vol * 0.40, 'lowpass',   110, 0.8, 0.020, 0.600)  // rumble
    }
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

function inferWeaponType(weaponId: string): WeaponType {
  if (weaponId === 'torpedo' || weaponId.includes('torpedo')) return 'torpedo'
  if (weaponId === 'aa'      || weaponId.includes('aa'))      return 'aa'
  if (weaponId === 'missile' || weaponId.includes('missile')) return 'missile'
  return 'gun'
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
