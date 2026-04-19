import type { CombatEvent } from '../simulation/types'

type WeaponType = 'gun' | 'torpedo' | 'aa' | 'missile'

export class SoundSystem {
  private actx: AudioContext | null = null
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
        this.playHit(ev.damage ?? 30)
      }
    }
    this.lastProcessedTick = currentTick
  }

  private ctx(): AudioContext {
    if (!this.actx) this.actx = new AudioContext()
    if (this.actx.state === 'suspended') this.actx.resume()
    return this.actx
  }

  private playFired(type: WeaponType): void {
    const ctx = this.ctx()
    const now = ctx.currentTime
    if (type === 'gun') {
      playNoise(ctx, now, 0.18, 220, 0.05, 0.12)
    } else if (type === 'torpedo') {
      playTone(ctx, now, 70, 0.35, 1.0, 0.05, 0.8)
      playNoise(ctx, now, 0.08, 140, 0.9, 0.35)
    } else if (type === 'aa') {
      playNoise(ctx, now, 0.12, 320, 0.04, 0.07)
    } else {
      // missile
      playTone(ctx, now, 55, 0.5, 1.5, 0.08, 1.0)
      playNoise(ctx, now, 0.1, 160, 1.2, 0.6)
    }
  }

  private playHit(damage: number): void {
    const ctx = this.ctx()
    const now = ctx.currentTime
    const vol = Math.min(damage / 100, 1) * 0.35 + 0.15
    playNoise(ctx, now, vol, 90, 0.45, 0.5)
    playTone(ctx, now, 38, vol * 0.4, 0.7, 0.01, 0.5)
  }
}

function inferWeaponType(weaponId: string): WeaponType {
  if (weaponId.includes('torpedo')) return 'torpedo'
  if (weaponId.includes('aa'))      return 'aa'
  if (weaponId.includes('missile')) return 'missile'
  return 'gun'
}

function playNoise(
  ctx: AudioContext,
  start: number,
  volume: number,
  cutoff: number,
  attack: number,
  decay: number,
): void {
  const bufLen = Math.ceil(ctx.sampleRate * (attack + decay))
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buf

  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = cutoff

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + Math.max(attack * 0.1, 0.005))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)

  src.connect(filt)
  filt.connect(gain)
  gain.connect(ctx.destination)
  src.start(start)
  src.stop(start + attack + decay + 0.01)
}

function playTone(
  ctx: AudioContext,
  start: number,
  freq: number,
  volume: number,
  duration: number,
  attack: number,
  decay: number,
): void {
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, start)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.4, start + duration)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + attack + decay + 0.01)
}
