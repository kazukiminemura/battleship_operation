export function isAccessKey(e: KeyboardEvent, key: string): boolean {
  if (!e.altKey || e.ctrlKey || e.metaKey) return false
  const k = key.toUpperCase()
  if (/^[A-Z]$/.test(k)) return e.code === `Key${k}`
  if (/^[0-9]$/.test(k)) return e.code === `Digit${k}`
  if (k === 'ENTER') return e.code === 'Enter'
  if (k === 'SPACE') return e.code === 'Space'
  return false
}

export function drawAccessKeyHint(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  align: 'left' | 'right' = 'left',
): void {
  const label = key.toUpperCase()
  ctx.save()
  ctx.font = 'bold 12px monospace'
  const w = Math.max(22, ctx.measureText(label).width + 12)
  const h = 20
  const bx = align === 'right' ? x - w : x
  ctx.fillStyle = 'rgba(250,204,21,0.94)'
  roundRect(ctx, bx, y, w, h, 5)
  ctx.fill()
  ctx.strokeStyle = '#fef3c7'
  ctx.lineWidth = 1
  roundRect(ctx, bx, y, w, h, 5)
  ctx.stroke()
  ctx.fillStyle = '#1f2937'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, bx + w / 2, y + h / 2 + 0.5)
  ctx.restore()
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
