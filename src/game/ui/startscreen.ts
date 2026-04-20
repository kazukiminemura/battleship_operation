interface Region { x: number; y: number; w: number; h: number }

export class StartScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private btnRegion: Region | null = null
  private hovered = false
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
    this.hovered = false
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

  render(): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2

    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#020d1a')
    bg.addColorStop(1, '#051e38')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(30,80,130,0.20)'
    ctx.lineWidth = 1
    for (let y = 60; y < H; y += 40) {
      ctx.beginPath()
      for (let x = 0; x <= W; x += 8) {
        const wy = y + Math.sin(x * 0.018) * 4
        x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy)
      }
      ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#7dd3fc'
    ctx.font = `bold ${Math.round(H * 0.088)}px sans-serif`
    ctx.fillText('BATTLESHIP', cx, H * 0.33)

    ctx.fillStyle = '#38bdf8'
    ctx.font = `bold ${Math.round(H * 0.056)}px sans-serif`
    ctx.fillText('OPERATION', cx, H * 0.45)

    ctx.fillStyle = '#334155'
    ctx.font = `${Math.round(H * 0.026)}px sans-serif`
    ctx.fillText('海戦シミュレーター', cx, H * 0.535)

    const btnW = W * 0.26
    const btnH = H * 0.074
    const btnX = cx - btnW / 2
    const btnY = H * 0.64
    this.btnRegion = { x: btnX, y: btnY, w: btnW, h: btnH }

    ctx.fillStyle = this.hovered ? '#0284c7' : '#0f2944'
    roundRect(ctx, btnX, btnY, btnW, btnH, 10)
    ctx.fill()
    ctx.strokeStyle = this.hovered ? '#38bdf8' : '#1e3a5f'
    ctx.lineWidth = 2
    roundRect(ctx, btnX, btnY, btnW, btnH, 10)
    ctx.stroke()
    ctx.fillStyle = this.hovered ? '#ffffff' : '#7dd3fc'
    ctx.font = `bold ${Math.round(btnH * 0.50)}px sans-serif`
    ctx.fillText('BATTLE START', cx, btnY + btnH * 0.67)

    ctx.fillStyle = '#1e293b'
    ctx.font = `${Math.round(H * 0.022)}px sans-serif`
    ctx.fillText('R キーで戦闘中にタイトルへ戻る', cx, H * 0.97)
  }
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
