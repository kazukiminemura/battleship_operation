import { roundRect } from '../rendering/canvas-utils'

export const UI_THEME = {
  background: '#09111d',
  panel: '#111e2d',
  border: '#2b4154',
  text: '#e6eff6',
  muted: '#a0b3c5',
  cyan: '#65d9ed',
  amber: '#f4c36d',
  danger: '#fb8d88',
  font: '"Segoe UI", "Yu Gothic", Meiryo, sans-serif',
} as const

/** Presentation only: a quiet chart grid behind the menu screens. */
export function drawScreenBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.fillStyle = UI_THEME.background
  ctx.fillRect(0, 0, width, height)
  const light = ctx.createRadialGradient(width * .65, height * .25, 0, width * .65, height * .25, Math.max(width, height) * .8)
  light.addColorStop(0, '#183547')
  light.addColorStop(1, UI_THEME.background)
  ctx.fillStyle = light
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(101,217,237,0.045)'
  ctx.lineWidth = 1
  for (let x = 0; x < width; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
  }
  for (let y = 0; y < height; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
  }
  ctx.restore()
}

export function drawScreenPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = UI_THEME.panel
  roundRect(ctx, x, y, width, height, 8)
  ctx.fill()
  ctx.strokeStyle = UI_THEME.border
  ctx.lineWidth = 1
  ctx.stroke()
}
