import { MAX_WEAPON_SLOTS, type Command, type Vec3 } from '../simulation/types'
import type { WeaponMode } from '../ui/hud'
import type { CanvasRenderer } from '../rendering/canvas'

export interface InputFeedback {
  onWeaponSelected?: (weaponMode: WeaponMode) => void
  onSpeedChanged?: (direction: 'up' | 'down') => void
}

export class InputAdapter {
  private commands: Command[] = []
  private keys = new Set<string>()
  private weaponMode: WeaponMode = 0
  private aimPoint: Vec3 | null = null
  private canvas: HTMLCanvasElement
  private renderer: CanvasRenderer
  private feedback: InputFeedback

  constructor(canvas: HTMLCanvasElement, renderer: CanvasRenderer, feedback: InputFeedback = {}) {
    this.canvas = canvas
    this.renderer = renderer
    this.feedback = feedback
    this.bindEvents()
  }

  getWeaponMode(): WeaponMode {
    return this.weaponMode
  }

  getAimPoint(): Vec3 | null {
    return this.aimPoint ? { ...this.aimPoint } : null
  }

  releaseKey(code: string): void {
    this.keys.delete(code)
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)

      if (e.code.startsWith('Digit')) {
        const slot = Number(e.code.slice(5)) - 1
        if (slot >= 0 && slot < MAX_WEAPON_SLOTS) this.selectWeaponMode(slot)
      }

      if (!e.repeat) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.commands.push({ tick: 0, actorId: 'ship.player', type: 'speed.up' })
          this.feedback.onSpeedChanged?.('up')
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.commands.push({ tick: 0, actorId: 'ship.player', type: 'speed.down' })
          this.feedback.onSpeedChanged?.('down')
        }
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const [wx, wy] = this.renderer.s2w(cx, cy)
      this.aimPoint = { x: wx, y: wy, z: 0 }
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.aimPoint = null
    })

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      // use isometric inverse transform from renderer
      const [wx, wy] = this.renderer.s2w(cx, cy)
      const target: Vec3 = { x: wx, y: wy, z: 0 }

      this.commands.push({ tick: 0, actorId: 'ship.player', type: 'fire.slot', value: this.weaponMode, target })
    })
  }

  private selectWeaponMode(weaponMode: WeaponMode): void {
    if (this.weaponMode === weaponMode) return
    this.weaponMode = weaponMode
    this.feedback.onWeaponSelected?.(weaponMode)
  }

  pollCommands(tick: number): Command[] {
    const cmds: Command[] = []

    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) {
      cmds.push({ tick, actorId: 'ship.player', type: 'rotate', value: -0.04 })
    }
    if (this.keys.has('ArrowRight') || this.keys.has('KeyE')) {
      cmds.push({ tick, actorId: 'ship.player', type: 'rotate', value: 0.04 })
    }

    const queued = this.commands.splice(0)
    for (const cmd of queued) cmds.push({ ...cmd, tick })

    return cmds
  }
}
