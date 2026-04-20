import type { PlayerShipType, WeaponTemplate } from '../data/masterdata'
import { WEAPON_CATALOG, getDefaultLoadout, type WeaponOption } from '../data/weapon-catalog'
import { getWeaponConfig } from '../simulation/weapon-strategies'

export interface DesignResult {
  shipType: PlayerShipType
  loadout: WeaponTemplate[]
}

type Phase = 'hull' | 'weapon'

interface HullCard {
  type: PlayerShipType
  nameJP: string
  nameEN: string
  desc: string
  hp: number; maxHp: number
  speedKt: number; maxSpeedKt: number
  firepower: number
}

const HULL_CARDS: HullCard[] = [
  { type: 'destroyer',  nameJP: '駆逐艦',  nameEN: 'Destroyer',  desc: '高速・軽武装', hp: 420,  maxHp: 1400, speedKt: 63, maxSpeedKt: 63, firepower: 2 },
  { type: 'cruiser',    nameJP: '巡洋艦',  nameEN: 'Cruiser',    desc: '均衡型・万能', hp: 760,  maxHp: 1400, speedKt: 44, maxSpeedKt: 63, firepower: 3 },
  { type: 'battleship', nameJP: '戦艦',    nameEN: 'Battleship', desc: '重装甲・重火力', hp: 1400, maxHp: 1400, speedKt: 26, maxSpeedKt: 63, firepower: 5 },
]

// Stat display max references
const MAX_DAMAGE = 200
const MAX_RANGE  = 3200
const MAX_COOLDOWN = 140  // highest cooldown in the game

const WEAPON_TYPE_JP: Record<string, string> = {
  gun: '主砲', secondary: '副砲', torpedo: '魚雷', aa: '対空', missile: '誘導',
}
const TYPE_COLOR: Record<string, string> = {
  gun: '#f97316', secondary: '#fb923c', torpedo: '#38bdf8', aa: '#4ade80', missile: '#a78bfa',
}

interface Region {
  tag: 'hull' | 'slot' | 'option' | 'confirm' | 'back'
  index?: number   // hull index / slot index / option index
  x: number; y: number; w: number; h: number
}

export class DesignScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions: Region[] = []
  private hovered: Region | null = null
  private onMoveRef: (e: MouseEvent) => void

  private phase: Phase = 'hull'
  private selectedHull: PlayerShipType = 'destroyer'
  private selectedSlot = 0
  private loadout: WeaponTemplate[] = getDefaultLoadout('destroyer')

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onMoveRef = (e) => this.onMouseMove(e)
  }

  attach(): void {
    this.canvas.addEventListener('mousemove', this.onMoveRef)
    this.phase = 'hull'
  }

  detach(): void {
    this.canvas.removeEventListener('mousemove', this.onMoveRef)
    this.hovered = null
  }

  checkClick(e: MouseEvent): DesignResult | null {
    const r = this.hitRegion(e)
    if (!r) return null

    if (r.tag === 'hull' && r.index !== undefined) {
      const hull = HULL_CARDS[r.index]!
      this.selectedHull = hull.type
      this.loadout = getDefaultLoadout(hull.type)
      this.selectedSlot = 0
      this.phase = 'weapon'
      this.hovered = null
      return null
    }

    if (r.tag === 'back') {
      this.phase = 'hull'
      this.hovered = null
      return null
    }

    if (r.tag === 'slot' && r.index !== undefined) {
      this.selectedSlot = r.index
      this.hovered = null
      return null
    }

    if (r.tag === 'option' && r.index !== undefined) {
      const catalog = WEAPON_CATALOG[this.selectedHull]
      const slot = catalog[this.selectedSlot]
      if (slot) {
        const opt = slot.options[r.index]
        if (opt) {
          this.loadout = this.loadout.map((w, i) =>
            i === this.selectedSlot ? { id: opt.id, name: opt.name, type: opt.type, ammo: opt.ammo } : w
          )
        }
      }
      this.hovered = null
      return null
    }

    if (r.tag === 'confirm') {
      return { shipType: this.selectedHull, loadout: [...this.loadout] }
    }

    return null
  }

  private hitRegion(e: MouseEvent): Region | null {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    for (const r of this.regions) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r
    }
    return null
  }

  private onMouseMove(e: MouseEvent): void {
    this.hovered = this.hitRegion(e)
  }

  render(): void {
    if (this.phase === 'hull') this.renderHullPhase()
    else this.renderWeaponPhase()
  }

  // ─── Phase 1: Hull selection ────────────────────────────────────────────────

  private renderHullPhase(): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height

    this.drawBackground(W, H)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#7dd3fc'
    ctx.font = `bold ${Math.round(H * 0.060)}px sans-serif`
    ctx.fillText('船の設計', W / 2, H * 0.10)

    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(H * 0.028)}px sans-serif`
    ctx.fillText('艦種を選択してください', W / 2, H * 0.165)

    this.regions = []
    const cardW = Math.min(W * 0.27, 340)
    const cardH = H * 0.72
    const cardY = H * 0.22
    const gap = (W - cardW * 3) / 4
    const starts = [gap, gap * 2 + cardW, gap * 3 + cardW * 2]

    for (let i = 0; i < HULL_CARDS.length; i++) {
      const card = HULL_CARDS[i]!
      const x = starts[i]!
      const hov = this.hovered?.tag === 'hull' && this.hovered.index === i
      this.drawHullCard(card, x, cardY, cardW, cardH, hov)
      this.regions.push({ tag: 'hull', index: i, x, y: cardY, w: cardW, h: cardH })
    }

    ctx.fillStyle = '#334155'
    ctx.font = `${Math.round(H * 0.022)}px sans-serif`
    ctx.fillText('クリックで選択', W / 2, H * 0.97)
  }

  private drawHullCard(card: HullCard, x: number, y: number, w: number, h: number, hov: boolean): void {
    const { ctx } = this
    const cx = x + w / 2
    const pad = w * 0.09

    ctx.fillStyle = hov ? 'rgba(56,189,248,0.10)' : 'rgba(10,24,46,0.88)'
    roundRect(ctx, x, y, w, h, 14); ctx.fill()
    ctx.strokeStyle = hov ? '#38bdf8' : '#1e3a5f'
    ctx.lineWidth = hov ? 2 : 1
    roundRect(ctx, x, y, w, h, 14); ctx.stroke()

    const silY = y + h * 0.19
    drawSilhouette(ctx, card.type, cx, silY, w * 0.76, h * 0.19, hov)

    ctx.textAlign = 'center'
    ctx.fillStyle = hov ? '#38bdf8' : '#e2e8f0'
    ctx.font = `bold ${Math.round(h * 0.10)}px sans-serif`
    ctx.fillText(card.nameJP, cx, y + h * 0.425)

    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 0.047)}px sans-serif`
    ctx.fillText(`${card.nameEN}  ·  ${card.desc}`, cx, y + h * 0.490)

    const barX = x + pad
    const barW = w - pad * 2
    const barH = h * 0.022
    statBar(ctx, 'HP', barX, y + h * 0.545, barW, barH, card.hp / card.maxHp, '#22c55e', h)
    statBar(ctx, `速度 ${card.speedKt}kt`, barX, y + h * 0.632, barW, barH, card.speedKt / card.maxSpeedKt, '#3b82f6', h)
    statBar(ctx, '火力', barX, y + h * 0.719, barW, barH, card.firepower / 5, '#f97316', h)

    const slots = WEAPON_CATALOG[card.type].length
    ctx.textAlign = 'left'
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 0.038)}px sans-serif`
    ctx.fillText(`· 兵装スロット: ${slots}`, barX, y + h * 0.798)

    const btnH = h * 0.085
    const btnY = y + h - btnH - h * 0.04
    ctx.fillStyle = hov ? '#0284c7' : '#0f2944'
    roundRect(ctx, x + pad, btnY, barW, btnH, 8); ctx.fill()
    ctx.strokeStyle = hov ? '#38bdf8' : '#1e3a5f'
    ctx.lineWidth = 1
    roundRect(ctx, x + pad, btnY, barW, btnH, 8); ctx.stroke()
    ctx.fillStyle = hov ? '#ffffff' : '#7dd3fc'
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(btnH * 0.48)}px sans-serif`
    ctx.fillText('兵装設計へ →', cx, btnY + btnH * 0.66)
  }

  // ─── Phase 2: Weapon customization ─────────────────────────────────────────

  private renderWeaponPhase(): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height
    const catalog = WEAPON_CATALOG[this.selectedHull]
    const hull = HULL_CARDS.find(c => c.type === this.selectedHull)!

    this.drawBackground(W, H)
    this.regions = []

    // Header
    ctx.textAlign = 'center'
    ctx.fillStyle = '#7dd3fc'
    ctx.font = `bold ${Math.round(H * 0.050)}px sans-serif`
    ctx.fillText(`船の設計 — ${hull.nameJP}`, W / 2, H * 0.085)

    // Back button
    const backW = W * 0.14
    const backH = H * 0.052
    const backX = W * 0.02
    const backY = H * 0.02
    const backHov = this.hovered?.tag === 'back'
    ctx.fillStyle = backHov ? 'rgba(56,189,248,0.15)' : 'rgba(10,24,46,0.80)'
    roundRect(ctx, backX, backY, backW, backH, 8); ctx.fill()
    ctx.strokeStyle = backHov ? '#38bdf8' : '#334155'
    ctx.lineWidth = 1
    roundRect(ctx, backX, backY, backW, backH, 8); ctx.stroke()
    ctx.fillStyle = backHov ? '#7dd3fc' : '#64748b'
    ctx.textAlign = 'center'
    ctx.font = `${Math.round(backH * 0.52)}px sans-serif`
    ctx.fillText('← 艦種変更', backX + backW / 2, backY + backH * 0.68)
    this.regions.push({ tag: 'back', x: backX, y: backY, w: backW, h: backH })

    // Layout
    const bodyY  = H * 0.115
    const bodyH  = H * 0.78
    const leftX  = W * 0.02
    const leftW  = W * 0.35
    const rightX = W * 0.40
    const rightW = W * 0.58

    this.renderSlotList(catalog, leftX, bodyY, leftW, bodyH)
    this.renderOptionPanel(catalog, rightX, bodyY, rightW, bodyH, H)

    // Confirm button
    const btnW = W * 0.22
    const btnH = H * 0.072
    const btnX = W / 2 - btnW / 2
    const btnY = bodyY + bodyH + H * 0.022
    const cfHov = this.hovered?.tag === 'confirm'
    ctx.fillStyle = cfHov ? '#0284c7' : '#083344'
    roundRect(ctx, btnX, btnY, btnW, btnH, 10); ctx.fill()
    ctx.strokeStyle = cfHov ? '#38bdf8' : '#164e63'
    ctx.lineWidth = 2
    roundRect(ctx, btnX, btnY, btnW, btnH, 10); ctx.stroke()
    ctx.fillStyle = cfHov ? '#ffffff' : '#7dd3fc'
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(btnH * 0.50)}px sans-serif`
    ctx.fillText('出撃準備完了　▶', W / 2, btnY + btnH * 0.67)
    this.regions.push({ tag: 'confirm', x: btnX, y: btnY, w: btnW, h: btnH })
  }

  private renderSlotList(
    catalog: typeof WEAPON_CATALOG[PlayerShipType],
    x: number, y: number, w: number, h: number,
  ): void {
    const { ctx } = this
    ctx.fillStyle = 'rgba(10,24,46,0.85)'
    roundRect(ctx, x, y, w, h, 10); ctx.fill()
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1
    roundRect(ctx, x, y, w, h, 10); ctx.stroke()

    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 0.055)}px sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('兵装スロット', x + w * 0.06, y + h * 0.065)
    divider(ctx, x + w * 0.04, y + h * 0.10, w * 0.92)

    const rowH = (h * 0.86) / catalog.length
    for (let i = 0; i < catalog.length; i++) {
      const slot = catalog[i]!
      const current = this.loadout[i]
      const ry = y + h * 0.12 + i * rowH
      const rh = rowH * 0.88
      const isSel = this.selectedSlot === i
      const isHov = this.hovered?.tag === 'slot' && this.hovered.index === i

      ctx.fillStyle = isSel ? 'rgba(56,189,248,0.18)' : isHov ? 'rgba(56,189,248,0.07)' : 'rgba(255,255,255,0.02)'
      roundRect(ctx, x + w * 0.04, ry, w * 0.92, rh, 6); ctx.fill()
      if (isSel) {
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5
        roundRect(ctx, x + w * 0.04, ry, w * 0.92, rh, 6); ctx.stroke()
      }

      // Slot number
      ctx.fillStyle = isSel ? '#38bdf8' : '#475569'
      ctx.font = `bold ${Math.round(rh * 0.36)}px monospace`
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}`, x + w * 0.08, ry + rh * 0.60)

      // Slot label
      ctx.fillStyle = '#64748b'
      ctx.font = `${Math.round(rh * 0.30)}px sans-serif`
      ctx.fillText(slot.label, x + w * 0.16, ry + rh * 0.42)

      // Weapon name
      if (current) {
        ctx.fillStyle = isSel ? '#e2e8f0' : '#94a3b8'
        ctx.font = `bold ${Math.round(rh * 0.36)}px sans-serif`
        ctx.fillText(fitText(ctx, current.name ?? current.id, w * 0.60), x + w * 0.16, ry + rh * 0.76)

        // Type badge
        const badgeColor = TYPE_COLOR[current.type] ?? '#64748b'
        ctx.fillStyle = `${badgeColor}25`
        const bw = w * 0.18
        const bx = x + w * 0.78
        roundRect(ctx, bx, ry + rh * 0.20, bw, rh * 0.55, 4); ctx.fill()
        ctx.fillStyle = badgeColor
        ctx.font = `bold ${Math.round(rh * 0.28)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(WEAPON_TYPE_JP[current.type] ?? current.type, bx + bw / 2, ry + rh * 0.58)
        ctx.textAlign = 'left'
      }

      this.regions.push({ tag: 'slot', index: i, x: x + w * 0.04, y: ry, w: w * 0.92, h: rh })
    }
  }

  private renderOptionPanel(
    catalog: typeof WEAPON_CATALOG[PlayerShipType],
    x: number, y: number, w: number, h: number, H: number,
  ): void {
    const { ctx } = this
    const slot = catalog[this.selectedSlot]
    if (!slot) return

    ctx.fillStyle = 'rgba(10,24,46,0.85)'
    roundRect(ctx, x, y, w, h, 10); ctx.fill()
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1
    roundRect(ctx, x, y, w, h, 10); ctx.stroke()

    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 0.045)}px sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(`スロット ${this.selectedSlot + 1}  —  ${slot.label}`, x + w * 0.04, y + h * 0.055)
    divider(ctx, x + w * 0.03, y + h * 0.085, w * 0.94)

    const optH = (h * 0.86) / slot.options.length
    for (let i = 0; i < slot.options.length; i++) {
      const opt = slot.options[i]!
      const oy = y + h * 0.10 + i * optH
      const oh = optH * 0.90
      const currentId = this.loadout[this.selectedSlot]?.id
      const isSel = currentId === opt.id
      const isHov = this.hovered?.tag === 'option' && this.hovered.index === i

      ctx.fillStyle = isSel ? 'rgba(56,189,248,0.14)' : isHov ? 'rgba(56,189,248,0.06)' : 'rgba(255,255,255,0.02)'
      roundRect(ctx, x + w * 0.03, oy, w * 0.94, oh, 8); ctx.fill()
      ctx.strokeStyle = isSel ? '#38bdf8' : '#1e3a5f'
      ctx.lineWidth = isSel ? 1.5 : 1
      roundRect(ctx, x + w * 0.03, oy, w * 0.94, oh, 8); ctx.stroke()

      const px = x + w * 0.07
      const typeColor = TYPE_COLOR[opt.type] ?? '#64748b'

      // Selected indicator
      ctx.fillStyle = isSel ? '#38bdf8' : '#334155'
      ctx.beginPath()
      ctx.arc(x + w * 0.055, oy + oh * 0.30, Math.round(oh * 0.10), 0, Math.PI * 2)
      ctx.fill()

      // Weapon name
      ctx.fillStyle = isSel ? '#e2e8f0' : '#94a3b8'
      ctx.font = `bold ${Math.round(oh * 0.17)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(opt.name, px, oy + oh * 0.22)

      // Type badge
      ctx.fillStyle = `${typeColor}22`
      const bw = w * 0.14; const bx2 = x + w * 0.82
      roundRect(ctx, bx2, oy + oh * 0.06, bw, oh * 0.26, 4); ctx.fill()
      ctx.fillStyle = typeColor
      ctx.font = `bold ${Math.round(oh * 0.14)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(WEAPON_TYPE_JP[opt.type] ?? opt.type, bx2 + bw / 2, oy + oh * 0.24)
      ctx.textAlign = 'left'

      // Description
      ctx.fillStyle = '#475569'
      ctx.font = `${Math.round(oh * 0.14)}px sans-serif`
      ctx.fillText(opt.desc, px, oy + oh * 0.38)

      // Ammo
      ctx.fillStyle = '#94a3b8'
      ctx.font = `${Math.round(oh * 0.13)}px monospace`
      ctx.fillText(`弾薬 ${opt.ammo}発`, px, oy + oh * 0.52)

      // Stat bars
      const cfg = getWeaponConfig(opt.id, opt.type)
      const avgDmg = (cfg.damageMin + cfg.damageMax) / 2
      const barsX = px
      const barsW = w * 0.78
      const barH2 = oh * 0.060
      const bar1Y = oy + oh * 0.62
      const bar2Y = bar1Y + barH2 + oh * 0.05
      const bar3Y = bar2Y + barH2 + oh * 0.05

      this.drawStatBar(ctx, '威力', barsX, bar1Y, barsW, barH2, avgDmg / MAX_DAMAGE, '#f97316', H)
      this.drawStatBar(ctx, '射程', barsX, bar2Y, barsW, barH2, cfg.maxRange / MAX_RANGE, '#38bdf8', H)
      const reloadRatio = Math.max(0, (MAX_COOLDOWN - cfg.cooldown) / (MAX_COOLDOWN - 4))
      this.drawStatBar(ctx, '速射', barsX, bar3Y, barsW, barH2, reloadRatio, '#4ade80', H)

      this.regions.push({ tag: 'option', index: i, x: x + w * 0.03, y: oy, w: w * 0.94, h: oh })
    }
  }

  private drawStatBar(
    ctx: CanvasRenderingContext2D,
    label: string, x: number, y: number, w: number, h: number,
    ratio: number, color: string, _H: number,
  ): void {
    const labelW = 28
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(h * 1.2)}px sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(label, x, y + h)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(x + labelW, y, w - labelW, h)
    ctx.fillStyle = color
    ctx.fillRect(x + labelW, y, (w - labelW) * Math.min(1, Math.max(0, ratio)), h)
  }

  // ─── Shared drawing helpers ─────────────────────────────────────────────────

  private drawBackground(W: number, H: number): void {
    const { ctx } = this
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#020d1a')
    bg.addColorStop(1, '#051e38')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(30,80,130,0.18)'
    ctx.lineWidth = 1
    for (let y = 60; y < H; y += 40) {
      ctx.beginPath()
      for (let x = 0; x <= W; x += 8) {
        const wy = y + Math.sin(x * 0.018) * 4
        x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy)
      }
      ctx.stroke()
    }
  }
}

// ── Standalone helpers ───────────────────────────────────────────────────────

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
  cx: number, cy: number, maxW: number, maxH: number, hov: boolean,
): void {
  const col   = hov ? '#38bdf8' : '#334155'
  const light = hov ? '#bae6fd' : '#475569'
  const wRatio = type === 'battleship' ? 0.28 : type === 'cruiser' ? 0.18 : 0.12
  const hw = maxW * wRatio / 2

  ctx.fillStyle = col
  ctx.beginPath()
  ctx.moveTo(cx,            cy - maxH * 0.5)
  ctx.lineTo(cx + hw,       cy - maxH * 0.15)
  ctx.lineTo(cx + hw,       cy + maxH * 0.30)
  ctx.lineTo(cx + hw * 0.7, cy + maxH * 0.5)
  ctx.lineTo(cx - hw * 0.7, cy + maxH * 0.5)
  ctx.lineTo(cx - hw,       cy + maxH * 0.30)
  ctx.lineTo(cx - hw,       cy - maxH * 0.15)
  ctx.closePath(); ctx.fill()

  const sLen = maxH * (type === 'battleship' ? 0.50 : 0.38)
  const sWid = hw * (type === 'battleship' ? 0.72 : 0.60)
  ctx.fillStyle = light
  ctx.fillRect(cx - sWid, cy - sLen * 0.3, sWid * 2, sLen)

  const bLen = maxH * 0.12; const bWid = sWid * 0.55
  ctx.fillStyle = hov ? '#e0f2fe' : '#64748b'
  ctx.fillRect(cx - bWid, cy - sLen * 0.3 - bLen, bWid * 2, bLen)

  const tCount = type === 'battleship' ? 3 : type === 'cruiser' ? 2 : 1
  const tR = hw * 0.45
  const tSpacing = sLen / (tCount + 0.5)
  for (let i = 0; i < tCount; i++) {
    const ty = cy - sLen * 0.2 + i * tSpacing
    ctx.fillStyle = hov ? '#7dd3fc' : '#1e293b'
    ctx.beginPath(); ctx.arc(cx, ty, tR, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = light; ctx.lineWidth = 0.8; ctx.stroke()
    ctx.strokeStyle = light; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx, ty - tR - maxH * 0.08); ctx.stroke()
  }
}

function divider(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = 'rgba(56,189,248,0.12)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t.length > 0 ? t + '…' : '…'
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
