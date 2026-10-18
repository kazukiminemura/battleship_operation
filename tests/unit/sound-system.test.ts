import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoundSystem } from '../../src/game/audio/sounds'
import type { CombatEvent } from '../../src/game/simulation/types'

class Param {
  value = 0
  setValueAtTime(value: number) { this.value = value }
  linearRampToValueAtTime(value: number) { this.value = value }
  exponentialRampToValueAtTime(value: number) { this.value = value }
  setTargetAtTime(value: number) { this.value = value }
}
class Node {
  gain = new Param()
  pan = new Param()
  frequency = new Param()
  Q = new Param()
  playbackRate = new Param()
  threshold = new Param()
  knee = new Param()
  ratio = new Param()
  attack = new Param()
  release = new Param()
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}
class Context {
  currentTime = 0
  sampleRate = 100
  state = 'running'
  destination = new Node()
  gains: Node[] = []
  panners: Node[] = []
  resume = vi.fn(async () => { this.state = 'running' })
  createDynamicsCompressor() { return new Node() }
  createGain() { const node = new Node(); this.gains.push(node); return node }
  createStereoPanner() { const node = new Node(); this.panners.push(node); return node }
  createBufferSource() { return new Node() }
  createOscillator() { return new Node() }
  createBiquadFilter() { return new Node() }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
}
class Music {
  static all: Music[] = []
  static blocked = false
  volume = 0
  currentTime = 17
  paused = true
  loop = false
  preload = ''
  onended: (() => void) | null = null
  play = vi.fn(async () => {
    if (Music.blocked) throw new Error('autoplay blocked')
    this.paused = false
  })
  pause = vi.fn(() => { this.paused = true })
  constructor(public src: string) { Music.all.push(this) }
}
const fired = (tick: number, x = 0): CombatEvent => ({
  tick, type: 'weapon.fired', weaponId: 'weapon.torpedo.533mm.basic', position: { x, y: 0, z: 0 },
})
const settle = async () => { await Promise.resolve(); await Promise.resolve() }

describe('SoundSystem mix and playback lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date', 'performance'] })
    Music.all = []
    Music.blocked = false
    vi.stubGlobal('AudioContext', Context)
    vi.stubGlobal('Audio', Music)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('retries blocked music on unlock and resumes the audio context', async () => {
    const sound = new SoundSystem()
    Music.blocked = true
    sound.setBgmEnabled(true, 'title')
    await settle()
    expect(Music.all[0]!.paused).toBe(true)
    Music.blocked = false
    ;(sound.getAudioContext() as unknown as Context).state = 'suspended'
    sound.unlock()
    await settle()
    expect(Music.all).toHaveLength(1)
    expect(Music.all[0]!.play).toHaveBeenCalledTimes(2)
    expect(sound.getAudioContext().state).toBe('running')
    await vi.advanceTimersByTimeAsync(750)
    expect(Music.all[0]!.volume).toBeCloseTo(0.42 * 0.7)
  })

  it('crossfades modes, ducks speech, and pauses/resumes without seeking', async () => {
    const sound = new SoundSystem()
    sound.setBgmEnabled(true, 'cruise')
    await settle()
    await vi.advanceTimersByTimeAsync(750)
    const old = Music.all[0]!
    sound.setBgmMode('normal')
    await settle()
    expect(old.paused).toBe(false)
    expect(Music.all[1]!.paused).toBe(false)
    await vi.advanceTimersByTimeAsync(750)
    expect(old.paused).toBe(true)
    const current = Music.all[1]!
    sound.setMusicVolume(0.5)
    sound.setVoiceActive(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(current.volume).toBeCloseTo(0.44 * 0.5 * 0.3)
    sound.setPaused(true)
    expect(current.paused).toBe(true)
    expect(current.currentTime).toBe(17)
    sound.setPaused(false)
    await settle()
    expect(current.paused).toBe(false)
    expect(Music.all).toHaveLength(2)
    sound.setVoiceActive(false)
    await vi.advanceTimersByTimeAsync(750)
    expect(current.volume).toBeCloseTo(0.22)
  })

  it('attenuates and pans events, deduplicates ticks, and bounds busy salvos', () => {
    const sound = new SoundSystem()
    const ctx = sound.getAudioContext() as unknown as Context
    sound.processEvents([fired(1, 900)], 1, { x: 0, y: 0 })
    expect(ctx.panners[0]!.pan.value).toBeCloseTo(0.75 / Math.SQRT2)
    expect(ctx.gains[1]!.gain.value).toBeCloseTo(0.5)
    sound.processEvents([fired(1)], 1)
    expect(ctx.panners).toHaveLength(1)
    sound.processEvents(Array.from({ length: 50 }, () => fired(2)), 2)
    expect(ctx.panners).toHaveLength(10)
    ctx.currentTime = 4
    sound.processEvents([fired(3, -2000)], 3, { x: 0, y: 0 })
    expect(ctx.panners.at(-1)!.pan.value).toBe(-0.85)
    expect(ctx.panners[0]!.disconnect).toHaveBeenCalledOnce()
  })

  it('applies music mute while paused before playback resumes', async () => {
    const sound = new SoundSystem()
    sound.setBgmEnabled(true, 'title')
    await settle()
    await vi.advanceTimersByTimeAsync(750)
    sound.setPaused(true)
    sound.setMusicVolume(0)
    sound.setPaused(false)
    await settle()
    expect(Music.all[0]!.paused).toBe(false)
    expect(Music.all[0]!.volume).toBe(0)
  })

  it('uses screen-space left/right for the isometric camera', () => {
    const sound = new SoundSystem()
    const ctx = sound.getAudioContext() as unknown as Context
    sound.processEvents([
      { ...fired(1), position: { x: 0, y: 900, z: 0 } },
      { ...fired(1), position: { x: 900, y: 900, z: 0 } },
    ], 1, { x: 0, y: 0 })
    expect(ctx.panners[0]!.pan.value).toBeLessThan(0)
    expect(ctx.panners[1]!.pan.value).toBe(0)
  })

  it('unlocks each standalone designer UI sound and tolerates blocked resume', async () => {
    const sound = new SoundSystem()
    const ctx = sound.getAudioContext() as unknown as Context
    const actions = [
      () => sound.playWeaponSelected('gun'), () => sound.playSpeedChange('up'),
      () => sound.playDesignSelect(), () => sound.playDesignPlace(),
      () => sound.playDesignEquip(), () => sound.playDesignBack(),
      () => sound.playDesignConfirm(), () => sound.playDesignDenied(),
    ]
    for (const action of actions) {
      ctx.state = 'suspended'
      action()
    }
    expect(ctx.resume).toHaveBeenCalledTimes(actions.length)
    ctx.state = 'suspended'
    ctx.resume.mockRejectedValueOnce(new Error('user gesture required'))
    sound.playDesignSelect()
    await settle()
  })

  it('silences outgoing crossfade tails when music is muted or voice starts', async () => {
    for (const change of ['mute', 'voice']) {
      const sound = new SoundSystem()
      sound.setBgmEnabled(true, 'title')
      await settle()
      await vi.advanceTimersByTimeAsync(750)
      const outgoing = Music.all.at(-1)!
      sound.setBgmMode('normal')
      await settle()
      if (change === 'mute') sound.setMusicVolume(0)
      else sound.setVoiceActive(true)
      await vi.advanceTimersByTimeAsync(160)
      expect(outgoing.volume).toBe(0)
      expect(outgoing.paused).toBe(true)
      sound.setBgmEnabled(false)
      await vi.advanceTimersByTimeAsync(800)
    }
  })

  it('ignores intercepted projectiles, plays sinking ships, and keeps effects/music independent', async () => {
    const sound = new SoundSystem()
    const ctx = sound.getAudioContext() as unknown as Context
    const bus = sound.getEffectsDestination() as unknown as Node
    sound.processEvents([{ tick: 1, type: 'entity.destroyed', targetId: 'projectile.1' }], 1)
    expect(ctx.panners).toHaveLength(0)
    sound.processEvents([{ tick: 2, type: 'entity.destroyed', targetId: 'ship.enemy.1' }], 2)
    expect(ctx.panners).toHaveLength(1)
    sound.setBgmEnabled(true)
    await settle()
    sound.setEffectsVolume(0)
    expect(bus.gain.value).toBe(0)
    await vi.advanceTimersByTimeAsync(750)
    expect(Music.all[0]!.volume).toBeGreaterThan(0)
    sound.setEffectsVolume(2)
    expect(bus.gain.value).toBe(1)
    sound.setPaused(true)
    sound.processEvents([fired(3)], 3)
    expect(ctx.panners).toHaveLength(1)
    expect(bus.gain.value).toBe(0)
    sound.setPaused(false)
    expect(bus.gain.value).toBe(1)
    sound.processEvents([fired(3)], 3)
    expect(ctx.panners).toHaveLength(1)
    sound.reset()
    sound.processEvents([fired(1)], 1)
    expect(ctx.panners).toHaveLength(2)
  })

  it('does not queue pre-gesture battle sounds in a suspended context', () => {
    const sound = new SoundSystem()
    const ctx = sound.getAudioContext() as unknown as Context
    ctx.state = 'suspended'
    sound.processEvents([fired(1)], 1)
    expect(ctx.panners).toHaveLength(0)
    sound.unlock()
    sound.processEvents([fired(1), fired(2)], 2)
    expect(ctx.panners).toHaveLength(1)
  })

  it('allows music unlock and event processing without Web Audio support', () => {
    vi.stubGlobal('AudioContext', undefined)
    const sound = new SoundSystem()
    expect(() => sound.unlock()).not.toThrow()
    expect(() => sound.playDesignSelect()).not.toThrow()
    expect(() => sound.processEvents([fired(1)], 1)).not.toThrow()
  })
})
