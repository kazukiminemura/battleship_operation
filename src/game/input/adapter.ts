import type { Command, Vec3 } from '../simulation/types'
import type { WeaponMode } from '../ui/hud'
import type { CanvasRenderer } from '../rendering/canvas'

export interface InputFeedback {
  onWeaponSelected?: (weaponMode: WeaponMode) => void
  onSpeedChanged?: (direction: 'up' | 'down') => void
}

export class InputAdapter {
  private commands: Command[] = []
  private keys = new Set<string>()
  private weaponMode: WeaponMode = 'gun'
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

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)

      if (e.code === 'Digit1') this.selectWeaponMode('gun')
      if (e.code === 'Digit2') this.selectWeaponMode('torpedo')
      if (e.code === 'Digit3') this.selectWeaponMode('aa')
      if (e.code === 'Digit4') this.selectWeaponMode('missile')

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

      const cmdType =
        this.weaponMode === 'gun'     ? 'fire.primary' :
        this.weaponMode === 'torpedo' ? 'fire.torpedo'  :
        this.weaponMode === 'aa'      ? 'fire.aa'       :
                                        'fire.missile'

      this.commands.push({ tick: 0, actorId: 'ship.player', type: cmdType, target })
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
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) {
      cmds.push({ tick, actorId: 'ship.player', type: 'rotate', value: 0.04 })
    }

    const queued = this.commands.splice(0)
    for (const cmd of queued) cmds.push({ ...cmd, tick })

    return cmds
  }
}
