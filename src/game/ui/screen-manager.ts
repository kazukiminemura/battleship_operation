import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ShipDesigner } from '../../designer/ShipDesigner'
import type { PrepResult } from '../../designer/types'
import type { StartScreen } from './startscreen'
import type { StageIntroScreen } from './stageintroscreen'
import type { ResultsScreen } from './resultsscreen'
import type { SoundSystem } from '../audio/sounds'
import type { InputAdapter } from '../input/adapter'
import type { StageBriefingVoice } from '../audio/stage-briefing-voice'
import type { NavigatorVoice } from '../audio/navigator-voice'

export type GameMode = 'start' | 'designer' | 'stage-intro' | 'combat' | 'results'

interface Deps {
  start: StartScreen
  stageIntro: StageIntroScreen
  results: ResultsScreen
  sound: SoundSystem
  input: InputAdapter
  briefingVoice: StageBriefingVoice
  navigator: NavigatorVoice
}

/**
 * Owns the game-mode state machine and screen attach/detach lifecycle.
 * Game simulation state (CombatState, RNG, selected loadout) stays in main.ts.
 */
export class ScreenManager {
  private _mode: GameMode
  private designerRoot: Root | null = null

  constructor(
    private readonly d: Deps,
    initialMode: GameMode = 'start',
  ) {
    this._mode = initialMode
  }

  get mode(): GameMode { return this._mode }

  toStart(bgmEnabled: boolean): void {
    this._mode = 'start'
    this.d.input.setSuspended(false)
    this.d.start.attach()
    this.d.briefingVoice.stop()
    this.d.sound.setBgmEnabled(bgmEnabled, 'title')
    this.d.sound.reset()
  }

  toStageIntro(stage: number, bgmEnabled: boolean): void {
    this._mode = 'stage-intro'
    this.d.input.setSuspended(false)
    this.d.start.detach()
    this.d.results.detach()
    this.d.stageIntro.attach()
    this.d.briefingVoice.play(stage)
    this.d.sound.setBgmEnabled(bgmEnabled, 'intro')
  }

  toCombat(bgmEnabled: boolean, isBoss: boolean): void {
    this._mode = 'combat'
    this.d.input.setSuspended(false)
    this.d.start.detach()
    this.d.stageIntro.detach()
    this.d.results.detach()
    this.d.briefingVoice.stop()
    this.d.sound.reset()
    this.d.sound.setBgmEnabled(bgmEnabled, isBoss ? 'boss' : 'normal')
    this.d.navigator.reset()
    this.d.navigator.announceCombatStart()
  }

  toResults(bgmEnabled: boolean): void {
    this._mode = 'results'
    this.d.input.setSuspended(false)
    this.d.briefingVoice.stop()
    this.d.sound.reset()
    this.d.sound.setBgmEnabled(bgmEnabled, 'results')
    this.d.results.attach()
  }

  openDesigner(
    onClose: () => void,
    onConfirm: (result: PrepResult) => void,
    initialResult?: PrepResult | null,
  ): void {
    const el = document.getElementById('designer-root')!
    el.style.display = 'block'
    this._mode = 'designer'
    this.d.start.detach()
    this.d.results.detach()
    this.d.stageIntro.detach()
    this.d.briefingVoice.stop()
    this.d.sound.setBgmEnabled(this.d.sound.isBgmEnabled(), 'prep')
    if (!this.designerRoot) this.designerRoot = createRoot(el)
    this.designerRoot.render(createElement(ShipDesigner, { onClose, onConfirm, initialResult }))
  }

  closeDesigner(restoreToStart = true): void {
    document.getElementById('designer-root')!.style.display = 'none'
    if (this.designerRoot) {
      this.designerRoot.unmount()
      this.designerRoot = null
    }
    if (restoreToStart && this._mode === 'designer') {
      this._mode = 'start'
      this.d.start.attach()
      this.d.sound.setBgmEnabled(this.d.sound.isBgmEnabled(), 'title')
    }
  }
}
