import type { CombatState, Metrics } from '../simulation/types'
import { displayWeaponName } from '../data/weapon-names'
import { drawAccessKeyHint, isAccessKey } from './accesskeys'
import { roundRect } from '../rendering/canvas-utils'
import { UI_THEME, drawScreenBackground, drawScreenPanel } from './ui-theme'

export type ResultAction = 'next' | 'retry' | 'title'

interface Region { id: ResultAction; x: number; y: number; w: number; h: number }

export class ResultsScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions: Region[] = []
  private hovered: ResultAction | null = null
  private selected: ResultAction | null = null
  private onMoveRef: (e: MouseEvent) => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onMoveRef = (e) => this.onMouseMove(e)
  }

  attach(): void {
    this.canvas.addEventListener('mousemove', this.onMoveRef)
  }

  detach(): void {
    this.canvas.removeEventListener('mousemove', this.onMoveRef)
    this.hovered = null
    this.selected = null
  }

  checkClick(e: MouseEvent): ResultAction | null {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    for (const r of this.regions) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r.id
    }
    return null
  }

  checkKeyDown(e: KeyboardEvent, state: CombatState): ResultAction | null {
    const actions = this.availableActions(state)
    if (actions.length === 0) return null
    this.ensureSelected(actions)

    if (e.altKey) {
      for (const action of actions) {
        if (isAccessKey(e, accessKeyForAction(action))) {
          this.selected = action
          return action
        }
      }
      return null
    }

    if (e.code === 'KeyN' && actions.includes('next')) {
      this.selected = 'next'
      return 'next'
    }
    if (e.code === 'KeyT' && actions.includes('title')) {
      this.selected = 'title'
      return 'title'
    }
    if (e.code === 'ArrowLeft' || (e.code === 'Tab' && e.shiftKey)) {
      this.moveSelection(actions, -1)
      return null
    }
    if (e.code === 'ArrowRight' || e.code === 'Tab') {
      this.moveSelection(actions, 1)
      return null
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      return this.selected
    }

    return null
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    this.hovered = null
    for (const r of this.regions) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        this.hovered = r.id; break
      }
    }
  }

  render(state: CombatState, showAccessKeys = false): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const result = state.missionResult
    const m = state.metrics
    const completed = result === 'completed'
    const allClear = completed && state.stage >= state.maxStage
    const actions = this.availableActions(state)
    this.ensureSelected(actions)

    // Background
    drawScreenBackground(ctx, W, H)

    // Result header
    const headline = allClear ? 'ALL STAGES CLEAR' : completed ? 'MISSION COMPLETE' : 'MISSION FAILED'
    const headColor = allClear ? '#fbbf24' : completed ? '#22c55e' : '#ef4444'
    ctx.textAlign = 'center'
    ctx.fillStyle = headColor
    ctx.font = `bold ${Math.round(H * 0.064)}px ${UI_THEME.font}`
    ctx.fillText(headline, cx, H * 0.115)

    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.028)}px ${UI_THEME.font}`
    ctx.fillText(`STAGE ${state.stage}  ·  ${state.stageName}`, cx, H * 0.17)

    // Divider
    ctx.strokeStyle = `${headColor}40`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W * 0.12, H * 0.205)
    ctx.lineTo(W * 0.88, H * 0.205)
    ctx.stroke()

    // Stats
    const statsY = H * 0.235
    const statsH = H * 0.46
    const leftX  = W * 0.10
    const rightX = W * 0.52
    const colW   = W * 0.36

    this.drawStatsPanel(ctx, leftX, statsY, colW, statsH, m, H)
    this.drawWeaponPanel(ctx, rightX, statsY, colW, statsH, m, H)

    // Action buttons
    ctx.textAlign = 'center'
    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * .022)}px ${UI_THEME.font}`
    ctx.fillText(allClear ? '全作戦終了' : '次のステージ・リトライは、艦船整備を経て出撃します', cx, H * .905)
    this.regions = []
    const btnY = statsY + statsH + H * 0.048
    const btnH = H * 0.075

    if (completed && !allClear) {
      this.drawBtn(ctx, 'next',  cx - W * 0.24, btnY, W * 0.20, btnH, H, '次のステージへ', showAccessKeys)
      this.drawBtn(ctx, 'title', cx + W * 0.04,  btnY, W * 0.20, btnH, H, 'タイトルへ',     showAccessKeys)
    } else if (allClear) {
      this.drawBtn(ctx, 'title', cx - W * 0.10, btnY, W * 0.20, btnH, H, 'タイトルへ', showAccessKeys)
    } else {
      this.drawBtn(ctx, 'retry', cx - W * 0.24, btnY, W * 0.20, btnH, H, 'リトライ', showAccessKeys)
      this.drawBtn(ctx, 'title', cx + W * 0.04,  btnY, W * 0.20, btnH, H, 'タイトルへ', showAccessKeys)
    }
  }

  private drawStatsPanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    m: Metrics, H: number,
  ): void {
    drawScreenPanel(ctx, x, y, w, h)

    ctx.textAlign = 'left'
    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.028)}px ${UI_THEME.font}`
    ctx.fillText('戦果サマリー', x + w * 0.08, y + h * 0.115)
    divider(ctx, x + w * 0.06, y + h * 0.165, w * 0.88)

    const ticks = m.durationTicks
    const fps = 60
    const totalSec = Math.floor(ticks / fps)
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    const duration = `${mins}分 ${String(secs).padStart(2, '0')}秒`

    const totalShots = Object.values(m.shotCountByWeapon).reduce((a, b) => a + b, 0)
    const totalHits  = Object.values(m.hitCountByWeapon).reduce((a, b) => a + b, 0)
    const hitRate = totalShots > 0 ? Math.round(totalHits / totalShots * 100) : 0

    const rows: [string, string, string][] = [
      ['撃破数',   `${m.enemiesDestroyed} 隻`,  '#22c55e'],
      ['作戦時間', duration,                      UI_THEME.text],
      ['被弾ダメージ', `${Math.round(m.playerDamageTaken)}`, '#f97316'],
      ['弾薬消費', `${m.playerAmmoSpent} 発`,    '#a78bfa'],
      ['総命中率', `${hitRate}%`,                UI_THEME.cyan],
    ]

    const rowH = h * 0.135
    for (let i = 0; i < rows.length; i++) {
      const [label, value, color] = rows[i]!
      const ry = y + h * 0.235 + i * rowH
      ctx.textAlign = 'left'
      ctx.fillStyle = UI_THEME.muted
      ctx.font = `${Math.round(H * 0.026)}px ${UI_THEME.font}`
      ctx.fillText(label, x + w * 0.08, ry)
      ctx.textAlign = 'right'
      ctx.fillStyle = color
      ctx.font = `bold ${Math.round(H * 0.030)}px monospace`
      ctx.fillText(value, x + w * 0.92, ry)
    }
  }

  private drawWeaponPanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    m: Metrics, H: number,
  ): void {
    drawScreenPanel(ctx, x, y, w, h)

    ctx.textAlign = 'left'
    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.028)}px ${UI_THEME.font}`
    ctx.fillText('兵装別戦果', x + w * 0.08, y + h * 0.115)
    divider(ctx, x + w * 0.06, y + h * 0.165, w * 0.88)

    const weaponIds = Object.keys(m.shotCountByWeapon)
    if (weaponIds.length === 0) {
      ctx.textAlign = 'center'
      ctx.fillStyle = UI_THEME.muted
      ctx.font = `${Math.round(H * 0.026)}px ${UI_THEME.font}`
      ctx.fillText('データなし', x + w / 2, y + h * 0.5)
      return
    }

    const maxRows = Math.min(weaponIds.length, 5)
    const rowH = h * (0.76 / maxRows)
    const colShots = x + w * 0.51
    const colHits  = x + w * 0.69
    const colDmg   = x + w * 0.86

    ctx.textAlign = 'center'
    ctx.fillStyle = UI_THEME.muted
    ctx.font = `${Math.round(H * 0.022)}px ${UI_THEME.font}`
    ctx.fillText('発数', colShots, y + h * 0.225)
    ctx.fillText('命中', colHits,  y + h * 0.225)
    ctx.fillText('ダメージ', colDmg, y + h * 0.225)

    for (let i = 0; i < maxRows; i++) {
      const wid = weaponIds[i]!
      const shots  = m.shotCountByWeapon[wid] ?? 0
      const hits   = m.hitCountByWeapon[wid]  ?? 0
      const damage = Math.round(m.damageByWeapon[wid] ?? 0)
      const label  = displayWeaponName(wid)

      const ry = y + h * 0.295 + i * rowH

      ctx.textAlign = 'left'
      ctx.fillStyle = UI_THEME.muted
      ctx.font = `${Math.round(H * 0.026)}px ${UI_THEME.font}`
      ctx.fillText(fitText(ctx, label, w * 0.34), x + w * 0.08, ry)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#94a3b8'
      ctx.font = `${Math.round(H * 0.026)}px monospace`
      ctx.fillText(String(shots),  colShots, ry)
      ctx.fillStyle = hits > 0 ? UI_THEME.cyan : UI_THEME.muted
      ctx.fillText(String(hits),   colHits,  ry)
      ctx.fillStyle = damage > 0 ? '#f97316' : UI_THEME.muted
      ctx.fillText(String(damage), colDmg,   ry)
    }
  }

  private drawBtn(
    ctx: CanvasRenderingContext2D,
    id: ResultAction,
    x: number, y: number, w: number, h: number,
    H: number,
    label: string,
    showAccessKeys: boolean,
  ): void {
    const active = this.hovered === id || this.selected === id
    const primary = id !== 'title'
    ctx.fillStyle = primary ? (active ? '#ffe0a2' : UI_THEME.amber) : UI_THEME.panel
    roundRect(ctx, x, y, w, h, 10)
    ctx.fill()
    ctx.strokeStyle = active ? UI_THEME.cyan : UI_THEME.border
    ctx.lineWidth = active ? 2 : 1
    roundRect(ctx, x, y, w, h, 10)
    ctx.stroke()
    ctx.fillStyle = primary ? UI_THEME.background : UI_THEME.text
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(H * 0.030)}px ${UI_THEME.font}`
    ctx.fillText(label, x + w / 2, y + h * 0.66)
    if (showAccessKeys) drawAccessKeyHint(ctx, accessKeyForAction(id), x + 8, y + 8)
    this.regions.push({ id, x, y, w, h })
  }

  private availableActions(state: CombatState): ResultAction[] {
    if (state.missionResult === 'completed') {
      return state.stage >= state.maxStage ? ['title'] : ['next', 'title']
    }
    return ['retry', 'title']
  }

  private ensureSelected(actions: ResultAction[]): void {
    if (actions.length === 0) {
      this.selected = null
    } else if (!this.selected || !actions.includes(this.selected)) {
      this.selected = actions[0]!
    }
  }

  private moveSelection(actions: ResultAction[], direction: -1 | 1): void {
    this.ensureSelected(actions)
    const current = Math.max(0, actions.indexOf(this.selected!))
    const next = (current + direction + actions.length) % actions.length
    this.selected = actions[next]!
  }
}

function accessKeyForAction(action: ResultAction): string {
  if (action === 'next' || action === 'retry') return 'SPACE'
  return 'T'
}

function divider(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = 'rgba(56,189,248,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 0 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1)
  return t.length > 0 ? `${t}...` : '...'
}
