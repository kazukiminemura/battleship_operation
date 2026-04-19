import type { PlayerShipType } from '../data/masterdata'

interface ShipOption {
  type: PlayerShipType
  nameJP: string
  nameEN: string
  desc: string
  hp: number
  maxHp: number
  speedKt: number
  maxSpeedKt: number
  firepower: number   // 1-5
  weapons: string[]
}

const OPTIONS: ShipOption[] = [
  {
    type: 'destroyer', nameJP: '駆逐艦', nameEN: 'Destroyer',
    desc: '高速・軽武装',
    hp: 200, maxHp: 600, speedKt: 50, maxSpeedKt: 50, firepower: 2,
    weapons: ['127mm砲 ×60', '魚雷 ×8', 'AA ×200', 'ミサイル ×6'],
  },
  {
    type: 'cruiser', nameJP: '巡洋艦', nameEN: 'Cruiser',
    desc: '均衡型・万能',
    hp: 350, maxHp: 600, speedKt: 35, maxSpeedKt: 50, firepower: 3,
    weapons: ['152mm砲 ×80', '魚雷 ×16', 'AA ×300', 'ミサイル ×12'],
  },
  {
    type: 'battleship', nameJP: '戦艦', nameEN: 'Battleship',
    desc: '重装甲・重火力',
    hp: 600, maxHp: 600, speedKt: 20, maxSpeedKt: 50, firepower: 5,
    weapons: ['406mm砲 ×120', '魚雷 ×20', 'AA ×400', 'ミサイル ×20'],
  },
]

interface Region { type: PlayerShipType; x: number; y: number; w: number; h: number }

export class StartScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions: Region[] = []
  private hovered: PlayerShipType | null = null
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

  checkClick(e: MouseEvent): PlayerShipType | null {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    for (const r of this.regions) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r.type
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
        this.hovered = r.type; break
      }
    }
  }

  render(): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#020d1a')
    bg.addColorStop(1, '#051e38')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle wave lines
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

    // Title
    ctx.textAlign = 'center'
    ctx.fillStyle = '#7dd3fc'
    ctx.font = `bold ${Math.round(H * 0.072)}px sans-serif`
    ctx.fillText('BATTLESHIP OPERATION', W / 2, H * 0.13)

    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(H * 0.030)}px sans-serif`
    ctx.fillText('艦種を選択してください', W / 2, H * 0.205)

    // Cards
    this.regions = []
    const cardW  = Math.min(W * 0.27, 340)
    const cardH  = H * 0.68
    const cardY  = H * 0.27
    const gap    = (W - cardW * 3) / 4
    const starts = [gap, gap * 2 + cardW, gap * 3 + cardW * 2]

    for (let i = 0; i < OPTIONS.length; i++) {
      const opt = OPTIONS[i]!
      const x   = starts[i]!
      this.drawCard(opt, x, cardY, cardW, cardH, this.hovered === opt.type)
      this.regions.push({ type: opt.type, x, y: cardY, w: cardW, h: cardH })
    }

    // Controls hint
    ctx.fillStyle = '#334155'
    ctx.font = `${Math.round(H * 0.022)}px sans-serif`
    ctx.fillText('クリックで選択 · R キーでこの画面に戻る', W / 2, H * 0.97)
  }

  private drawCard(opt: ShipOption, x: number, y: number, w: number, h: number, hov: boolean): void {
    const { ctx } = this
    const cx = x + w / 2
    const pad = w * 0.09

    // Card bg
    ctx.fillStyle = hov ? 'rgba(56,189,248,0.10)' : 'rgba(10,24,46,0.88)'
    roundRect(ctx, x, y, w, h, 14)
    ctx.fill()
    ctx.strokeStyle = hov ? '#38bdf8' : '#1e3a5f'
    ctx.lineWidth = hov ? 2 : 1
    roundRect(ctx, x, y, w, h, 14)
    ctx.stroke()

    // Silhouette
    const silY = y + h * 0.19
    const silH = h * 0.19
    const silW = w * 0.76
    drawSilhouette(ctx, opt.type, cx, silY, silW, silH, hov)

    // Name JP
    ctx.textAlign = 'center'
    ctx.fillStyle = hov ? '#38bdf8' : '#e2e8f0'
    ctx.font = `bold ${Math.round(h * 0.10)}px sans-serif`
    ctx.fillText(opt.nameJP, cx, y + h * 0.425)

    // Name EN + desc
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 0.047)}px sans-serif`
    ctx.fillText(`${opt.nameEN}  ·  ${opt.desc}`, cx, y + h * 0.490)

    // Stat bars
    const barX = x + pad
    const barW = w - pad * 2
    const barH = h * 0.022

    const hp1Y = y + h * 0.545
    statBar(ctx, 'HP', barX, hp1Y, barW, barH, opt.hp / opt.maxHp, '#22c55e', h)

    const sp1Y = hp1Y + barH + h * 0.065
    statBar(ctx, `速度 ${opt.speedKt}kt`, barX, sp1Y, barW, barH, opt.speedKt / opt.maxSpeedKt, '#3b82f6', h)

    const fp1Y = sp1Y + barH + h * 0.065
    statBar(ctx, '火力', barX, fp1Y, barW, barH, opt.firepower / 5, '#f97316', h)

    // Weapons list
    ctx.textAlign = 'left'
    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(h * 0.038)}px sans-serif`
    const wpY = fp1Y + barH + h * 0.052
    for (let i = 0; i < opt.weapons.length; i++) {
      ctx.fillText(`· ${opt.weapons[i]}`, barX, wpY + i * h * 0.052)
    }

    // Select button
    const btnH = h * 0.085
    const btnY = y + h - btnH - h * 0.04
    ctx.fillStyle = hov ? '#0284c7' : '#0f2944'
    roundRect(ctx, x + pad, btnY, barW, btnH, 8)
    ctx.fill()
    ctx.strokeStyle = hov ? '#38bdf8' : '#1e3a5f'
    ctx.lineWidth = 1
    roundRect(ctx, x + pad, btnY, barW, btnH, 8)
    ctx.stroke()
    ctx.fillStyle = hov ? '#ffffff' : '#7dd3fc'
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(btnH * 0.48)}px sans-serif`
    ctx.fillText('選択', cx, btnY + btnH * 0.66)
  }
}

function statBar(
  ctx: CanvasRenderingContext2D,
  label: string, x: number, y: number, w: number, h: number,
  ratio: number, color: string, cardH: number,
): void {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#475569'
  ctx.font = `${Math.round(cardH * 0.036)}px sans-serif`
  ctx.fillText(label, x, y - 3)
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = color
  ctx.fillRect(x, y, w * ratio, h)
}

function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  type: PlayerShipType,
  cx: number, cy: number,
  maxW: number, maxH: number,
  hov: boolean,
): void {
  const col   = hov ? '#38bdf8' : '#334155'
  const light = hov ? '#bae6fd' : '#475569'

  // Ratios for each hull type
  const lRatio = type === 'battleship' ? 1.0 : type === 'cruiser' ? 0.88 : 0.76
  const wRatio = type === 'battleship' ? 0.28 : type === 'cruiser' ? 0.18 : 0.12
  const hl = maxW * lRatio / 2
  const hw = maxW * wRatio / 2

  // Hull polygon (pointing upward = bow at top)
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.moveTo(cx,          cy - maxH * 0.5)   // bow tip
  ctx.lineTo(cx + hw,     cy - maxH * 0.15)  // bow shoulder starboard
  ctx.lineTo(cx + hw,     cy + maxH * 0.30)  // midship starboard
  ctx.lineTo(cx + hw * 0.7, cy + maxH * 0.5) // stern starboard
  ctx.lineTo(cx - hw * 0.7, cy + maxH * 0.5) // stern port
  ctx.lineTo(cx - hw,     cy + maxH * 0.30)  // midship port
  ctx.lineTo(cx - hw,     cy - maxH * 0.15)  // bow shoulder port
  ctx.closePath()
  ctx.fill()

  // Superstructure
  const sLen = maxH * (type === 'battleship' ? 0.50 : 0.38)
  const sWid = hw * (type === 'battleship' ? 0.72 : 0.60)
  ctx.fillStyle = light
  ctx.fillRect(cx - sWid, cy - sLen * 0.3, sWid * 2, sLen)

  // Bridge / command tower
  const bLen = maxH * 0.12
  const bWid = sWid * 0.55
  ctx.fillStyle = hov ? '#e0f2fe' : '#64748b'
  ctx.fillRect(cx - bWid, cy - sLen * 0.3 - bLen, bWid * 2, bLen)

  // Turrets (battleship has 3, cruiser 2, destroyer 1)
  const tCount = type === 'battleship' ? 3 : type === 'cruiser' ? 2 : 1
  const tR = hw * 0.45
  const tSpacing = sLen / (tCount + 0.5)
  for (let i = 0; i < tCount; i++) {
    const ty = cy - sLen * 0.2 + i * tSpacing
    ctx.fillStyle = hov ? '#7dd3fc' : '#1e293b'
    ctx.beginPath()
    ctx.arc(cx, ty, tR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = light
    ctx.lineWidth = 0.8
    ctx.stroke()
    // Gun barrel
    ctx.strokeStyle = light
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(cx, ty)
    ctx.lineTo(cx, ty - tR - maxH * 0.08)
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
