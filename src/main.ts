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
import { StartScreen } from './game/ui/startscreen'
import { PrepScreen } from './game/ui/prepscreen'
import { StageIntroScreen } from './game/ui/stageintroscreen'
import { ResultsScreen } from './game/ui/resultsscreen'
import type { WeaponTemplate } from './game/data/masterdata'
import { getDefaultLoadout } from './game/data/weapon-catalog'

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
  let state: CombatState = debugMode
    ? createDebugState('battleship')
    : createInitialState(selectedShip, currentStage)

  if (!debugMode) {
    start.attach()
  } else {
    selectedShip = 'battleship'
    currentStage = state.stage
    rng = createRngStreams(BASE_SEED + 99099)
    sound.setBgmEnabled(bgmEnabled, isBossStage(state) ? 'boss' : 'normal')
  }

  const goToStart = (): void => {
    mode = 'start'
    start.attach()
    sound.setBgmEnabled(false)
    sound.reset()
  }

  const goToPrep = (stage: number): void => {
    currentStage = stage
    start.detach()
    results.detach()
    mode = 'prep'
    prep.attach(stage)
  }

  const goToStageIntro = (stage: number): void => {
    currentStage = stage
    prep.detach()
    results.detach()
    mode = 'stage-intro'
    stageIntro.attach()
  }

  const beginCombat = (): void => {
    debugMode = false
    state = createInitialState(selectedShip, currentStage, selectedLoadout, selectedTemplateId)
    rng = createRngStreams(BASE_SEED + currentStage * 1009)
    sound.reset()
    sound.setBgmEnabled(bgmEnabled, isBossStage(state) ? 'boss' : 'normal')
    mode = 'combat'
    stageIntro.detach()
  }

  const beginDebugCombat = (): void => {
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
    mode = 'results'
    sound.reset()
    results.attach()
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyD') {
      e.preventDefault()
      input.releaseKey('KeyD')
      if (!e.repeat) toggleDebugMap()
      return
    }

    if (e.code === 'KeyR' && (mode === 'combat' || mode === 'results')) {
      goToStart()
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
      if (action === 'next') {
        goToPrep(currentStage + 1)
      } else if (action === 'retry') {
        goToPrep(currentStage)
      } else if (action === 'title') {
        goToStart()
      }
      e.stopImmediatePropagation()
      return
    }

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    for (const region of hud.getClickRegions()) {
      if (cx >= region.x && cx <= region.x + region.w &&
          cy >= region.y && cy <= region.y + region.h) {
        if (region.id === 'toggle-all') {
          state = toggleAllAutoFire(state)
        } else if (region.id === 'toggle-bgm') {
          bgmEnabled = sound.toggleBgm()
        } else if (region.id.startsWith('toggle:')) {
          const slot = Number(region.id.slice(7))
          state = toggleWeaponAutoFire(state, slot)
        }
        e.stopImmediatePropagation()
        return
      }
    }
  }, true)

  const ticker = new FixedTicker({
    onTick: (tick) => {
      if (mode !== 'combat') return
      if (state.missionResult !== 'none') return
      sound.setBgmMode(isBossStage(state) ? 'boss' : 'normal')
      const commands = input.pollCommands(tick)
      state = combatStep(state, commands, rng, STATIC_DATA)
    },
    onRender: (_alpha) => {
      if (mode === 'start') { start.render(); return }
      if (mode === 'prep') { prep.render(); return }
      if (mode === 'stage-intro') {
        const stageDef = STATIC_DATA.stages[currentStage - 1]!
        stageIntro.render(stageDef, selectedShip)
        return
      }
      if (mode === 'results') { results.render(state); return }

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
      hud.render(state, input.getWeaponMode(), WORLD_SIZE, bgmEnabled)
      sound.processEvents(state.eventLog, state.tick)
    },
  })

  ticker.start()
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
