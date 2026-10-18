import { drawAccessKeyHint } from './accesskeys'
import { roundRect } from '../rendering/canvas-utils'
import { UI_THEME, drawScreenPanel } from './ui-theme'

export type PauseAction = 'resume' | 'title'

export interface PauseRegion {
  id: PauseAction
  x: number
  y: number
  w: number
  h: number
}

export function pauseAccessKey(action: PauseAction): string {
  return action === 'resume' ? 'P' : 'T'
}

export function hitPauseRegion(
  canvas: HTMLCanvasElement,
  regions: PauseRegion[],
  e: MouseEvent,
): PauseAction | null {
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  for (const r of regions) {
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r.id
  }
  return null
}

export function renderPauseOverlay(
  canvas: HTMLCanvasElement,
  showAccessKeys: boolean,
): PauseRegion[] {
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

  drawScreenPanel(ctx, panelX, panelY, panelW, panelH)
  ctx.fillStyle = UI_THEME.cyan
  ctx.fillRect(panelX + 24, panelY, 42, 3)

  ctx.textAlign = 'center'
  ctx.fillStyle = UI_THEME.text
  ctx.font = `bold ${Math.round(panelH * 0.18)}px ${UI_THEME.font}`
  ctx.fillText('PAUSED', cx, panelY + panelH * 0.26)

  ctx.fillStyle = UI_THEME.muted
  ctx.font = `${Math.round(panelH * 0.072)}px ${UI_THEME.font}`
  ctx.fillText('戦闘を一時停止中', cx, panelY + panelH * 0.39)

  const btnW = panelW * 0.36
  const btnH = panelH * 0.18
  const gap = panelW * 0.06
  const btnY = panelY + panelH * 0.64
  const resumeX = cx - btnW - gap / 2
  const titleX = cx + gap / 2

  drawPauseButton(ctx, resumeX, btnY, btnW, btnH, '再開', UI_THEME.amber)
  drawPauseButton(ctx, titleX, btnY, btnW, btnH, 'タイトルへ', UI_THEME.border)
  if (showAccessKeys) {
    drawAccessKeyHint(ctx, pauseAccessKey('resume'), resumeX + 8, btnY + 8)
    drawAccessKeyHint(ctx, pauseAccessKey('title'), titleX + 8, btnY + 8)
  }

  ctx.fillStyle = UI_THEME.muted
  ctx.font = `${Math.round(panelH * 0.052)}px ${UI_THEME.font}`
  ctx.fillText('P / Esc で再開', cx, panelY + panelH * 0.90)
  ctx.restore()

  return [
    { id: 'resume', x: resumeX, y: btnY, w: btnW, h: btnH },
    { id: 'title',  x: titleX,  y: btnY, w: btnW, h: btnH },
  ]
}

function drawPauseButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: string,
): void {
  ctx.fillStyle = color === UI_THEME.amber ? UI_THEME.amber : UI_THEME.panel
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 8)
  ctx.stroke()
  ctx.fillStyle = color === UI_THEME.amber ? UI_THEME.background : UI_THEME.text
  ctx.textAlign = 'center'
  ctx.font = `bold ${Math.round(h * 0.45)}px ${UI_THEME.font}`
  ctx.fillText(label, x + w / 2, y + h * 0.65)
}
