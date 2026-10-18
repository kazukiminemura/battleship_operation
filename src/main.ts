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
import { NavalAmbience } from './game/audio/naval-ambience'
import { CombatMusicDirector } from './game/audio/combat-music'
import { createAudioSettings } from './game/audio/audio-settings'
import { NavigatorVoice } from './game/audio/navigator-voice'
import { StageBriefingVoice } from './game/audio/stage-briefing-voice'
import { StartScreen } from './game/ui/startscreen'
import { StageIntroScreen } from './game/ui/stageintroscreen'
import { ResultsScreen } from './game/ui/resultsscreen'
import { ScreenManager } from './game/ui/screen-manager'
import type { WeaponTemplate } from './game/data/masterdata'
import { getDefaultLoadout } from './game/data/weapon-catalog'
import { isAccessKey } from './game/ui/accesskeys'
import { designLayoutFromHLG, type HLGDesign } from './designer/hlg-system'
import { HULL_CATALOG } from './game/data/hull-catalog'
import type { PrepResult } from './designer/types'
import {
  renderPauseOverlay,
  hitPauseRegion,
  pauseAccessKey,
  type PauseAction,
  type PauseRegion,
} from './game/ui/pause-overlay'
import {
  selectedWeapon,
  toggleWeaponAutoFire,
  toggleAutoPilot,
  toggleAllAutoFire,
} from './game/simulation/player-commands'

const BASE_SEED = 12345

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('canvas#game-canvas not found')

  const debugMapEnabled = new URLSearchParams(window.location.search).get('debug') === 'map'
  let debugMode = debugMapEnabled

  // ── Construct all subsystems ──────────────────────────────────────────────
  const renderer     = new CanvasRenderer(canvas)
  const hud          = new HUD(canvas)
  const start        = new StartScreen(canvas)
  const stageIntro   = new StageIntroScreen(canvas)
  const results      = new ResultsScreen(canvas)
  const sound        = new SoundSystem()
  const navigator    = new NavigatorVoice()
  const briefingVoice = new StageBriefingVoice()
  const musicDirector = new CombatMusicDirector()
  let ambience: NavalAmbience | null = null
  const audioSettings = createAudioSettings({
    onMusicVolume: volume => sound.setMusicVolume(volume),
    onEffectsVolume: volume => sound.setEffectsVolume(volume),
    onVoiceVolume: volume => { navigator.setVolume(volume); briefingVoice.setVolume(volume) },
  })
  document.body.append(audioSettings.element)
  // Media playback must be unlocked in a real user gesture, including after autoplay rejection.
  const unlockAudio = (): void => {
    sound.unlock()
    if (!ambience && typeof AudioContext !== 'undefined') {
      ambience = new NavalAmbience(sound.getAudioContext(), sound.getEffectsDestination())
    }
  }
  window.addEventListener('pointerdown', unlockAudio, { capture: true })
  window.addEventListener('keydown', unlockAudio, { capture: true })
  const input        = new InputAdapter(canvas, renderer, {
    onWeaponSelected: (weaponMode) => {
      const weapon = selectedWeapon(state, weaponMode)
      if (screens.mode === 'combat' && weapon) sound.playWeaponSelected(weapon.type)
    },
    onSpeedChanged: (direction) => {
      if (screens.mode === 'combat') sound.playSpeedChange(direction)
    },
    onZoomIn: () => {
      if (screens.mode === 'combat') renderer.setZoom(renderer.getZoom() + 0.1)
    },
    onZoomOut: () => {
      if (screens.mode === 'combat') renderer.setZoom(renderer.getZoom() - 0.1)
    },
  })

  // ── Game variables ────────────────────────────────────────────────────────
  let rng              = createRngStreams(BASE_SEED)
  let selectedShip: PlayerShipType = 'destroyer'
  let selectedTemplateId: string | undefined = undefined
  let selectedLoadout: WeaponTemplate[] = getDefaultLoadout('destroyer')
  let selectedArmorBonus = 0
  let selectedTowerMount: { x: number; y: number } | undefined
  let selectedFreeformDesign: HLGDesign | undefined
  let currentStage     = 1
  let normalShip: PlayerShipType = selectedShip
  let normalStage      = currentStage
  let bgmEnabled       = true
  let accessKeysVisible = false
  let paused           = false
  let pauseRegions: PauseRegion[] = []
  let state: CombatState = debugMode
    ? createDebugState('battleship')
    : createInitialState(selectedShip, currentStage)

  // ── Screen manager (owns mode state machine + screen lifecycle) ───────────
  const screens = new ScreenManager(
    { start, stageIntro, results, sound, input, briefingVoice, navigator },
    debugMode ? 'combat' : 'start',
  )

  if (!debugMode) {
    start.attach()
    sound.setBgmEnabled(bgmEnabled, 'title')
  } else {
    selectedShip = 'battleship'
    currentStage = state.stage
    rng = createRngStreams(BASE_SEED + 99099)
    sound.setBgmEnabled(bgmEnabled, 'cruise')
  }

  // ── Screen transition helpers (game-state concerns remain here) ───────────
  const openDesigner = (continueCurrentDesign = false): void => {
    navigator.reset()
    screens.openDesigner(
      () => screens.closeDesigner(true),
      (result) => {
        screens.closeDesigner(false)
        applyPrepResult(result)
        screens.toStageIntro(currentStage, bgmEnabled)
      },
      continueCurrentDesign ? currentPrepResult() : null,
    )
  }

  const goToStart = (): void => {
    paused = false
    navigator.reset()
    screens.toStart(bgmEnabled)
  }

  const beginCombat = (): void => {
    paused = false
    debugMode = false
    const designedHull = HULL_CATALOG.find(hull => hull.templateId === selectedTemplateId)
    const layout = selectedFreeformDesign && designedHull ? designLayoutFromHLG(designedHull, selectedFreeformDesign) : undefined
    state = createInitialState(selectedShip, currentStage, selectedLoadout, selectedTemplateId, selectedArmorBonus, selectedTowerMount, layout)
    rng = createRngStreams(BASE_SEED + currentStage * 1009)
    musicDirector.reset()
    screens.toCombat(bgmEnabled, false)
    sound.setBgmMode('cruise')
  }

  const beginDebugCombat = (): void => {
    paused = false
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
    musicDirector.reset()
    screens.toCombat(bgmEnabled, false)
    sound.setBgmMode('cruise')
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
    screens.toResults(bgmEnabled)
  }

  const applyResultAction = (action: 'next' | 'retry' | 'title' | null): void => {
    if (action === 'next') {
      currentStage++
      openDesigner(true)
    } else if (action === 'retry') {
      openDesigner(true)
    } else if (action === 'title') {
      goToStart()
    }
  }

  const applyPrepResult = (result: PrepResult): void => {
    selectedShip = result.shipType
    selectedTemplateId = result.templateId
    selectedLoadout = result.loadout
    selectedArmorBonus = result.armorBonus
    selectedTowerMount = result.towerMount
    selectedFreeformDesign = result.hlgDesign
  }

  const currentPrepResult = (): PrepResult | null => {
    if (!selectedTemplateId) return null
    return {
      templateId: selectedTemplateId,
      shipType: selectedShip,
      loadout: selectedLoadout,
      armorBonus: selectedArmorBonus,
      towerMount: selectedTowerMount,
      hlgDesign: selectedFreeformDesign,
    }
  }

  const applyHudAction = (id: string | null): boolean => {
    if (!id) return false
    if (id.startsWith('select:')) {
      input.selectWeaponMode(Number(id.slice(7)))
      return true
    }
    if (id.startsWith('command:')) {
      const action = id.slice(8)
      if (action === 'pause') togglePause()
      else if (action === 'sim') toggleDebugMap()
      else if (action === 'return') goToStart()
      else input.performControl(action)
      return true
    }
    if (id === 'toggle-autopilot') { state = toggleAutoPilot(state); return true }
    if (id === 'toggle-all')       { state = toggleAllAutoFire(state); return true }
    if (id === 'toggle-bgm')       { bgmEnabled = sound.toggleBgm(); return true }
    if (id.startsWith('toggle:')) {
      state = toggleWeaponAutoFire(state, Number(id.slice(7)))
      return true
    }
    return false
  }

  const togglePause = (): void => {
    if (screens.mode !== 'combat' || state.missionResult !== 'none') return
    paused = !paused
    input.setSuspended(paused)
  }

  const applyPauseAction = (action: PauseAction | null): void => {
    if (action === 'resume') { paused = false; input.setSuspended(false) }
    else if (action === 'title') { goToStart() }
  }

  // ── Keyboard input ────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.code === 'AltLeft' || e.code === 'AltRight') {
      accessKeysVisible = true
      e.preventDefault()
      return
    }

    if (document.hidden) return

    if (e.altKey) {
      accessKeysVisible = true

      if (screens.mode === 'start' && start.checkKeyDown(e)) {
        e.preventDefault()
        if (!e.repeat) openDesigner()
        return
      }

      if (screens.mode === 'stage-intro') {
        const action = stageIntro.checkKeyDown(e)
        if (action === 'sortie') {
          e.preventDefault()
          if (!e.repeat) beginCombat()
          return
        }
      }

      if (screens.mode === 'combat' && applyHudAction(hud.checkAccessKey(e))) {
        e.preventDefault()
        return
      }

      if (screens.mode === 'combat' && paused) {
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

      if (screens.mode === 'results') {
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

    if (screens.mode === 'combat' && !e.altKey && (e.code === 'KeyP' || e.code === 'Escape')) {
      e.preventDefault()
      if (!e.repeat) togglePause()
      return
    }

    if (screens.mode === 'start' && start.checkKeyDown(e)) {
      e.preventDefault()
      if (!e.repeat) openDesigner()
      return
    }

    if (screens.mode === 'stage-intro' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault()
      if (!e.repeat) beginCombat()
      return
    }

    if (screens.mode === 'results') {
      const action = results.checkKeyDown(e, state)
      if (
        action ||
        e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
        e.code === 'Tab'       || e.code === 'Enter'      ||
        e.code === 'Space'     || e.code === 'KeyN'       || e.code === 'KeyT'
      ) {
        e.preventDefault()
        if (!e.repeat) applyResultAction(action)
        return
      }
    }

    if (e.code === 'KeyR' && !e.altKey && (screens.mode === 'combat' || screens.mode === 'results')) {
      goToStart()
    }
  })

  window.addEventListener('keyup', (e) => {
    if (e.code === 'AltLeft' || e.code === 'AltRight') {
      accessKeysVisible = e.altKey
      e.preventDefault()
    }
  })

  // ── Mouse / click input ───────────────────────────────────────────────────
  canvas.addEventListener('click', (e) => {
    if (screens.mode === 'start') {
      if (start.checkClick(e)) openDesigner()
      e.stopImmediatePropagation()
      return
    }

    if (screens.mode === 'stage-intro') {
      const action = stageIntro.checkClick(e)
      if (action === 'sortie') beginCombat()
      e.stopImmediatePropagation()
      return
    }

    if (screens.mode === 'results') {
      applyResultAction(results.checkClick(e))
      e.stopImmediatePropagation()
      return
    }

    if (screens.mode === 'combat' && paused) {
      applyPauseAction(hitPauseRegion(canvas, pauseRegions, e))
      e.stopImmediatePropagation()
      return
    }

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    for (const region of hud.getClickRegions()) {
      if (cx >= region.x && cx <= region.x + region.w && cy >= region.y && cy <= region.y + region.h) {
        applyHudAction(region.id)
        e.stopImmediatePropagation()
        return
      }
    }
    // Non-interactive HUD space must not become a shot at the sea behind it.
    if (hud.containsPanel(cx, cy)) e.stopImmediatePropagation()
  }, true)

  // ── Game loop ─────────────────────────────────────────────────────────────
  const ticker = new FixedTicker({
    onTick: (tick) => {
      if (screens.mode !== 'combat') return
      if (paused || document.hidden) return
      if (state.missionResult !== 'none') return
      state = combatStep(state, input.pollCommands(tick), rng, STATIC_DATA)
      // Consume every tick, including the final mission event, before the next render.
      const listener = state.entities.get('ship.player')
      sound.processEvents(state.eventLog, state.tick, listener && isShip(listener) ? listener.pos : undefined)
      navigator.update(state)
      sound.setBgmMode(musicDirector.update(state))
    },
    onRender: (_alpha) => {
      const mode = screens.mode
      audioSettings.element.style.top = mode === 'combat' ? '146px' : '12px'
      const audioPaused = document.hidden || (mode === 'combat' && paused)
      sound.setPaused(audioPaused)
      navigator.setPaused(audioPaused)
      briefingVoice.setPaused(audioPaused)
      sound.setVoiceActive(navigator.isSpeaking || briefingVoice.isSpeaking)
      const audioPlayer = state.entities.get('ship.player')
      ambience?.update(audioPlayer && isShip(audioPlayer) ? audioPlayer : undefined, state.weather,
        mode === 'combat' && !audioPaused && state.missionResult === 'none')
      if (mode === 'start')   { start.render(accessKeysVisible); return }
      if (mode === 'designer') return
      if (mode === 'stage-intro') {
        stageIntro.render(STATIC_DATA.stages[currentStage - 1]!, selectedShip, accessKeysVisible)
        return
      }
      if (mode === 'results') { results.render(state, accessKeysVisible); return }

      // combat
      if (state.missionResult !== 'none') { enterResults(); return }

      const player = state.entities.get('ship.player')
      if (player && isShip(player) && !player.destroyed) renderer.setCamera(player.pos.x, player.pos.y)

      renderer.render(state, selectedWeapon(state, input.getWeaponMode()), input.getAimPoint())
      const playerShip = state.entities.get('ship.player')
      const autoPilotOn = (playerShip && isShip(playerShip) ? playerShip.autoPilot : false) ?? false

      if (paused) {
        hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled, '', accessKeysVisible, autoPilotOn)
        pauseRegions = renderPauseOverlay(canvas, accessKeysVisible)
        return
      }

      hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled, navigator.getSubtitle(), accessKeysVisible, autoPilotOn)
    },
  })

  // Browsers may stop rendering hidden tabs; silence immediately instead of waiting for a frame.
  document.addEventListener('visibilitychange', () => {
    const suspended = document.hidden || (screens.mode === 'combat' && paused)
    sound.setPaused(suspended)
    navigator.setPaused(suspended)
    briefingVoice.setPaused(suspended)
    input.setSuspended(suspended)
    if (document.hidden) ambience?.update(undefined, state.weather, false)
  })
  window.addEventListener('pagehide', () => {
    sound.setPaused(true)
    navigator.setPaused(true)
    briefingVoice.setPaused(true)
  })

  ticker.start()
}

main()
