import type { StageDefinition } from '../data/masterdata'
import type { PlayerShipType } from '../data/masterdata'
import { drawAccessKeyHint } from './accesskeys'

type BtnId = 'sortie'

interface Region { id: BtnId; x: number; y: number; w: number; h: number }

const SHIP_NAME: Record<PlayerShipType, string> = {
  destroyer: '駆逐艦',
  cruiser: '巡洋艦',
  battleship: '戦艦',
}

interface BriefingCopy {
  title: string
  commander: string
  objective: string
  intel: string[]
  tactics: string[]
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

  checkKeyDown(e: KeyboardEvent): BtnId | null {
    return e.code === 'Enter' || e.code === 'Space' ? 'sortie' : null
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

  render(stage: StageDefinition, shipType: PlayerShipType, showAccessKeys = false): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const H = canvas.height
    const briefing = makeBriefing(stage, shipType)

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

    // Header
    ctx.textAlign = 'center'
    ctx.fillStyle = isBoss ? '#fbbf24' : '#475569'
    ctx.font = `${Math.round(H * 0.025)}px monospace`
    ctx.fillText(`STAGE ${stage.stage}  /  OPERATION BRIEFING`, cx, H * 0.072)

    ctx.fillStyle = isBoss ? '#fde68a' : '#7dd3fc'
    ctx.font = `bold ${Math.round(H * 0.062)}px sans-serif`
    ctx.fillText(stage.name, cx, H * 0.145)

    if (isBoss) {
      ctx.fillStyle = '#ef4444'
      ctx.font = `bold ${Math.round(H * 0.027)}px sans-serif`
      ctx.fillText('BOSS STAGE', cx, H * 0.195)
    }

    const divY = H * (isBoss ? 0.225 : 0.205)
    ctx.strokeStyle = 'rgba(56,189,248,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(W * 0.15, divY)
    ctx.lineTo(W * 0.85, divY)
    ctx.stroke()

    // Briefing panels
    const panelY = divY + H * 0.035
    const panelH = H * 0.50
    const gap = W * 0.024
    const leftX = W * 0.08
    const leftW = W * 0.38
    const midX = leftX + leftW + gap
    const midW = W * 0.22
    const rightX = midX + midW + gap
    const rightW = W - rightX - W * 0.08

    this.drawPanel(ctx, leftX, panelY, leftW, panelH, '司令部通達')
    ctx.textAlign = 'left'
    ctx.fillStyle = isBoss ? '#fde68a' : '#bae6fd'
    ctx.font = `bold ${Math.round(H * 0.030)}px sans-serif`
    ctx.fillText(briefing.title, leftX + leftW * 0.08, panelY + panelH * 0.28)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = `${Math.round(H * 0.023)}px sans-serif`
    wrapText(ctx, briefing.commander, leftX + leftW * 0.08, panelY + panelH * 0.39, leftW * 0.84, H * 0.036, 5)

    ctx.fillStyle = '#38bdf8'
    ctx.font = `bold ${Math.round(H * 0.024)}px sans-serif`
    ctx.fillText('任務目的', leftX + leftW * 0.08, panelY + panelH * 0.73)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `${Math.round(H * 0.023)}px sans-serif`
    wrapText(ctx, briefing.objective, leftX + leftW * 0.08, panelY + panelH * 0.82, leftW * 0.84, H * 0.034, 2)

    this.drawPanel(ctx, midX, panelY, midW, panelH, '敵情')
    const rowH = panelH * 0.115
    const rows: [string, number, string][] = [
      ['駆逐艦', stage.destroyers, '#60a5fa'],
      ['巡洋艦', stage.cruisers,   '#a78bfa'],
      ['陸上施設', stage.buildings, '#f97316'],
    ]
    if (isBoss) rows.push(['ドレッドノート', 1, '#ef4444'])

    for (let i = 0; i < rows.length; i++) {
      const [label, count, color] = rows[i]!
      const rowY = panelY + panelH * 0.27 + i * rowH
      ctx.textAlign = 'left'
      ctx.fillStyle = '#64748b'
      ctx.font = `${Math.round(H * 0.022)}px sans-serif`
      ctx.fillText(label, midX + midW * 0.10, rowY)
      ctx.textAlign = 'right'
      ctx.fillStyle = count > 0 ? color : '#334155'
      ctx.font = `bold ${Math.round(H * 0.028)}px monospace`
      ctx.fillText(count > 0 ? `x${count}` : '-', midX + midW * 0.90, rowY)
    }

    const shipY = panelY + panelH * 0.73
    ctx.textAlign = 'center'
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(H * 0.020)}px sans-serif`
    ctx.fillText('出撃艦', midX + midW / 2, shipY)
    ctx.fillStyle = '#38bdf8'
    ctx.font = `bold ${Math.round(H * 0.038)}px sans-serif`
    ctx.fillText(SHIP_NAME[shipType], midX + midW / 2, shipY + H * 0.048)
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.round(H * 0.019)}px sans-serif`
    ctx.fillText(shipType.toUpperCase(), midX + midW / 2, shipY + H * 0.080)

    this.drawPanel(ctx, rightX, panelY, rightW, panelH, '作戦海域')
    this.drawTacticalMap(ctx, rightX + rightW * 0.08, panelY + panelH * 0.23, rightW * 0.84, panelH * 0.40, stage)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#38bdf8'
    ctx.font = `bold ${Math.round(H * 0.022)}px sans-serif`
    ctx.fillText('戦術メモ', rightX + rightW * 0.08, panelY + panelH * 0.72)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = `${Math.round(H * 0.020)}px sans-serif`
    const memoLines = [...briefing.intel, ...briefing.tactics].slice(0, 4)
    for (let i = 0; i < memoLines.length; i++) {
      ctx.fillStyle = i < briefing.intel.length ? '#cbd5e1' : '#fef3c7'
      ctx.fillText(`- ${memoLines[i]}`, rightX + rightW * 0.08, panelY + panelH * (0.80 + i * 0.060))
    }

    // Sortie button
    const btnW = W * 0.22
    const btnH = H * 0.082
    const btnX = cx - btnW / 2
    const btnY = Math.min(H - btnH - H * 0.052, panelY + panelH + H * 0.045)
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
    ctx.fillText('出撃', cx, btnY + btnH * 0.67)
    if (showAccessKeys) drawAccessKeyHint(ctx, 'SPACE', btnX + 8, btnY + 8)
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

  private drawTacticalMap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stage: StageDefinition): void {
    ctx.fillStyle = 'rgba(2,12,24,0.86)'
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(56,189,248,0.24)'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, w, h, 8)
    ctx.stroke()

    ctx.save()
    ctx.beginPath()
    roundRect(ctx, x, y, w, h, 8)
    ctx.clip()

    ctx.strokeStyle = 'rgba(30,80,130,0.24)'
    ctx.lineWidth = 1
    for (let gx = x + w * 0.16; gx < x + w; gx += w * 0.16) {
      ctx.beginPath()
      ctx.moveTo(gx, y)
      ctx.lineTo(gx, y + h)
      ctx.stroke()
    }
    for (let gy = y + h * 0.20; gy < y + h; gy += h * 0.20) {
      ctx.beginPath()
      ctx.moveTo(x, gy)
      ctx.lineTo(x + w, gy)
      ctx.stroke()
    }

    const sx = w / 10000
    const sy = h / 10000
    for (const obstacle of stage.mapObstacles) {
      ctx.beginPath()
      ctx.ellipse(
        x + obstacle.x * sx,
        y + obstacle.y * sy,
        Math.max(5, obstacle.rx * sx),
        Math.max(3, obstacle.ry * sy),
        0,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = 'rgba(74,93,61,0.78)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(164,196,126,0.42)'
      ctx.stroke()
    }

    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(x + w * 0.50, y + h * 0.85, 4, 0, Math.PI * 2)
    ctx.fill()

    const enemyCount = Math.min(18, stage.destroyers + stage.cruisers + stage.buildings + (stage.boss ? 1 : 0))
    for (let i = 0; i < enemyCount; i++) {
      const a = (i / enemyCount) * Math.PI * 2
      const rx = 0.25 + Math.abs(Math.sin(i * 1.71)) * 0.48
      const px = x + w * (0.50 + Math.cos(a) * rx * 0.58)
      const py = y + h * (0.42 + Math.sin(a) * rx * 0.42)
      ctx.fillStyle = i < stage.cruisers ? '#a78bfa' : i < stage.cruisers + stage.buildings ? '#f97316' : '#ef4444'
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5)
    }

    if (stage.boss) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x + w * 0.50, y + h * 0.42, 12, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.restore()
  }
}

function makeBriefing(stage: StageDefinition, shipType: PlayerShipType): BriefingCopy {
  const shipName = SHIP_NAME[shipType]
  const terrain = stage.mapObstacles.length >= 3
    ? '島影が多く、敵の射線が途切れやすい海域です。'
    : stage.mapObstacles.length >= 2
      ? '複数の島が進路を絞ります。敵を分断できます。'
      : '見通しは良好ですが、遮蔽物は限られます。'
  const threat = stage.boss
    ? '中核海域に大型艦を確認。通常艦隊とは火力が違います。'
    : stage.cruisers >= 3
      ? '巡洋艦戦力が厚く、接近戦は危険です。'
      : stage.destroyers >= 10
        ? '駆逐艦の数が多く、包囲機動に注意が必要です。'
        : '敵は哨戒部隊中心。初動で主導権を取れます。'

  return {
    title: stage.boss ? '敵主力を捕捉。これが決戦です。' : '作戦海域へ進入、敵哨戒網を突破します。',
    commander: stage.boss
      ? `${shipName}は敵中枢へ突入。護衛艦を掃討し、ドレッドノートを撃沈してください。長射程火力を受け続けると不利です。`
      : `${shipName}は前進し、敵艦隊と沿岸施設を排除してください。敵の密度が上がる前に各個撃破するのが理想です。`,
    objective: stage.buildings > 0
      ? '敵艦艇および陸上施設を全て無力化する。'
      : '敵艦艇を全て撃沈し、海域支配を確保する。',
    intel: [threat, terrain],
    tactics: [
      shipType === 'destroyer' ? '速度を活かして外周から削る。' : shipType === 'cruiser' ? '中距離を維持して火力を集中。' : '正面火力で敵隊列を崩す。',
      stage.buildings > 0 ? '施設への射線は島影で切り替える。' : '孤立した敵から優先して沈める。',
    ],
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  let line = ''
  let lineCount = 0
  for (const char of text) {
    const test = line + char
    if (ctx.measureText(test).width > maxWidth && line !== '' && isClosingPunctuation(char)) {
      ctx.fillText(test, x, y + lineCount * lineHeight)
      line = ''
      lineCount++
      if (lineCount >= maxLines) return
      continue
    }
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line, x, y + lineCount * lineHeight)
      line = char
      lineCount++
      if (lineCount >= maxLines) return
    } else {
      line = test
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y + lineCount * lineHeight)
}

function isClosingPunctuation(char: string): boolean {
  return char === '。' || char === '、' || char === '」' || char === '』' || char === '）'
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
