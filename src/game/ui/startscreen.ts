import { drawAccessKeyHint, isAccessKey } from './accesskeys'
import { roundRect } from '../rendering/canvas-utils'
import { UI_THEME, drawScreenBackground, drawScreenPanel } from './ui-theme'

const BATTLE_KEY = 'SPACE'

interface Region { x: number; y: number; w: number; h: number }

export class StartScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private btnRegion: Region | null = null
  private hovered = false
  private keyboardFocused = false
  private onMoveRef: (e: MouseEvent) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onMoveRef = (e) => this.onMouseMove(e)
  }

  attach(): void {
    this.canvas.addEventListener('mousemove', this.onMoveRef)
    this.keyboardFocused = true
  }

  detach(): void {
    this.canvas.removeEventListener('mousemove', this.onMoveRef)
    this.hovered = false
    this.keyboardFocused = false
  }

  checkKeyDown(e: KeyboardEvent): boolean {
    const matched = e.altKey ? isAccessKey(e, BATTLE_KEY) : (e.code === 'Enter' || e.code === 'Space')
    if (matched) this.keyboardFocused = true
    return matched
  }

  checkClick(e: MouseEvent): boolean {
    if (!this.btnRegion) return false
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const r = this.btnRegion
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.btnRegion) return
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const r = this.btnRegion
    this.hovered = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
  }

  render(showAccessKeys = false): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2

    drawScreenBackground(ctx, W, H)

    drawScreenPanel(ctx, W * .12, H * .20, W * .76, H * .58)
    ctx.fillStyle = UI_THEME.cyan
    ctx.fillRect(W * .12, H * .20, 48, 3)
    ctx.textAlign = 'left'
    ctx.font = `600 ${Math.max(12, Math.round(H * .018))}px ${UI_THEME.font}`
    ctx.fillText('NAVAL COMMAND', W * .06, H * .075)
    ctx.textAlign = 'right'
    ctx.fillStyle = UI_THEME.muted
    ctx.fillText('艦船設計 / リアルタイム海戦', W - Math.max(140, W * .06), H * .075)
    ctx.textAlign = 'center'
    ctx.fillStyle = UI_THEME.text
    ctx.font = `bold ${Math.round(H * 0.080)}px ${UI_THEME.font}`
    ctx.fillText('BATTLESHIP', cx, H * 0.35)

    ctx.fillStyle = UI_THEME.cyan
    ctx.font = `bold ${Math.round(H * 0.059)}px ${UI_THEME.font}`
    ctx.fillText('OPERATION', cx, H * 0.45)

    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.026)}px ${UI_THEME.font}`
    ctx.fillText('設計した一隻で、作戦海域へ。', cx, H * 0.535)

    const btnW = W * 0.26
    const btnH = H * 0.074
    const btnX = cx - btnW / 2
    const btnY = H * 0.64
    this.btnRegion = { x: btnX, y: btnY, w: btnW, h: btnH }

    const active = this.hovered || this.keyboardFocused
    ctx.fillStyle = active ? '#ffe0a2' : UI_THEME.amber
    roundRect(ctx, btnX, btnY, btnW, btnH, 10)
    ctx.fill()
    ctx.strokeStyle = active ? UI_THEME.cyan : UI_THEME.amber
    ctx.lineWidth = 2
    roundRect(ctx, btnX, btnY, btnW, btnH, 10)
    ctx.stroke()
    ctx.fillStyle = UI_THEME.background
    ctx.font = `bold ${Math.round(btnH * 0.50)}px ${UI_THEME.font}`
    ctx.fillText('艦船を選んで開始', cx, btnY + btnH * 0.67)
    if (showAccessKeys) drawAccessKeyHint(ctx, BATTLE_KEY, btnX + 8, btnY + 8)

    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.022)}px ${UI_THEME.font}`
    ctx.fillText('ENTER / SPACE で開始', cx, H * 0.97)

    // Music credits - 魔王魂
    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.018)}px ${UI_THEME.font}`
    ctx.fillText('Music: 魔王魂 (maoudamashii.com)', cx, H * 0.93)
  }
}
