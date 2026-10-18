import { MAX_WEAPON_SLOTS, type Command, type Vec3 } from '../simulation/types'
import type { WeaponMode } from '../ui/hud'
import type { CanvasRenderer } from '../rendering/canvas'

export interface InputFeedback {
  onWeaponSelected?: (weaponMode: WeaponMode) => void
  onSpeedChanged?: (direction: 'up' | 'down') => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  canFireAt?: (x: number, y: number) => boolean
}

export class InputAdapter {
  private commands: Command[] = []
  private keys = new Set<string>()
  private weaponMode: WeaponMode = 0
  private aimPoint: Vec3 | null = null
  private canvas: HTMLCanvasElement
  private renderer: CanvasRenderer
  private feedback: InputFeedback
  private suspended = false
  private fireHeld = false
  private pointer: { x: number; y: number } | null = null

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

  setSuspended(suspended: boolean): void {
    this.suspended = suspended
    if (suspended) {
      this.keys.clear()
      this.commands = []
      this.fireHeld = false
    }
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (this.suspended) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      this.keys.add(e.code)
      if (e.code.startsWith('Arrow')) e.preventDefault()

      if (e.code.startsWith('Digit')) {
        const slot = Number(e.code.slice(5)) - 1
        if (slot >= 0 && slot < MAX_WEAPON_SLOTS) this.selectWeaponMode(slot)
      }

      if (!e.repeat) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyE') {
          // Preserve even a tap that starts and ends between simulation ticks.
          const left = e.code === 'ArrowLeft' || e.code === 'KeyA'
          this.commands.push({ tick: 0, actorId: 'ship.player', type: 'rotate', value: left ? -0.04 : 0.04 })
        }
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.commands.push({ tick: 0, actorId: 'ship.player', type: 'speed.up' })
          this.feedback.onSpeedChanged?.('up')
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.commands.push({ tick: 0, actorId: 'ship.player', type: 'speed.down' })
          this.feedback.onSpeedChanged?.('down')
        } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
          // Zoom in: + key or numpad +
          this.feedback.onZoomIn?.()
        } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
          // Zoom out: - key or numpad -
          this.feedback.onZoomOut?.()
        }
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.commands = []
      this.fireHeld = false
      this.pointer = null
      this.aimPoint = null
    })

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.isPrimary === false) return
      this.pointer = { x: e.clientX, y: e.clientY }
      this.updateAim()
    })

    this.canvas.addEventListener('pointerleave', () => {
      this.aimPoint = null
      this.pointer = null
      this.fireHeld = false
    })

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.suspended || e.button !== 0 || e.isPrimary === false) return
      this.pointer = { x: e.clientX, y: e.clientY }
      this.updateAim()
      if (!this.aimPoint) return
      this.fireHeld = true
      // Preserve a brief tap between simulation ticks.
      this.queueShot()
    })
    window.addEventListener('pointerup', (e) => { if (e.button === 0 && e.isPrimary !== false) this.fireHeld = false })
    window.addEventListener('pointercancel', () => {
      this.fireHeld = false
      this.commands = this.commands.filter(command => command.type !== 'fire.slot')
    })
    this.canvas.addEventListener('click', (e) => {
      // Pointer gestures are handled above; keep assistive/synthetic clicks.
      if (this.suspended || e.detail !== 0) return
      this.pointer = { x: e.clientX, y: e.clientY }
      this.updateAim()
      this.queueShot()
    })
  }

  private updateAim(): void {
    if (!this.pointer) return
    const rect = this.canvas.getBoundingClientRect()
    const x = this.pointer.x - rect.left, y = this.pointer.y - rect.top
    if (this.feedback.canFireAt && !this.feedback.canFireAt(x, y)) { this.aimPoint = null; return }
    const [wx, wy] = this.renderer.s2w(x, y)
    this.aimPoint = { x: wx, y: wy, z: 0 }
  }

  private queueShot(): void {
    if (this.aimPoint) this.commands.push({ tick: 0, actorId: 'ship.player', type: 'fire.slot', value: this.weaponMode, target: { ...this.aimPoint } })
  }

  selectWeaponMode(weaponMode: WeaponMode): void {
    if (weaponMode < 0 || weaponMode >= MAX_WEAPON_SLOTS) return
    if (this.weaponMode === weaponMode) return
    this.weaponMode = weaponMode
    this.feedback.onWeaponSelected?.(weaponMode)
  }

  performControl(action: string): void {
    if (this.suspended) return
    if (action === 'speed.up' || action === 'speed.down') {
      this.commands.push({ tick: 0, actorId: 'ship.player', type: action })
      this.feedback.onSpeedChanged?.(action === 'speed.up' ? 'up' : 'down')
    } else if (action === 'turn.left' || action === 'turn.right') {
      this.commands.push({ tick: 0, actorId: 'ship.player', type: 'rotate', value: action === 'turn.left' ? -0.12 : 0.12 })
    } else if (action === 'weapon.next') {
      this.selectWeaponMode((this.weaponMode + 1) % MAX_WEAPON_SLOTS)
    }
  }

  pollCommands(tick: number): Command[] {
    if (this.suspended) return []
    // Reproject a stationary pointer as the camera follows the moving ship.
    this.updateAim()
    if (this.fireHeld && !this.commands.some(c => c.type === 'fire.slot')) this.queueShot()
    const cmds: Command[] = []

    if ((this.keys.has('ArrowLeft') || this.keys.has('KeyA')) &&
      !this.commands.some(c => c.type === 'rotate' && (c.value ?? 0) < 0)) {
      cmds.push({ tick, actorId: 'ship.player', type: 'rotate', value: -0.04 })
    }
    if ((this.keys.has('ArrowRight') || this.keys.has('KeyE')) &&
      !this.commands.some(c => c.type === 'rotate' && (c.value ?? 0) > 0)) {
      cmds.push({ tick, actorId: 'ship.player', type: 'rotate', value: 0.04 })
    }

    const queued = this.commands.splice(0)
    for (const cmd of queued) cmds.push({ ...cmd, tick })

    return cmds
  }
}
