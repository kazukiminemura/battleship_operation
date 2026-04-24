import { CanvasRenderer } from './game/rendering/canvas'
import { HUD } from './game/ui/hud'
import { InputAdapter } from './game/input/adapter'
import { FixedTicker } from './game/simulation/ticker'
import { combatStep } from './game/simulation/combat'
import { createRngStreams } from './game/simulation/random'
import { createDebugState, createInitialState, STATIC_DATA, type PlayerShipType } from './game/data/masterdata'
import type { CombatState, ShipEntity, WeaponState } from './game/simulation/types'
import { WORLD_SIZE } from './game/simulation/movement'
import { SoundSystem } from './game/audio/sounds'
import { NavigatorVoice } from './game/audio/navigator-voice'
import { StartScreen } from './game/ui/startscreen'
import { PrepScreen, type PrepAudioCue } from './game/ui/prepscreen'
import { StageIntroScreen } from './game/ui/stageintroscreen'
import { ResultsScreen } from './game/ui/resultsscreen'
import type { WeaponTemplate } from './game/data/masterdata'
import { getDefaultLoadout } from './game/data/weapon-catalog'
import { drawAccessKeyHint, isAccessKey } from './game/ui/accesskeys'

const BASE_SEED = 12345
type GameMode = 'start' | 'prep' | 'stage-intro' | 'combat' | 'results'
type PauseAction = 'resume' | 'title'
interface PauseRegion { id: PauseAction; x: number; y: number; w: number; h: number }

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
  const input    = new InputAdapter(canvas, renderer, {
    onWeaponSelected: (weaponMode) => {
      const weapon = selectedWeapon(state, weaponMode)
      if (mode === 'combat' && weapon) sound.playWeaponSelected(weapon.type)
    },
    onSpeedChanged: (direction) => {
      if (mode === 'combat') sound.playSpeedChange(direction)
    },
  })
  let rng = createRngStreams(BASE_SEED)

  let selectedShip: PlayerShipType = 'destroyer'
  let selectedTemplateId: string | undefined = undefined
  let selectedLoadout: WeaponTemplate[] = getDefaultLoadout('destroyer')
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
    sound.setBgmEnabled(bgmEnabled, 'title')
    sound.reset()
  }

  const goToPrep = (stage: number): void => {
    paused = false
    input.setSuspended(false)
    currentStage = stage
    start.detach()
    results.detach()
    mode = 'prep'
    prep.attach(stage)
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
    sound.setBgmEnabled(bgmEnabled, 'intro')
  }

  const beginCombat = (): void => {
    paused = false
    input.setSuspended(false)
    debugMode = false
    state = createInitialState(selectedShip, currentStage, selectedLoadout, selectedTemplateId)
    rng = createRngStreams(BASE_SEED + currentStage * 1009)
    sound.reset()
    sound.setBgmEnabled(bgmEnabled, isBossStage(state) ? 'boss' : 'normal')
    navigator.reset()
    navigator.announceCombatStart()
    mode = 'combat'
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

  const applyHudAction = (id: string | null): boolean => {
    if (!id) return false
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
          selectedShip = result.shipType
          selectedTemplateId = result.templateId
          selectedLoadout = result.loadout
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
        if (isAccessKey(e, 'P')) {
          e.preventDefault()
          if (!e.repeat) applyPauseAction('resume')
          return
        }
        if (isAccessKey(e, 'T')) {
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
          selectedShip = result.shipType
          selectedTemplateId = result.templateId
          selectedLoadout = result.loadout
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
        selectedShip = result.shipType
        selectedTemplateId = result.templateId
        selectedLoadout = result.loadout
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
      if (player && player.kind === 'ship' && !player.destroyed) {
        renderer.setCamera((player as ShipEntity).pos.x, (player as ShipEntity).pos.y)
      }

      renderer.render(state, selectedWeapon(state, input.getWeaponMode()), input.getAimPoint())
      if (paused) {
        hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled, '', accessKeysVisible)
        pauseRegions = renderPauseOverlay(canvas, accessKeysVisible)
        return
      }

      navigator.update(state)
      hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled, navigator.getSubtitle(), accessKeysVisible)
      sound.processEvents(state.eventLog, state.tick)
    },
  })

  ticker.start()
}

function hitPauseRegion(canvas: HTMLCanvasElement, regions: PauseRegion[], e: MouseEvent): PauseAction | null {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  for (const r of regions) {
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r.id
  }
  return null
}

function renderPauseOverlay(canvas: HTMLCanvasElement, showAccessKeys: boolean): PauseRegion[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const cy = H / 2
  const panelW = Math.min(520, W * 0.48)
  const panelH = Math.min(300, H * 0.42)
  const panelX = cx - panelW / 2
  const panelY = cy - panelH / 2

  ctx.save()
  ctx.fillStyle = 'rgba(2,8,14,0.58)'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(10,24,46,0.94)'
  roundRect(ctx, panelX, panelY, panelW, panelH, 12)
  ctx.fill()
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  roundRect(ctx, panelX, panelY, panelW, panelH, 12)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#7dd3fc'
  ctx.font = `bold ${Math.round(panelH * 0.18)}px sans-serif`
  ctx.fillText('PAUSED', cx, panelY + panelH * 0.26)

  ctx.fillStyle = '#94a3b8'
  ctx.font = `${Math.round(panelH * 0.072)}px sans-serif`
  ctx.fillText('戦闘を一時停止中', cx, panelY + panelH * 0.39)

  const btnW = panelW * 0.36
  const btnH = panelH * 0.18
  const gap = panelW * 0.06
  const btnY = panelY + panelH * 0.64
  const resumeX = cx - btnW - gap / 2
  const titleX = cx + gap / 2

  drawPauseButton(ctx, resumeX, btnY, btnW, btnH, '再開', '#22c55e')
  drawPauseButton(ctx, titleX, btnY, btnW, btnH, 'タイトルへ', '#475569')
  if (showAccessKeys) {
    drawAccessKeyHint(ctx, 'P', resumeX + 8, btnY + 8)
    drawAccessKeyHint(ctx, 'T', titleX + 8, btnY + 8)
  }

  ctx.fillStyle = '#64748b'
  ctx.font = `${Math.round(panelH * 0.052)}px sans-serif`
  ctx.fillText('P / Esc で再開', cx, panelY + panelH * 0.90)
  ctx.restore()

  return [
    { id: 'resume', x: resumeX, y: btnY, w: btnW, h: btnH },
    { id: 'title', x: titleX, y: btnY, w: btnW, h: btnH },
  ]
}

function drawPauseButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, color: string): void {
  ctx.fillStyle = `${color}30`
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 8)
  ctx.stroke()
  ctx.fillStyle = '#f8fafc'
  ctx.textAlign = 'center'
  ctx.font = `bold ${Math.round(h * 0.45)}px sans-serif`
  ctx.fillText(label, x + w / 2, y + h * 0.65)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function selectedWeapon(state: CombatState, weaponSlot: number): WeaponState | undefined {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return undefined
  return (player as ShipEntity).weapons[weaponSlot]
}

function isBossStage(state: CombatState): boolean {
  return [...state.entities.values()].some(entity =>
    entity.kind === 'ship' &&
    !entity.destroyed &&
    (entity as ShipEntity).templateId === 'hull.enemy.boss.dreadnought'
  )
}

function toggleWeaponAutoFire(state: CombatState, weaponSlot: number): CombatState {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return state
  const ship = player as ShipEntity
  const weapons = ship.weapons.map((w, i) =>
    i === weaponSlot ? { ...w, autoFire: !w.autoFire } : w
  )
  const entities = new Map(state.entities)
  entities.set('ship.player', { ...ship, weapons })
  return { ...state, entities }
}

function toggleAllAutoFire(state: CombatState): CombatState {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return state
  const ship = player as ShipEntity
  const allAuto = ship.weapons.every(w => w.autoFire)
  const weapons = ship.weapons.map(w => ({ ...w, autoFire: !allAuto }))
  const entities = new Map(state.entities)
  entities.set('ship.player', { ...ship, weapons })
  return { ...state, entities }
}

main()
