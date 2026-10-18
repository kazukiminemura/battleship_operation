import stage01VoiceUrl from '../../assets/audio/aivis-briefing/stage-01.wav?url'
import stage02VoiceUrl from '../../assets/audio/aivis-briefing/stage-02.wav?url'
import stage03VoiceUrl from '../../assets/audio/aivis-briefing/stage-03.wav?url'
import stage04VoiceUrl from '../../assets/audio/aivis-briefing/stage-04.wav?url'
import stage05VoiceUrl from '../../assets/audio/aivis-briefing/stage-05.wav?url'
import stage06VoiceUrl from '../../assets/audio/aivis-briefing/stage-06.wav?url'
import stage07VoiceUrl from '../../assets/audio/aivis-briefing/stage-07.wav?url'
import stage08VoiceUrl from '../../assets/audio/aivis-briefing/stage-08.wav?url'
import stage09VoiceUrl from '../../assets/audio/aivis-briefing/stage-09.wav?url'
import stage10VoiceUrl from '../../assets/audio/aivis-briefing/stage-10.wav?url'

const BRIEFING_CLIPS: Record<number, string> = {
  1: stage01VoiceUrl,
  2: stage02VoiceUrl,
  3: stage03VoiceUrl,
  4: stage04VoiceUrl,
  5: stage05VoiceUrl,
  6: stage06VoiceUrl,
  7: stage07VoiceUrl,
  8: stage08VoiceUrl,
  9: stage09VoiceUrl,
  10: stage10VoiceUrl,
}

export class StageBriefingVoice {
  private currentAudio: HTMLAudioElement | null = null
  private currentStage: number | null = null
  private volume = 0.9
  private paused = false

  get isSpeaking(): boolean { return this.currentAudio !== null && !this.paused }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.currentAudio) this.currentAudio.volume = this.volume
    if (this.volume === 0) this.stop()
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return
    this.paused = paused
    const audio = this.currentAudio
    if (!audio) return
    if (paused) audio.pause()
    else void audio.play().catch(() => {
      if (!this.paused && this.currentAudio === audio) this.stop()
    })
  }

  play(stage: number): void {
    if (this.volume === 0) return
    if (this.currentStage === stage && this.currentAudio && !this.currentAudio.ended) return

    this.stop()
    const url = BRIEFING_CLIPS[stage]
    if (!url) return

    const audio = new Audio(url)
    audio.volume = this.volume
    audio.onended = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null
        this.currentStage = null
      }
    }
    audio.onerror = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null
        this.currentStage = null
      }
    }

    this.currentAudio = audio
    this.currentStage = stage
    if (this.paused) return
    void audio.play().catch(() => {
      if (!this.paused && this.currentAudio === audio) {
        this.currentAudio = null
        this.currentStage = null
      }
    })
  }

  stop(): void {
    if (!this.currentAudio) {
      this.currentStage = null
      return
    }
    this.currentAudio.onended = null
    this.currentAudio.onerror = null
    this.currentAudio.pause()
    this.currentAudio.currentTime = 0
    this.currentAudio = null
    this.currentStage = null
  }
}
