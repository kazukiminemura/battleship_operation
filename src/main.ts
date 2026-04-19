import { CanvasRenderer } from './game/rendering/canvas'
import { HUD } from './game/ui/hud'
import { InputAdapter } from './game/input/adapter'
import { FixedTicker } from './game/simulation/ticker'
import { combatStep } from './game/simulation/combat'
import { createRngStreams } from './game/simulation/random'
import { createInitialState, STATIC_DATA, type PlayerShipType } from './game/data/masterdata'
import type { CombatState, ShipEntity, WeaponType } from './game/simulation/types'
import { WORLD_SIZE } from './game/simulation/movement'
import { SoundSystem } from './game/audio/sounds'
import { StartScreen } from './game/ui/startscreen'

const BASE_SEED = 12345
type GameMode = 'start' | 'combat'

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  if (!canvas) throw new Error('canvas#game-canvas not found')

  const renderer = new CanvasRenderer(canvas)
  const hud      = new HUD(canvas)
  const input    = new InputAdapter(canvas, renderer)
  const start    = new StartScreen(canvas)
  let rng        = createRngStreams(BASE_SEED)
  const sound    = new SoundSystem()

  let mode: GameMode = 'start'
  let selectedShip: PlayerShipType = 'destroyer'
  let state: CombatState = createInitialState(selectedShip)
  start.attach()

  const beginCombat = (shipType: PlayerShipType): void => {
    selectedShip = shipType
    state = createInitialState(selectedShip)
    rng = createRngStreams(BASE_SEED)
    sound.reset()
    mode = 'combat'
    start.detach()
  }

  const returnToStart = (): void => {
    mode = 'start'
    start.attach()
    sound.reset()
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && mode === 'combat') {
      returnToStart()
    }
  })

  // Start screen and HUD click regions (capture phase, before fire-weapon handler)
  canvas.addEventListener('click', (e) => {
    if (mode === 'start') {
      const shipType = start.checkClick(e)
      if (shipType) beginCombat(shipType)
      e.stopPropagation()
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
        } else if (region.id.startsWith('toggle:')) {
          const wType = region.id.slice(7) as WeaponType
          state = toggleWeaponAutoFire(state, wType)
        }
        e.stopPropagation()
        return
      }
    }
  }, true)

  const ticker = new FixedTicker({
    onTick: (tick) => {
      if (mode !== 'combat') return
      if (state.missionResult !== 'none') return
      const commands = input.pollCommands(tick)
      state = combatStep(state, commands, rng, STATIC_DATA)
    },
    onRender: (_alpha) => {
      if (mode === 'start') {
        start.render()
        return
      }

      // Camera follows player
      const player = state.entities.get('ship.player')
      if (player && player.kind === 'ship' && !player.destroyed) {
        renderer.setCamera((player as ShipEntity).pos.x, (player as ShipEntity).pos.y)
      }

      renderer.render(state, input.getWeaponMode())
      hud.render(state, input.getWeaponMode(), WORLD_SIZE)
      sound.processEvents(state.eventLog, state.tick)
    },
  })

  ticker.start()
}

function toggleWeaponAutoFire(state: CombatState, weaponType: WeaponType): CombatState {
  const player = state.entities.get('ship.player')
  if (!player || player.kind !== 'ship') return state
  const ship = player as ShipEntity
  const weapons = ship.weapons.map(w =>
    w.type === weaponType ? { ...w, autoFire: !w.autoFire } : w
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
