import type { CombatEvent, WeaponType } from '../simulation/types'
import surfaceExplosionUrl from '../../assets/audio/soundeffect-lab/bomb4.mp3?url'
import heavyExplosionUrl from '../../assets/audio/soundeffect-lab/big-explosion1.mp3?url'
import cannon04Url from '../../assets/audio/cannon/cannon-04.mp3?url'
import cannon06Url from '../../assets/audio/cannon/cannon-06.mp3?url'
import cannon08Url from '../../assets/audio/cannon/cannon-08.mp3?url'
import cannon09Url from '../../assets/audio/cannon/cannon-09.mp3?url'
import cannon09bUrl from '../../assets/audio/cannon/cannon-09b.mp3?url'
import titleBgmUrl from '../../../music/maou_bgm_neorock01.mp3?url'
import prepAltBgmUrl from '../../../music/maou_bgm_neorock05.mp3?url'
import prepBgmUrl from '../../../music/maou_bgm_neorock25.mp3?url'
import introBgmUrl from '../../../music/maou_bgm_neorock14.mp3?url'
import normalAlt3BgmUrl from '../../../music/maou_bgm_neorock29.mp3?url'
import normalBgmUrl from '../../../music/maou_bgm_neorock35.mp3?url'
import normalAltBgmUrl from '../../../music/maou_bgm_neorock36.mp3?url'
import normalAlt2BgmUrl from '../../../music/maou_bgm_neorock37.mp3?url'
import bossBgmUrl from '../../../music/maou_bgm_neorock42.mp3?url'
import resultsBgmUrl from '../../../music/maou_bgm_neorock10.mp3?url'
import { inferWeaponSoundClass, inferWeaponType, type WeaponSoundClass } from './weapon-audio'

type ExplosionSample = keyof typeof EXPLOSION_SAMPLE_URLS
type CannonSample = keyof typeof CANNON_SAMPLE_URLS
type SpeedDirection = 'up' | 'down'
type BgmMode = 'title' | 'prep' | 'intro' | 'normal' | 'boss' | 'results'

const EXPLOSION_SAMPLE_URLS = {
  surface: surfaceExplosionUrl,
  heavy: heavyExplosionUrl,
} as const

const CANNON_SAMPLE_URLS = {
  light: cannon08Url,
  medium: cannon06Url,
  heavy: cannon04Url,
  superHeavy: cannon09Url,
  thunder: cannon09bUrl,
} as const

const BGM_TRACKS: Record<BgmMode, { urls: string[], volume: number }> = {
  title:   { urls: [titleBgmUrl],                                                volume: 0.42 },
  prep:    { urls: [prepBgmUrl, prepAltBgmUrl],                                  volume: 0.30 },
  intro:   { urls: [introBgmUrl],                                                volume: 0.36 },
  normal:  { urls: [normalBgmUrl, normalAltBgmUrl, normalAlt2BgmUrl, normalAlt3BgmUrl], volume: 0.44 },
  boss:    { urls: [bossBgmUrl],                                                 volume: 0.52 },
  results: { urls: [resultsBgmUrl],                                              volume: 0.36 },
}

export class SoundSystem {
  private actx: AudioContext | null = null
  private bus: DynamicsCompressorNode | null = null
  private lastProcessedTick = -1
  private explosionBuffers: Partial<Record<ExplosionSample, AudioBuffer>> = {}
  private explosionLoads: Partial<Record<ExplosionSample, Promise<AudioBuffer | null>>> = {}
  private cannonBuffers: Partial<Record<CannonSample, AudioBuffer>> = {}
  private cannonLoads: Partial<Record<CannonSample, Promise<AudioBuffer | null>>> = {}
  private bgmEnabled = false
  private bgmGain: GainNode | null = null
  private bgmTimer: ReturnType<typeof setInterval> | null = null
  private bgmStep = 0
  private bgmMode: BgmMode = 'normal'
  private bgmAudio: HTMLAudioElement | null = null
  private bgmFadeTimer: ReturnType<typeof setInterval> | null = null
  private bgmTrackIndex: Record<BgmMode, number> = {
    title: 0,
    prep: 0,
    intro: 0,
    normal: 0,
    boss: 0,
    results: 0,
  }

  reset(): void {
    this.lastProcessedTick = -1
  }

  isBgmEnabled(): boolean {
    return this.bgmEnabled
  }

  setBgmEnabled(enabled: boolean, mode: BgmMode = this.bgmMode): void {
    const previousMode = this.bgmMode
    this.bgmMode = mode
    if (enabled === this.bgmEnabled) {
      if (enabled && previousMode !== mode) {
        this.restartBgm()
      } else if (enabled && !this.bgmAudio) {
        this.startBgm()
      }
      return
    }
    this.bgmEnabled = enabled
    if (enabled) {
      this.startBgm()
    } else {
      this.stopBgm()
    }
  }

  toggleBgm(): boolean {
    this.setBgmEnabled(!this.bgmEnabled)
    return this.bgmEnabled
  }

  setBgmMode(mode: BgmMode): void {
    if (mode === this.bgmMode) return
    this.bgmMode = mode
    this.bgmStep = 0
    if (this.bgmEnabled) {
      this.restartBgm()
    }
  }

  processEvents(events: CombatEvent[], currentTick: number): void {
    for (const ev of events) {
      if (ev.tick <= this.lastProcessedTick) continue
      if (ev.type === 'weapon.fired' && ev.weaponId) {
        this.playFired(inferWeaponSoundClass(ev.weaponId), ev.weaponId, ev.salvoCount ?? 1)
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

  playDesignSelect(): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    filteredNoise(ctx, dst, now + 0.000, 0.026, 'bandpass', 1300, 1.4, 0.001, 0.035)
    pulseTone(ctx, dst, now + 0.006, 440, 0.030, 0.055, 'triangle')
    pulseTone(ctx, dst, now + 0.052, 660, 0.020, 0.060, 'sine')
  }

  playDesignPlace(): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    filteredNoise(ctx, dst, now + 0.000, 0.048, 'bandpass', 360, 1.0, 0.002, 0.070)
    sineDecay(ctx, dst, now + 0.004, 92, 0.090, 0.004, 0.120)
    pulseTone(ctx, dst, now + 0.050, 520, 0.026, 0.070, 'triangle')
  }

  playDesignEquip(): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    filteredNoise(ctx, dst, now + 0.000, 0.040, 'highpass', 2200, 0.8, 0.001, 0.030)
    pulseTone(ctx, dst, now + 0.010, 330, 0.036, 0.070, 'square')
    pulseTone(ctx, dst, now + 0.075, 495, 0.030, 0.085, 'triangle')
    pulseTone(ctx, dst, now + 0.140, 660, 0.020, 0.090, 'sine')
  }

  playDesignBack(): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    pulseTone(ctx, dst, now + 0.000, 390, 0.030, 0.070, 'triangle')
    pulseTone(ctx, dst, now + 0.060, 260, 0.024, 0.090, 'sine')
    filteredNoise(ctx, dst, now + 0.012, 0.018, 'bandpass', 760, 0.9, 0.002, 0.070)
  }

  playDesignConfirm(): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    filteredNoise(ctx, dst, now + 0.000, 0.052, 'bandpass', 520, 1.2, 0.002, 0.080)
    pulseTone(ctx, dst, now + 0.000, 330, 0.040, 0.110, 'triangle')
    pulseTone(ctx, dst, now + 0.080, 495, 0.036, 0.120, 'triangle')
    pulseTone(ctx, dst, now + 0.165, 660, 0.032, 0.150, 'sine')
    sweepTone(ctx, dst, now + 0.030, 220, 660, 0.030, 0.260)
  }

  playDesignDenied(): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime
    filteredNoise(ctx, dst, now + 0.000, 0.026, 'bandpass', 180, 0.8, 0.002, 0.085)
    pulseTone(ctx, dst, now + 0.000, 180, 0.030, 0.070, 'square')
    pulseTone(ctx, dst, now + 0.060, 150, 0.022, 0.090, 'square')
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
      this.preloadCannonSamples(this.actx)
    }
    if (this.actx.state === 'suspended') this.actx.resume()
    return this.actx
  }

  private dest(): AudioNode {
    this.getCtx()
    return this.bus!
  }

  private startBgm(): void {
    const track = BGM_TRACKS[this.bgmMode]
    const trackIndex = this.bgmTrackIndex[this.bgmMode] % track.urls.length
    const trackUrl = track.urls[trackIndex]!
    this.clearBgmFade()

    if (!this.bgmAudio || this.bgmAudio.src !== new URL(trackUrl, window.location.href).href) {
      this.stopBgmAudioNow()
      this.bgmAudio = new Audio(trackUrl)
      this.bgmAudio.loop = track.urls.length === 1
      this.bgmAudio.preload = 'auto'
      this.bgmAudio.onended = () => this.playNextBgmTrack(this.bgmMode)
    }

    this.bgmAudio.volume = 0
    void this.bgmAudio.play()
      .then(() => this.fadeBgmTo(track.volume, 700))
      .catch(() => {
        // Browsers may block music before the first user gesture. The next UI sound
        // unlocks audio, and subsequent mode changes will try playback again.
      })
  }

  private playNextBgmTrack(mode: BgmMode): void {
    if (!this.bgmEnabled || mode !== this.bgmMode) return
    this.bgmTrackIndex[mode] = (this.bgmTrackIndex[mode] + 1) % BGM_TRACKS[mode].urls.length
    this.stopBgmAudioNow()
    this.startBgm()
  }

  private restartBgm(): void {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
    this.stopBgmAudioNow()
    this.startBgm()
  }

  private stopBgm(): void {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
    if (!this.bgmAudio) return
    this.fadeBgmTo(0, 350, () => this.stopBgmAudioNow())
  }

  private stopBgmAudioNow(): void {
    this.clearBgmFade()
    if (!this.bgmAudio) return
    this.bgmAudio.onended = null
    this.bgmAudio.pause()
    this.bgmAudio.currentTime = 0
    this.bgmAudio = null
  }

  private fadeBgmTo(target: number, durationMs: number, done?: () => void): void {
    if (!this.bgmAudio) return
    this.clearBgmFade()
    const audio = this.bgmAudio
    const from = audio.volume
    const startedAt = performance.now()
    this.bgmFadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - startedAt) / durationMs)
      audio.volume = from + (target - from) * t
      if (t >= 1) {
        this.clearBgmFade()
        done?.()
      }
    }, 32)
  }

  private clearBgmFade(): void {
    if (!this.bgmFadeTimer) return
    clearInterval(this.bgmFadeTimer)
    this.bgmFadeTimer = null
  }

  private scheduleBgmBar(): void {
    if (!this.bgmEnabled || !this.bgmGain) return
    const ctx = this.getCtx()
    const start = ctx.currentTime + 0.05
    if (this.bgmMode === 'title') {
      this.scheduleTitleBgmBar(ctx, start)
      return
    }
    if (this.bgmMode === 'prep') {
      this.schedulePrepBgmBar(ctx, start)
      return
    }
    const isBoss = this.bgmMode === 'boss'
    const rootProgression = isBoss ? [41, 46, 49, 39] : [49, 46, 41, 44]
    const root = rootProgression[this.bgmStep % rootProgression.length]!
    const phraseStep = this.bgmStep % 2
    this.bgmStep += 1

    const chord = isBoss ? [1, 1.189, 1.498, 1.782] : [1, 1.189, 1.498, 2]
    const padVolume = isBoss ? 0.038 : 0.030
    for (let i = 0; i < chord.length; i++) {
      const ratio = chord[i]!
      pulseTone(ctx, this.bgmGain, start + i * 0.025, root * 2 * ratio, padVolume, 3.8, 'sawtooth')
      pulseTone(ctx, this.bgmGain, start + 0.06 + i * 0.020, root * 4 * ratio, padVolume * 0.22, 3.3, 'triangle')
    }

    pulseTone(ctx, this.bgmGain, start, root * 0.5, isBoss ? 0.080 : 0.058, 3.7, 'sine')
    sweepTone(ctx, this.bgmGain, start, root * (isBoss ? 3.4 : 2.7), root * 1.1, isBoss ? 0.052 : 0.038, 3.8)

    const beatCount = 16
    const beatDur = 0.25
    const bassLine = isBoss ? [0, 0, 7, 0, 10, 0, 7, 0, 0, -2, 3, -2, 7, 0, 10, 7] : [0, 0, 7, 0, 5, 0, 3, 0, 0, 7, 10, 7, 5, 3, 5, 7]
    for (let i = 0; i < beatCount; i++) {
      const t = start + i * beatDur
      const downbeat = i % 4 === 0
      const bassFreq = root * 0.5 * Math.pow(2, bassLine[i]! / 12)
      pulseTone(ctx, this.bgmGain, t, bassFreq, downbeat ? (isBoss ? 0.120 : 0.090) : isBoss ? 0.074 : 0.052, 0.34, 'square')
      sineDecay(ctx, this.bgmGain, t + 0.006, root * 0.42, downbeat ? 0.052 : 0.026, 0.006, 0.220)
      if (i % 2 === 0) filteredNoise(ctx, this.bgmGain, t + 0.010, isBoss ? 0.060 : 0.044, 'lowpass', 125, 0.7, 0.004, 0.180)
      if (i % 4 === 2) filteredNoise(ctx, this.bgmGain, t + 0.012, isBoss ? 0.040 : 0.030, 'bandpass', 1450, 1.4, 0.002, 0.110)
      filteredNoise(ctx, this.bgmGain, t + 0.004, isBoss ? 0.018 : 0.014, 'highpass', 4200, 0.6, 0.001, 0.050)
      if (isBoss && i % 4 === 2) {
        pulseTone(ctx, this.bgmGain, t + 0.020, root * 2, 0.040, 0.150, 'sawtooth')
      }
      if (i === beatCount - 1) filteredNoise(ctx, this.bgmGain, t + 0.12, isBoss ? 0.060 : 0.044, 'highpass', 3600, 0.8, 0.010, 0.420)
    }

    const arp = isBoss ? [0, 7, 10, 15, 12, 10, 7, 3, 0, 3, 7, 10, 12, 15, 19, 22] : [0, 7, 10, 14, 12, 10, 7, 5, 0, 5, 7, 10, 12, 10, 7, 5]
    for (let i = 0; i < arp.length; i++) {
      const freq = root * 4 * Math.pow(2, arp[i]! / 12)
      pulseTone(ctx, this.bgmGain, start + i * 0.125, freq, isBoss ? 0.020 : 0.016, 0.090, 'square')
      pulseTone(ctx, this.bgmGain, start + i * 0.125 + 0.055, freq * 2, isBoss ? 0.010 : 0.008, 0.060, 'triangle')
    }

    const motif = isBoss
      ? [12, 10, 7, 10, 15, 14, 12, 10, 7, 10, 12, 15, 19, 17, 15, 14]
      : phraseStep === 0
        ? [12, 10, 7, 10, 14, 12, 10, 7, 5, 7, 10, 12, 14, 12, 10, 7]
        : [7, 10, 12, 14, 17, 14, 12, 10, 7, 5, 7, 10, 12, 10, 7, 5]
    for (let i = 0; i < motif.length; i++) {
      const freq = root * 4 * Math.pow(2, motif[i]! / 12)
      pulseTone(ctx, this.bgmGain, start + i * beatDur + 0.045, freq, isBoss ? 0.044 : 0.034, 0.155, 'square')
      if (i % 2 === 0) pulseTone(ctx, this.bgmGain, start + i * beatDur + 0.062, freq * 1.5, isBoss ? 0.018 : 0.013, 0.120, 'triangle')
    }
  }

  private scheduleTitleBgmBar(ctx: AudioContext, start: number): void {
    const rootProgression = [37, 44, 41, 49]
    const root = rootProgression[this.bgmStep % rootProgression.length]!
    const phraseStep = this.bgmStep % 2
    this.bgmStep += 1

    const chord = phraseStep === 0 ? [1, 1.259, 1.498, 2] : [1, 1.189, 1.498, 1.782]
    for (let i = 0; i < chord.length; i++) {
      const ratio = chord[i]!
      pulseTone(ctx, this.bgmGain!, start + i * 0.055, root * 2 * ratio, 0.030, 3.8, 'triangle')
      pulseTone(ctx, this.bgmGain!, start + 0.12 + i * 0.050, root * 4 * ratio, 0.012, 3.3, 'sine')
    }

    pulseTone(ctx, this.bgmGain!, start, root * 0.5, 0.052, 3.7, 'sine')
    sweepTone(ctx, this.bgmGain!, start, root * 1.2, root * 2.4, 0.018, 3.6)

    for (let i = 0; i < 8; i++) {
      const t = start + i * 0.5
      if (i % 4 === 0) {
        sineDecay(ctx, this.bgmGain!, t + 0.006, root * 0.42, 0.045, 0.006, 0.350)
        filteredNoise(ctx, this.bgmGain!, t + 0.010, 0.018, 'lowpass', 120, 0.7, 0.004, 0.210)
      }
      if (i % 4 === 2) filteredNoise(ctx, this.bgmGain!, t + 0.010, 0.014, 'bandpass', 1100, 1.0, 0.004, 0.130)
      filteredNoise(ctx, this.bgmGain!, t + 0.006, 0.005, 'highpass', 4200, 0.6, 0.001, 0.050)
    }

    const motif = phraseStep === 0 ? [0, 7, 12, 10, 7, 5, 7, 10] : [12, 10, 7, 5, 3, 5, 7, 10]
    for (let i = 0; i < motif.length; i++) {
      const freq = root * 4 * Math.pow(2, motif[i]! / 12)
      pulseTone(ctx, this.bgmGain!, start + i * 0.5 + 0.12, freq, 0.020, 0.180, 'triangle')
      if (i % 2 === 0) pulseTone(ctx, this.bgmGain!, start + i * 0.5 + 0.14, freq * 1.5, 0.008, 0.130, 'sine')
    }
  }

  private schedulePrepBgmBar(ctx: AudioContext, start: number): void {
    const rootProgression = [49, 55, 46, 41]
    const root = rootProgression[this.bgmStep % rootProgression.length]!
    const phraseStep = this.bgmStep % 2
    this.bgmStep += 1

    const chord = [1, 1.189, 1.498, 2]
    for (let i = 0; i < chord.length; i++) {
      const ratio = chord[i]!
      pulseTone(ctx, this.bgmGain!, start + i * 0.035, root * 2 * ratio, 0.026, 3.7, 'triangle')
      pulseTone(ctx, this.bgmGain!, start + 0.08 + i * 0.025, root * 4 * ratio, 0.008, 3.2, 'sine')
    }

    pulseTone(ctx, this.bgmGain!, start, root * 0.5, 0.040, 3.6, 'sine')
    sweepTone(ctx, this.bgmGain!, start, root * 1.8, root * 0.9, 0.020, 3.8)

    const beatDur = 0.5
    const bassLine = phraseStep === 0 ? [0, 7, 5, 3, 0, 7, 10, 7] : [0, 5, 7, 10, 12, 10, 7, 5]
    for (let i = 0; i < bassLine.length; i++) {
      const t = start + i * beatDur
      const bassFreq = root * 0.5 * Math.pow(2, bassLine[i]! / 12)
      pulseTone(ctx, this.bgmGain!, t, bassFreq, i % 4 === 0 ? 0.048 : 0.032, 0.34, 'square')
      if (i % 2 === 0) filteredNoise(ctx, this.bgmGain!, t + 0.012, 0.018, 'lowpass', 130, 0.7, 0.004, 0.150)
      filteredNoise(ctx, this.bgmGain!, t + 0.006, 0.008, 'highpass', 3800, 0.6, 0.001, 0.040)
    }

    const motif = phraseStep === 0 ? [0, 7, 10, 12, 10, 7, 5, 7] : [7, 10, 12, 14, 12, 10, 7, 5]
    for (let i = 0; i < motif.length; i++) {
      const freq = root * 4 * Math.pow(2, motif[i]! / 12)
      pulseTone(ctx, this.bgmGain!, start + i * beatDur + 0.08, freq, 0.018, 0.150, 'triangle')
      if (i % 2 === 0) pulseTone(ctx, this.bgmGain!, start + i * beatDur + 0.10, freq * 1.5, 0.008, 0.120, 'sine')
    }
  }

  private playFired(type: WeaponSoundClass, weaponId = '', salvoCount = 1): void {
    const ctx = this.getCtx()
    const dst = this.dest()
    const now = ctx.currentTime

    if (type === 'cannon') {
      this.playNavalGunFired(ctx, dst, now, weaponId, salvoCount)
    } else if (type === 'torpedo') {
      this.playTorpedoLaunch(ctx, dst, now, salvoCount)
    } else if (type === 'machineGun') {
      this.playAutoCannonBurst(ctx, dst, now, weaponId, salvoCount)
    } else if (type === 'missile') {
      this.playMissileLaunch(ctx, dst, now, weaponId, salvoCount)
    } else {
      sweepTone(ctx, dst, now + 0.000, 520, 1480, 0.13, 0.180)
      pulseTone(ctx, dst, now + 0.020, 1860, 0.060, 0.100, 'triangle')
      filteredNoise(ctx, dst, now + 0.030, 0.080, 'bandpass', 2100, 2.2, 0.010, 0.180)
    }
  }

  private playNavalGunFired(ctx: AudioContext, dst: AudioNode, now: number, weaponId: string, salvoCount: number): void {
    const caliber = inferCaliberMm(weaponId)
    const size = Math.max(0, Math.min(1, (caliber - 100) / 360))
    const isMainGun = !weaponId.includes('secondary')
    const heavyMain = isMainGun ? Math.max(0, Math.min(1, (caliber - 180) / 280)) : 0
    const shots = Math.max(1, Math.min(4, Math.round(salvoCount)))
    const spacing = caliber >= 300 ? 0.045 : 0.026

    for (let i = 0; i < shots; i++) {
      const t = now + i * spacing
      const stagger = 1 - i * 0.08
      const sample = cannonSampleForCaliber(caliber)
      const sampleRate = cannonPlaybackRateForCaliber(caliber, i)
      const sampleVolume = (0.26 + size * 0.30 + heavyMain * 0.22) * stagger

      this.playCannonSample(sample, t, sampleVolume, sampleRate, caliber >= 300
        ? { type: 'lowpass', freq: 820 - heavyMain * 320, Q: 0.55 }
        : { type: 'lowpass', freq: 1500, Q: 0.55 })
      // Keep the muzzle crack subdued; the gun should read as a blast, not a snap.
      filteredNoise(ctx, dst, t + 0.000, (0.06 + size * 0.08) * stagger, 'highpass', 900 + size * 550, 0.42, 0.004, 0.030 + size * 0.018)
      // Propellant blast: slow, broad pressure body.
      filteredNoise(ctx, dst, t + 0.004, (0.58 + size * 0.72 + heavyMain * 0.30) * stagger, 'bandpass', 145 - size * 58, 0.58, 0.018, 0.260 + size * 0.260)
      // Deck and air rumble: long low tail for heavy guns.
      filteredNoise(ctx, dst, t + 0.020, (0.34 + size * 0.52 + heavyMain * 0.44) * stagger, 'lowpass', 82 - size * 38, 0.50, 0.045, 0.760 + size * 0.780 + heavyMain * 0.620)
      sineDecay(ctx, dst, t + 0.008, 46 - size * 20, (0.48 + size * 0.54 + heavyMain * 0.22) * stagger, 0.018, 0.620 + size * 0.760)
      sineDecay(ctx, dst, t + 0.030, 92 - size * 32, (0.09 + size * 0.12) * stagger, 0.018, 0.220 + size * 0.180)
      if (heavyMain > 0) {
        // Sub-bass pressure wave for large main batteries: felt more than heard.
        sineDecay(ctx, dst, t + 0.010, 31 - heavyMain * 12, (0.28 + heavyMain * 0.64) * stagger, 0.032, 0.980 + heavyMain * 1.020)
        sineDecay(ctx, dst, t + 0.060, 20 - heavyMain * 5, (0.16 + heavyMain * 0.34) * stagger, 0.080, 1.400 + heavyMain * 1.100)
        filteredNoise(ctx, dst, t + 0.055, (0.22 + heavyMain * 0.46) * stagger, 'lowpass', 48 - heavyMain * 18, 0.45, 0.090, 1.200 + heavyMain * 1.000)
      }
    }

    // Distant reflection/echo sells large naval guns without turning them into a sci-fi zap.
    if (caliber >= 200) {
      filteredNoise(ctx, dst, now + 0.220 + size * 0.100, 0.16 + size * 0.24 + heavyMain * 0.22, 'lowpass', 120 - size * 48, 0.48, 0.100, 0.900 + size * 0.720 + heavyMain * 0.680)
    }
    if (heavyMain > 0.55) {
      this.playExplosionSample('surface', now + 0.000, 0.18 + heavyMain * 0.20, 0.56, { type: 'lowpass', freq: 240 - heavyMain * 90, Q: 0.45 })
      sineDecay(ctx, dst, now + 0.320, 23 - heavyMain * 5, 0.28 + heavyMain * 0.30, 0.120, 1.700 + heavyMain * 1.100)
    }
  }

  private playAutoCannonBurst(ctx: AudioContext, dst: AudioNode, now: number, weaponId: string, salvoCount: number): void {
    const caliber = inferCaliberMm(weaponId)
    const isCiws = weaponId.includes('ciws') || caliber <= 25
    const rounds = isCiws ? 8 : Math.max(3, Math.min(6, salvoCount * 2))
    const spacing = isCiws ? 0.012 : 0.026
    const bodyFreq = isCiws ? 780 : 460

    for (let i = 0; i < rounds; i++) {
      const t = now + i * spacing
      const falloff = 1 - i / (rounds * 1.7)
      filteredNoise(ctx, dst, t, 0.16 * falloff, 'highpass', isCiws ? 3100 : 1900, 0.75, 0.001, 0.014)
      filteredNoise(ctx, dst, t + 0.001, 0.12 * falloff, 'bandpass', bodyFreq, 1.25, 0.001, 0.026)
      sineDecay(ctx, dst, t, isCiws ? 190 : 135, 0.028 * falloff, 0.001, 0.024)
    }
    filteredNoise(ctx, dst, now + 0.004, isCiws ? 0.08 : 0.13, 'lowpass', 190, 0.7, 0.006, isCiws ? 0.110 : 0.180)
  }

  private playMissileLaunch(ctx: AudioContext, dst: AudioNode, now: number, weaponId: string, salvoCount: number): void {
    const shots = Math.max(1, Math.min(4, Math.round(salvoCount)))
    const heavy = weaponId.includes('longrange') || weaponId.includes('cruise')
    for (let i = 0; i < shots; i++) {
      const t = now + i * 0.055
      filteredNoise(ctx, dst, t + 0.000, heavy ? 0.24 : 0.18, 'highpass', 2600, 0.7, 0.001, 0.040)
      filteredNoise(ctx, dst, t + 0.006, heavy ? 0.38 : 0.28, 'bandpass', heavy ? 390 : 560, 0.85, 0.018, heavy ? 0.780 : 0.520)
      filteredNoise(ctx, dst, t + 0.035, heavy ? 0.34 : 0.24, 'lowpass', heavy ? 125 : 170, 0.7, 0.060, heavy ? 1.050 : 0.720)
      sweepTone(ctx, dst, t + 0.008, heavy ? 105 : 150, heavy ? 55 : 80, heavy ? 0.16 : 0.12, heavy ? 0.780 : 0.520)
    }
  }

  private playTorpedoLaunch(ctx: AudioContext, dst: AudioNode, now: number, salvoCount: number): void {
    const tubes = Math.max(1, Math.min(4, Math.round(salvoCount)))
    for (let i = 0; i < tubes; i++) {
      const t = now + i * 0.060
      // Compressed-air pop and tube clank, followed by a water churn instead of a cannon boom.
      filteredNoise(ctx, dst, t + 0.000, 0.12, 'highpass', 1800, 0.75, 0.001, 0.040)
      filteredNoise(ctx, dst, t + 0.010, 0.20, 'bandpass', 240, 1.0, 0.018, 0.320)
      filteredNoise(ctx, dst, t + 0.038, 0.18, 'lowpass', 95, 0.65, 0.050, 0.720)
      sineDecay(ctx, dst, t + 0.014, 62, 0.17, 0.020, 0.420)
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

  private preloadCannonSamples(ctx: AudioContext): void {
    for (const sample of Object.keys(CANNON_SAMPLE_URLS) as CannonSample[]) {
      this.loadCannonSample(ctx, sample)
    }
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

  private loadCannonSample(ctx: AudioContext, sample: CannonSample): Promise<AudioBuffer | null> {
    const loaded = this.cannonBuffers[sample]
    if (loaded) return Promise.resolve(loaded)

    const loading = this.cannonLoads[sample]
    if (loading) return loading

    const url = CANNON_SAMPLE_URLS[sample]
    const request = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cannon sample: ${res.status}`)
        return res.arrayBuffer()
      })
      .then((data) => ctx.decodeAudioData(data.slice(0)))
      .then((buffer) => {
        this.cannonBuffers[sample] = buffer
        return buffer
      })
      .catch(() => null)

    this.cannonLoads[sample] = request
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

  private playCannonSample(
    sample: CannonSample,
    start: number,
    volume: number,
    playbackRate: number,
    filter?: { type: BiquadFilterType, freq: number, Q: number },
  ): void {
    const ctx = this.getCtx()
    const buffer = this.cannonBuffers[sample]
    if (!buffer) {
      this.loadCannonSample(ctx, sample)
      return
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.setValueAtTime(playbackRate, start)

    const gain = ctx.createGain()
    const duration = buffer.duration / playbackRate
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.010)
    gain.gain.setValueAtTime(volume, start + Math.max(0.025, duration - 0.070))
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

function inferCaliberMm(weaponId: string): number {
  const match = weaponId.match(/(\d{2,3})mm/i)
  if (match) return Number(match[1])
  if (weaponId.includes('ciws')) return 20
  if (weaponId.includes('aa')) return 40
  if (weaponId.includes('secondary')) return 127
  if (weaponId.includes('boss')) return 460
  return 152
}

function cannonSampleForCaliber(caliber: number): CannonSample {
  if (caliber >= 450) return 'thunder'
  if (caliber >= 380) return 'superHeavy'
  if (caliber >= 200) return 'heavy'
  if (caliber >= 150) return 'medium'
  return 'light'
}

function cannonPlaybackRateForCaliber(caliber: number, shotIndex: number): number {
  const base = caliber >= 450 ? 0.62
    : caliber >= 380 ? 0.70
      : caliber >= 200 ? 0.82
        : caliber >= 150 ? 0.96
          : 1.08
  return base + (shotIndex % 2 === 0 ? 0 : 0.025)
}
