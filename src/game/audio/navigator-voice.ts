import type { CombatState, ShipEntity } from '../simulation/types'
import combatStartVoiceUrl from '../../assets/audio/aivis-navigator/combat-start.wav?url'
import enemySunkVoiceUrl from '../../assets/audio/aivis-navigator/enemy-sunk.wav?url'
import missionCompletedVoiceUrl from '../../assets/audio/aivis-navigator/mission-completed.wav?url'
import missionFailedVoiceUrl from '../../assets/audio/aivis-navigator/mission-failed.wav?url'
import hpDangerVoiceUrl from '../../assets/audio/aivis-navigator/hp-danger.wav?url'
import hpHeavyVoiceUrl from '../../assets/audio/aivis-navigator/hp-heavy.wav?url'
import hpMediumVoiceUrl from '../../assets/audio/aivis-navigator/hp-medium.wav?url'
import bossAlertVoiceUrl from '../../assets/audio/aivis-navigator/boss-alert.wav?url'
import enemyCloseVoiceUrl from '../../assets/audio/aivis-navigator/enemy-close.wav?url'
import ammoEmptyVoiceUrl from '../../assets/audio/aivis-navigator/ammo-empty.wav?url'

type Priority = 'high' | 'normal' | 'low'
type VoiceClipId =
  | 'combat-start'
  | 'enemy-sunk'
  | 'mission-completed'
  | 'mission-failed'
  | 'hp-danger'
  | 'hp-heavy'
  | 'hp-medium'
  | 'boss-alert'
  | 'enemy-close'
  | 'ammo-empty'

interface QueuedLine {
  text: string
  priority: Priority
  clip?: VoiceClipId
}

const VOICE_CLIPS: Record<VoiceClipId, string> = {
  'combat-start': combatStartVoiceUrl,
  'enemy-sunk': enemySunkVoiceUrl,
  'mission-completed': missionCompletedVoiceUrl,
  'mission-failed': missionFailedVoiceUrl,
  'hp-danger': hpDangerVoiceUrl,
  'hp-heavy': hpHeavyVoiceUrl,
  'hp-medium': hpMediumVoiceUrl,
  'boss-alert': bossAlertVoiceUrl,
  'enemy-close': enemyCloseVoiceUrl,
  'ammo-empty': ammoEmptyVoiceUrl,
}

export class NavigatorVoice {
  private queue: QueuedLine[] = []
  private speaking = false
  private currentAudio: HTMLAudioElement | null = null
  private subtitleText = ''
  private subtitleExpiry = 0   // Date.now() ms
  private lastProcessedTick = -1

  // per-battle state
  private hpTier = 0           // 0=full 1=75% 2=50% 3=25%
  private bossAlerted = false
  private enemySunkCount = 0
  private enemyApproachNextTick = 0
  private ammoAlerted = new Set<string>()

  reset(): void {
    this.queue = []
    this.speaking = false
    this.stopCurrentAudio()
    this.subtitleText = ''
    this.subtitleExpiry = 0
    this.lastProcessedTick = -1
    this.hpTier = 0
    this.bossAlerted = false
    this.enemySunkCount = 0
    this.enemyApproachNextTick = 0
    this.ammoAlerted.clear()
    window.speechSynthesis?.cancel()
  }

  announceCombatStart(): void {
    this.enqueue('出撃！戦闘を開始します', 'high', 'combat-start')
  }

  update(state: CombatState): void {
    if (state.tick === this.lastProcessedTick) return
    this.lastProcessedTick = state.tick

    this.handleEvents(state)
    this.checkPlayerState(state)
  }

  getSubtitle(): string {
    return Date.now() < this.subtitleExpiry ? this.subtitleText : ''
  }

  private handleEvents(state: CombatState): void {
    for (const ev of state.eventLog) {
      if (ev.type === 'entity.destroyed' && ev.targetId) {
        const entity = state.entities.get(ev.targetId)
        if (entity?.kind === 'ship' && (entity as ShipEntity).team === 'enemy') {
          this.enemySunkCount++
          const suffix = this.enemySunkCount === 1 ? '' : `　${this.enemySunkCount}隻目`
          this.enqueue(`敵艦撃沈！${suffix}`, 'normal', 'enemy-sunk')
        }
      }
      if (ev.type === 'mission.completed') {
        this.enqueue('任務完了！見事な戦果です', 'high', 'mission-completed')
      }
      if (ev.type === 'mission.failed') {
        this.enqueue('任務失敗。撤退を勧告します', 'high', 'mission-failed')
      }
    }
  }

  private checkPlayerState(state: CombatState): void {
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    if (!player || player.destroyed) return

    const ratio = player.hp / player.maxHp

    if (ratio < 0.25 && this.hpTier < 3) {
      this.hpTier = 3
      this.enqueue('危険！船体が限界です', 'high', 'hp-danger')
    } else if (ratio < 0.50 && this.hpTier < 2) {
      this.hpTier = 2
      this.enqueue('大破！損傷が深刻です', 'high', 'hp-heavy')
    } else if (ratio < 0.75 && this.hpTier < 1) {
      this.hpTier = 1
      this.enqueue('中破。損傷を確認してください', 'normal', 'hp-medium')
    }

    // boss detection
    if (!this.bossAlerted) {
      const bossVisible = [...state.entities.values()].some(e =>
        e.kind === 'ship' &&
        !(e as ShipEntity).destroyed &&
        (e as ShipEntity).templateId === 'hull.enemy.boss.dreadnought' &&
        state.detectedByPlayer.has(e.id)
      )
      if (bossVisible) {
        this.bossAlerted = true
        this.enqueue('ボス艦隊発見！最大警戒態勢！', 'high', 'boss-alert')
      }
    }

    // enemy close approach (cooldown 10 sec = 300 ticks)
    if (state.tick >= this.enemyApproachNextTick) {
      const CLOSE = 1200
      const close = [...state.entities.values()].some(e => {
        if (e.kind !== 'ship' || (e as ShipEntity).team !== 'enemy' || (e as ShipEntity).destroyed) return false
        if (!state.detectedByPlayer.has(e.id)) return false
        const dx = (e as ShipEntity).pos.x - player.pos.x
        const dy = (e as ShipEntity).pos.y - player.pos.y
        return dx * dx + dy * dy < CLOSE * CLOSE
      })
      if (close) {
        this.enemyApproachNextTick = state.tick + 300
        this.enqueue('敵艦接近！', 'normal', 'enemy-close')
      }
    }

    // ammo empty
    for (const w of player.weapons) {
      if (w.ammo === 0 && w.maxAmmo > 0 && !this.ammoAlerted.has(w.id)) {
        this.ammoAlerted.add(w.id)
        this.enqueue(`${w.name}、弾薬切れ`, 'low', 'ammo-empty')
      }
    }
  }

  private enqueue(text: string, priority: Priority, clip?: VoiceClipId): void {
    this.subtitleText = text
    this.subtitleExpiry = Date.now() + Math.max(2500, text.length * 120)

    if (priority === 'high') {
      this.queue = [{ text, priority, clip }]
      window.speechSynthesis?.cancel()
      this.stopCurrentAudio()
      this.speaking = false
    } else if (this.queue.length < 3) {
      this.queue.push({ text, priority, clip })
    }

    this.trySpeakNext()
  }

  private trySpeakNext(): void {
    if (this.speaking || this.queue.length === 0) return
    const msg = this.queue.shift()!
    this.speaking = true

    if (msg.clip) {
      this.playVoiceClip(msg)
      return
    }

    this.speakWithBrowser(msg.text)
  }

  private playVoiceClip(msg: QueuedLine): void {
    const url = msg.clip ? VOICE_CLIPS[msg.clip] : null
    if (!url) {
      this.speakWithBrowser(msg.text)
      return
    }

    const audio = new Audio(url)
    audio.volume = msg.priority === 'low' ? 0.76 : 0.88
    audio.onended = () => this.finishSpeaking()
    audio.onerror = () => this.speakWithBrowser(msg.text)
    this.currentAudio = audio
    void audio.play().catch(() => this.speakWithBrowser(msg.text))
  }

  private speakWithBrowser(text: string): void {
    const synth = window.speechSynthesis
    if (!synth) { this.finishSpeaking(); return }

    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'ja-JP'
    utt.rate = 1.05
    utt.pitch = 1.0
    utt.volume = 0.9

    utt.onend = () => this.finishSpeaking()
    utt.onerror = () => this.finishSpeaking()

    synth.speak(utt)
  }

  private finishSpeaking(): void {
    this.currentAudio = null
    this.speaking = false
    this.trySpeakNext()
  }

  private stopCurrentAudio(): void {
    if (!this.currentAudio) return
    this.currentAudio.pause()
    this.currentAudio.currentTime = 0
    this.currentAudio = null
  }
}
