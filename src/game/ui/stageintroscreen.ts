import type { StageDefinition } from '../data/masterdata'
import type { PlayerShipType } from '../data/masterdata'

type BtnId = 'sortie'

interface Region { id: BtnId; x: number; y: number; w: number; h: number }

const SHIP_NAME: Record<PlayerShipType, string> = {
  destroyer: '駆逐艦',
  cruiser: '巡洋艦',
  battleship: '戦艦',
}

export class StageIntroScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions: Region[] = []
  private hovered: BtnId | null = null
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
  }

  checkClick(e: MouseEvent): BtnId | null {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    for (const r of this.regions) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r.id
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

  render(stage: StageDefinition, shipType: PlayerShipType): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height

    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#020d1a')
    bg.addColorStop(1, '#051e38')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(30,80,130,0.15)'
    ctx.lineWidth = 1
    for (let y = 60; y < H; y += 40) {
      ctx.beginPath()
      for (let x = 0; x <= W; x += 8) {
        const wy = y + Math.sin(x * 0.018) * 4
        x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy)
      }
      ctx.stroke()
    }

    const isBoss = stage.boss === true
    const cx = W / 2

    // Stage label
    ctx.textAlign = 'center'
    ctx.fillStyle = isBoss ? '#fbbf24' : '#475569'
    ctx.font = `${Math.round(H * 0.030)}px monospace`
    ctx.fillText(`STAGE ${stage.stage}`, cx, H * 0.115)

    // Stage name
    ctx.fillStyle = isBoss ? '#fde68a' : '#7dd3fc'
    ctx.font = `bold ${Math.round(H * 0.072)}px sans-serif`
    ctx.fillText(stage.name, cx, H * 0.21)

    if (isBoss) {
      ctx.fillStyle = '#ef4444'
      ctx.font = `bold ${Math.round(H * 0.032)}px sans-serif`
      ctx.fillText('⚠ BOSS STAGE ⚠', cx, H * 0.275)
    }

    // Divider
    const divY = H * (isBoss ? 0.32 : 0.275)
    ctx.strokeStyle = 'rgba(56,189,248,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W * 0.15, divY)
    ctx.lineTo(W * 0.85, divY)
    ctx.stroke()

    // Info panels: enemy forces + ship
    const panelY = divY + H * 0.04
    const panelH = H * 0.42
    const leftX  = W * 0.17
    const rightX = W * 0.54
    const panelW = W * 0.30

    // Enemy forces panel
    this.drawPanel(ctx, leftX, panelY, panelW, panelH, '敵兵力')
    const rowH = panelH * 0.175
    const rows: [string, number, string][] = [
      ['駆逐艦', stage.destroyers, '#60a5fa'],
      ['巡洋艦', stage.cruisers,   '#a78bfa'],
      ['陸上施設', stage.buildings, '#f97316'],
    ]
    if (isBoss) rows.push(['ドレッドノート', 1, '#ef4444'])

    for (let i = 0; i < rows.length; i++) {
      const [label, count, color] = rows[i]!
      const rowY = panelY + panelH * 0.28 + i * rowH
      ctx.textAlign = 'left'
      ctx.fillStyle = '#64748b'
      ctx.font = `${Math.round(H * 0.030)}px sans-serif`
      ctx.fillText(label, leftX + panelW * 0.10, rowY)
      ctx.textAlign = 'right'
      ctx.fillStyle = count > 0 ? color : '#334155'
      ctx.font = `bold ${Math.round(H * 0.038)}px monospace`
      ctx.fillText(count > 0 ? `×${count}` : '—', leftX + panelW * 0.90, rowY)
    }

    // Ship panel
    this.drawPanel(ctx, rightX, panelY, panelW, panelH, '出撃艦')
    ctx.textAlign = 'center'
    ctx.fillStyle = '#38bdf8'
    ctx.font = `bold ${Math.round(H * 0.055)}px sans-serif`
    ctx.fillText(SHIP_NAME[shipType], rightX + panelW / 2, panelY + panelH * 0.55)
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(H * 0.028)}px sans-serif`
    ctx.fillText(shipType.toUpperCase(), rightX + panelW / 2, panelY + panelH * 0.72)

    // Sortie button
    const btnW = W * 0.22
    const btnH = H * 0.082
    const btnX = cx - btnW / 2
    const btnY = panelY + panelH + H * 0.055
    const hovSortie = this.hovered === 'sortie'
    this.regions = [{ id: 'sortie', x: btnX, y: btnY, w: btnW, h: btnH }]

    ctx.fillStyle = hovSortie ? (isBoss ? '#b91c1c' : '#0284c7') : (isBoss ? '#450a0a' : '#0f2944')
    roundRect(ctx, btnX, btnY, btnW, btnH, 10)
    ctx.fill()
    ctx.strokeStyle = hovSortie ? (isBoss ? '#ef4444' : '#38bdf8') : (isBoss ? '#7f1d1d' : '#1e3a5f')
    ctx.lineWidth = 2
    roundRect(ctx, btnX, btnY, btnW, btnH, 10)
    ctx.stroke()
    ctx.fillStyle = hovSortie ? '#ffffff' : (isBoss ? '#fca5a5' : '#7dd3fc')
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(btnH * 0.50)}px sans-serif`
    ctx.fillText('出撃！', cx, btnY + btnH * 0.67)
  }

  private drawPanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    title: string,
  ): void {
    ctx.fillStyle = 'rgba(10,24,46,0.85)'
    roundRect(ctx, x, y, w, h, 12)
    ctx.fill()
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, w, h, 12)
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 0.110)}px sans-serif`
    ctx.fillText(title, x + w * 0.10, y + h * 0.170)

    ctx.strokeStyle = 'rgba(56,189,248,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + w * 0.08, y + h * 0.22)
    ctx.lineTo(x + w * 0.92, y + h * 0.22)
    ctx.stroke()
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
