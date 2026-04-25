import { CanvasRenderer } from './game/rendering/canvas'
import { HUD } from './game/ui/hud'
import { InputAdapter } from './game/input/adapter'
import { FixedTicker } from './game/simulation/ticker'
import { combatStep } from './game/simulation/combat'
import { createRngStreams } from './game/simulation/random'
import { createDebugState, createInitialState, STATIC_DATA, type PlayerShipType } from './game/data/masterdata'
import { isShip, type CombatState } from './game/simulation/types'
import { WORLD_SIZE } from './game/simulation/movement'
import { SoundSystem } from './game/audio/sounds'
import { NavigatorVoice } from './game/audio/navigator-voice'
import { StageBriefingVoice } from './game/audio/stage-briefing-voice'
import { StartScreen } from './game/ui/startscreen'
import { PrepScreen, type PrepAudioCue, type PrepResult } from './game/ui/prepscreen'
import { StageIntroScreen } from './game/ui/stageintroscreen'
import { ResultsScreen } from './game/ui/resultsscreen'
import type { WeaponTemplate } from './game/data/masterdata'
import { getDefaultLoadout } from './game/data/weapon-catalog'
import { isAccessKey } from './game/ui/accesskeys'
import {
  renderPauseOverlay,
  hitPauseRegion,
  pauseAccessKey,
  type PauseAction,
  type PauseRegion,
} from './game/ui/pause-overlay'
import {
  selectedWeapon,
  isBossStage,
  toggleWeaponAutoFire,
  toggleAutoPilot,
  toggleAllAutoFire,
} from './game/simulation/player-commands'

const BASE_SEED = 12345
type GameMode = 'start' | 'prep' | 'stage-intro' | 'combat' | 'results'

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('canvas#game-canvas not found')

  const debugMapEnabled = new URLSearchParams(window.location.search).get('debug') === 'map'
  let debugMode = debugMapEnabled
  let mode: GameMode = debugMode ? 'combat' : 'start'
  const renderer = new CanvasRenderer(canvas)
  const hud      = new HUD(canvas)
  const start    = new StartScreen(canvas)
  const prep     = new PrepScreen(canvas)
  const stageIntro = new StageIntroScreen(canvas)
  const results  = new ResultsScreen(canvas)
  const sound    = new SoundSystem()
  const navigator = new NavigatorVoice()
  const briefingVoice = new StageBriefingVoice()
  const input    = new InputAdapter(canvas, renderer, {
    onWeaponSelected: (weaponMode) => {
      const weapon = selectedWeapon(state, weaponMode)
      if (mode === 'combat' && weapon) sound.playWeaponSelected(weapon.type)
    },
    onSpeedChanged: (direction) => {
      if (mode === 'combat') sound.playSpeedChange(direction)
    },
    onZoomIn: () => {
      if (mode === 'combat') {
        const currentZoom = renderer.getZoom()
        renderer.setZoom(currentZoom + 0.1)
      }
    },
    onZoomOut: () => {
      if (mode === 'combat') {
        const currentZoom = renderer.getZoom()
        renderer.setZoom(currentZoom - 0.1)
      }
    },
  })
  let rng = createRngStreams(BASE_SEED)

  let selectedShip: PlayerShipType = 'destroyer'
  let selectedTemplateId: string | undefined = undefined
  let selectedLoadout: WeaponTemplate[] = getDefaultLoadout('destroyer')
  let selectedArmorBonus = 0
  let selectedDesign: PrepResult | null = null
  let currentStage = 1
  let normalShip: PlayerShipType = selectedShip
  let normalStage = currentStage
  let bgmEnabled = true
  let accessKeysVisible = false
  let paused = false
  let pauseRegions: PauseRegion[] = []
  let state: CombatState = debugMode
    ? createDebugState('battleship')
    : createInitialState(selectedShip, currentStage)

  if (!debugMode) {
    start.attach()
    sound.setBgmEnabled(bgmEnabled, 'title')
  } else {
    selectedShip = 'battleship'
    currentStage = state.stage
    rng = createRngStreams(BASE_SEED + 99099)
    sound.setBgmEnabled(bgmEnabled, isBossStage(state) ? 'boss' : 'normal')
  }

  const goToStart = (): void => {
    paused = false
    input.setSuspended(false)
    mode = 'start'
    start.attach()
    briefingVoice.stop()
    sound.setBgmEnabled(bgmEnabled, 'title')
    sound.reset()
  }

  const goToPrep = (stage: number): void => {
    paused = false
    input.setSuspended(false)
    currentStage = stage
    start.detach()
    results.detach()
    briefingVoice.stop()
    mode = 'prep'
    prep.attach(stage, selectedDesign)
    sound.setBgmEnabled(bgmEnabled, 'prep')
  }

  const goToStageIntro = (stage: number): void => {
    paused = false
    input.setSuspended(false)
    currentStage = stage
    prep.detach()
    results.detach()
    mode = 'stage-intro'
    stageIntro.attach()
    briefingVoice.play(stage)
    sound.setBgmEnabled(bgmEnabled, 'intro')
  }

  const beginCombat = (): void => {
    paused = false
    input.setSuspended(false)
    debugMode = false
    state = createInitialState(selectedShip, currentStage, selectedLoadout, selectedTemplateId, selectedArmorBonus)
    rng = createRngStreams(BASE_SEED + currentStage * 1009)
    sound.reset()
    sound.setBgmEnabled(bgmEnabled, isBossStage(state) ? 'boss' : 'normal')
    navigator.reset()
    navigator.announceCombatStart()
    mode = 'combat'
    briefingVoice.stop()
    stageIntro.detach()
  }

  const beginDebugCombat = (): void => {
    paused = false
    input.setSuspended(false)
    if (!debugMode) {
      normalShip = selectedShip
      normalStage = currentStage >= 1 && currentStage <= STATIC_DATA.stages.length ? currentStage : 1
    }
    debugMode = true
    selectedShip = 'battleship'
    selectedLoadout = getDefaultLoadout('battleship')
    state = createDebugState(selectedShip)
    currentStage = state.stage
    rng = createRngStreams(BASE_SEED + 99099)
    sound.reset()
    sound.setBgmEnabled(bgmEnabled, isBossStage(state) ? 'boss' : 'normal')
    navigator.reset()
    navigator.announceCombatStart()
    mode = 'combat'
    start.detach()
    prep.detach()
    stageIntro.detach()
    results.detach()
    briefingVoice.stop()
  }

  const toggleDebugMap = (): void => {
    if (debugMode) {
      selectedShip = normalShip
      currentStage = normalStage
      goToStart()
    } else {
      beginDebugCombat()
    }
  }

  const enterResults = (): void => {
    paused = false
    input.setSuspended(false)
    mode = 'results'
    briefingVoice.stop()
    sound.reset()
    sound.setBgmEnabled(bgmEnabled, 'results')
    results.attach()
  }

  const applyResultAction = (action: 'next' | 'retry' | 'title' | null): void => {
    if (action === 'next') {
      goToPrep(currentStage + 1)
    } else if (action === 'retry') {
      goToPrep(currentStage)
    } else if (action === 'title') {
      goToStart()
    }
  }

  const playPrepAudioCue = (cue: PrepAudioCue | null): void => {
    if (cue === 'select') sound.playDesignSelect()
    else if (cue === 'place') sound.playDesignPlace()
    else if (cue === 'equip') sound.playDesignEquip()
    else if (cue === 'back') sound.playDesignBack()
    else if (cue === 'confirm') sound.playDesignConfirm()
    else if (cue === 'denied') sound.playDesignDenied()
  }

  const applyPrepResult = (result: PrepResult): void => {
    selectedShip = result.shipType
    selectedTemplateId = result.templateId
    selectedLoadout = result.loadout
    selectedArmorBonus = result.armorBonus
    selectedDesign = result
  }

  const applyHudAction = (id: string | null): boolean => {
    if (!id) return false
    if (id === 'toggle-autopilot') {
      state = toggleAutoPilot(state)
      return true
    }
    if (id === 'toggle-all') {
      state = toggleAllAutoFire(state)
      return true
    }
    if (id === 'toggle-bgm') {
      bgmEnabled = sound.toggleBgm()
      return true
    }
    if (id.startsWith('toggle:')) {
      const slot = Number(id.slice(7))
      state = toggleWeaponAutoFire(state, slot)
      return true
    }
    return false
  }

  const togglePause = (): void => {
    if (mode !== 'combat' || state.missionResult !== 'none') return
    paused = !paused
    input.setSuspended(paused)
  }

  const applyPauseAction = (action: PauseAction | null): void => {
    if (action === 'resume') {
      paused = false
      input.setSuspended(false)
    } else if (action === 'title') {
      goToStart()
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'AltLeft' || e.code === 'AltRight') {
      accessKeysVisible = true
      e.preventDefault()
      return
    }

    if (e.altKey) {
      accessKeysVisible = true

      if (mode === 'start' && start.checkKeyDown(e)) {
        e.preventDefault()
        if (!e.repeat) goToPrep(currentStage)
        return
      }

      if (mode === 'prep') {
        const result = prep.checkKeyDown(e)
        const cue = prep.consumeAudioCue()
        playPrepAudioCue(cue)
        if (result) {
          applyPrepResult(result)
          goToStageIntro(currentStage)
        }
        if (cue || result) {
          e.preventDefault()
          return
        }
      }

      if (mode === 'stage-intro') {
        const action = stageIntro.checkKeyDown(e)
        if (action === 'sortie') {
          e.preventDefault()
          if (!e.repeat) beginCombat()
          return
        }
      }

      if (mode === 'combat' && applyHudAction(hud.checkAccessKey(e))) {
        e.preventDefault()
        return
      }

      if (mode === 'combat' && paused) {
        if (isAccessKey(e, pauseAccessKey('resume'))) {
          e.preventDefault()
          if (!e.repeat) applyPauseAction('resume')
          return
        }
        if (isAccessKey(e, pauseAccessKey('title'))) {
          e.preventDefault()
          if (!e.repeat) applyPauseAction('title')
          return
        }
      }

      if (mode === 'results') {
        const action = results.checkKeyDown(e, state)
        if (action) {
          e.preventDefault()
          if (!e.repeat) applyResultAction(action)
          return
        }
      }
    }

    if (e.code === 'KeyD' && !e.altKey) {
      e.preventDefault()
      input.releaseKey('KeyD')
      if (!e.repeat) toggleDebugMap()
      return
    }

    if (mode === 'combat' && !e.altKey && (e.code === 'KeyP' || e.code === 'Escape')) {
      e.preventDefault()
      if (!e.repeat) togglePause()
      return
    }

    if (mode === 'start' && start.checkKeyDown(e)) {
      e.preventDefault()
      if (!e.repeat) goToPrep(currentStage)
      return
    }

    if (mode === 'prep') {
      const result = prep.checkKeyDown(e)
      playPrepAudioCue(prep.consumeAudioCue())
      if (result) {
        e.preventDefault()
        if (!e.repeat) {
          applyPrepResult(result)
          goToStageIntro(currentStage)
        }
        return
      }
    }

    if (mode === 'stage-intro' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault()
      if (!e.repeat) beginCombat()
      return
    }

    if (mode === 'results') {
      const action = results.checkKeyDown(e, state)
      if (
        action ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Tab' ||
        e.code === 'Enter' ||
        e.code === 'Space' ||
        e.code === 'KeyN' ||
        e.code === 'KeyT'
      ) {
        e.preventDefault()
        if (!e.repeat) applyResultAction(action)
        return
      }
    }

    if (e.code === 'KeyR' && !e.altKey && (mode === 'combat' || mode === 'results')) {
      goToStart()
    }
  })

  window.addEventListener('keyup', (e) => {
    if (e.code === 'AltLeft' || e.code === 'AltRight') {
      accessKeysVisible = e.altKey
      e.preventDefault()
    }
  })

  canvas.addEventListener('click', (e) => {
    if (mode === 'start') {
      if (start.checkClick(e)) goToPrep(currentStage)
      e.stopImmediatePropagation()
      return
    }

    if (mode === 'prep') {
      const result = prep.checkClick(e)
      playPrepAudioCue(prep.consumeAudioCue())
      if (result) {
        applyPrepResult(result)
        goToStageIntro(currentStage)
      }
      e.stopImmediatePropagation()
      return
    }

    if (mode === 'stage-intro') {
      const action = stageIntro.checkClick(e)
      if (action === 'sortie') beginCombat()
      e.stopImmediatePropagation()
      return
    }

    if (mode === 'results') {
      const action = results.checkClick(e)
      applyResultAction(action)
      e.stopImmediatePropagation()
      return
    }

    if (mode === 'combat' && paused) {
      const action = hitPauseRegion(canvas, pauseRegions, e)
      applyPauseAction(action)
      e.stopImmediatePropagation()
      return
    }

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    for (const region of hud.getClickRegions()) {
      if (cx >= region.x && cx <= region.x + region.w &&
          cy >= region.y && cy <= region.y + region.h) {
        applyHudAction(region.id)
        e.stopImmediatePropagation()
        return
      }
    }
  }, true)

  const ticker = new FixedTicker({
    onTick: (tick) => {
      if (mode !== 'combat') return
      if (paused) return
      if (state.missionResult !== 'none') return
      sound.setBgmMode(isBossStage(state) ? 'boss' : 'normal')
      const commands = input.pollCommands(tick)
      state = combatStep(state, commands, rng, STATIC_DATA)
    },
    onRender: (_alpha) => {
      if (mode === 'start') { start.render(accessKeysVisible); return }
      if (mode === 'prep') { prep.render(accessKeysVisible); return }
      if (mode === 'stage-intro') {
        const stageDef = STATIC_DATA.stages[currentStage - 1]!
        stageIntro.render(stageDef, selectedShip, accessKeysVisible)
        return
      }
      if (mode === 'results') { results.render(state, accessKeysVisible); return }

      // combat
      if (state.missionResult !== 'none') {
        enterResults()
        return
      }

      const player = state.entities.get('ship.player')
      if (player && isShip(player) && !player.destroyed) {
        renderer.setCamera(player.pos.x, player.pos.y)
      }

      renderer.render(state, selectedWeapon(state, input.getWeaponMode()), input.getAimPoint())
      const playerShip = state.entities.get('ship.player')
      const autoPilotOn = (playerShip && isShip(playerShip) ? playerShip.autoPilot : false) ?? false
      if (paused) {
        hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled, '', accessKeysVisible, autoPilotOn)
        pauseRegions = renderPauseOverlay(canvas, accessKeysVisible)
        return
      }

      navigator.update(state)
      hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled, navigator.getSubtitle(), accessKeysVisible, autoPilotOn)
      sound.processEvents(state.eventLog, state.tick)
    },
  })

  ticker.start()
}

main()
