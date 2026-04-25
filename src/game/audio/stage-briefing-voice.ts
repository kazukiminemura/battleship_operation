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

  play(stage: number): void {
    if (this.currentStage === stage && this.currentAudio && !this.currentAudio.ended) return

    this.stop()
    const url = BRIEFING_CLIPS[stage]
    if (!url) return

    const audio = new Audio(url)
    audio.volume = stage >= 10 ? 0.92 : 0.84
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
    void audio.play().catch(() => {
      if (this.currentAudio === audio) {
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
    this.currentAudio.pause()
    this.currentAudio.currentTime = 0
    this.currentAudio = null
    this.currentStage = null
  }
}
