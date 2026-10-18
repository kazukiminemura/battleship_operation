import { afterEach, describe, expect, it, vi } from 'vitest'
import { NavigatorVoice } from '../../src/game/audio/navigator-voice'
import { StageBriefingVoice } from '../../src/game/audio/stage-briefing-voice'

class FakeAudio {
  static instances: FakeAudio[] = []
  volume = 1
  currentTime = 0
  ended = false
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  pause = vi.fn()
  play = vi.fn(() => Promise.resolve())
  constructor(_url: string) { FakeAudio.instances.push(this) }
}

afterEach(() => { vi.unstubAllGlobals(); FakeAudio.instances = [] })

function setup(): void {
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('window', { speechSynthesis: { cancel: vi.fn(), speak: vi.fn(), pause: vi.fn(), resume: vi.fn() } })
}

describe('voice playback controls', () => {
  it('retains subtitles with muted narration and pauses/resumes an active clip', () => {
    setup()
    const voice = new NavigatorVoice()
    voice.setVolume(0)
    voice.announceCombatStart()
    expect(voice.getSubtitle()).toContain('出撃')
    expect(FakeAudio.instances).toHaveLength(0)
    voice.setVolume(0.4)
    voice.announceCombatStart()
    const clip = FakeAudio.instances[0]!
    expect(clip.volume).toBe(0.4)
    voice.setPaused(true)
    expect(clip.pause).toHaveBeenCalled()
    expect(voice.isSpeaking).toBe(false)
    voice.setPaused(false)
    expect(clip.play).toHaveBeenCalledTimes(2)
    expect(voice.isSpeaking).toBe(true)
  })

  it('ignores an old completion callback after reset and a new announcement', () => {
    setup()
    const voice = new NavigatorVoice()
    voice.announceCombatStart()
    const oldEnd = FakeAudio.instances[0]!.onended!
    voice.reset()
    voice.announceCombatStart()
    oldEnd()
    expect(voice.isSpeaking).toBe(true)
    expect(FakeAudio.instances[1]!.pause).not.toHaveBeenCalled()
  })

  it('does not restart narration after a stale play rejection', async () => {
    setup()
    let rejectPlay: (reason: Error) => void = () => {}
    const originalAudio = FakeAudio
    vi.stubGlobal('Audio', class extends originalAudio {
      constructor(url: string) {
        super(url)
        this.play = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectPlay = reject }))
      }
    })
    const voice = new NavigatorVoice()
    voice.announceCombatStart()
    voice.reset()
    rejectPlay(new Error('stale playback'))
    await Promise.resolve()
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
    expect(voice.isSpeaking).toBe(false)
  })

  it('briefing pause resumes the same clip and mute prevents further playback', () => {
    setup()
    const voice = new StageBriefingVoice()
    voice.play(1)
    const clip = FakeAudio.instances[0]!
    voice.setPaused(true)
    expect(voice.isSpeaking).toBe(false)
    voice.setPaused(false)
    expect(clip.play).toHaveBeenCalledTimes(2)
    voice.setVolume(0)
    voice.play(2)
    expect(voice.isSpeaking).toBe(false)
    expect(FakeAudio.instances).toHaveLength(1)
  })
})
