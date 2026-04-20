import type { CombatState, ShipEntity, WeaponType, SpeedLevel } from '../simulation/types'
import { SPEED_LEVEL_LABEL, SPEED_LEVEL_ORDER, KNOTS_PER_UNIT } from '../simulation/movement'

export type WeaponMode = 'gun' | 'torpedo' | 'aa' | 'missile'

export interface ClickRegion {
  id: string          // 'toggle:<weaponType>' | 'toggle-all'
  x: number
  y: number
  w: number
  h: number
}

const WEAPON_LABELS: Record<WeaponMode, string> = {
  gun: 'GUN',
  torpedo: 'TORP',
  aa: 'AA',
  missile: 'MISL',
}

const WEAPON_KEYS: Record<WeaponMode, string> = {
  gun: '1',
  torpedo: '2',
  aa: '3',
  missile: '4',
}

const WEAPON_ORDER: WeaponMode[] = ['gun', 'torpedo', 'aa', 'missile']
const HULL_SECTION_ORDER = ['bow', 'stern', 'superstructure', 'deck'] as const

type HullSection = typeof HULL_SECTION_ORDER[number]

const HULL_SECTION_LABELS: Record<HullSection, string> = {
  bow: '船首',
  stern: '船尾',
  superstructure: '船楼',
  deck: '甲板',
}

const RADAR_SIZE = 160   // px, radar panel side length
const RADAR_PAD  = 12

export class HUD {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private clickRegions: ClickRegion[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx
  }

  getClickRegions(): readonly ClickRegion[] {
    return this.clickRegions
  }

  render(state: CombatState, weaponMode: WeaponMode, worldSize: number): void {
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    if (!player) return

    this.clickRegions = []
    this.renderTopBar(player, weaponMode)
    this.renderRadar(state, player, worldSize)
    this.renderBottomBar()

    if (state.missionResult !== 'none') {
      this.renderResultOverlay(state.missionResult)
    }
  }

  private renderTopBar(player: ShipEntity, weaponMode: WeaponMode): void {
    const { ctx, canvas } = this
    const barH = 96
    const pad = 12

    ctx.fillStyle = 'rgba(0,0,0,0.68)'
    ctx.fillRect(0, 0, canvas.width, barH)

    // HP
    ctx.font = 'bold 12px monospace'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('HP', pad, 16)
    const hpRatio = player.hp / player.maxHp
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(pad, 20, 140, 10)
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444'
    ctx.fillRect(pad, 20, 140 * hpRatio, 10)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px monospace'
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, pad, 42)

    // speed level + knots
    this.renderSpeedIndicator(player, pad, 50)
    this.renderHullSectionStatus(player, pad, 75)

    // weapon slots
    const slotW = 126
    const slotGap = 5
    const slotsStartX = pad + 155
    const slotY = 4

    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const wType = WEAPON_ORDER[i]!
      const weapon = player.weapons.find(w => w.type === wType)
      const x = slotsStartX + i * (slotW + slotGap)
      const isSelected = weaponMode === wType
      const isAuto = weapon?.autoFire ?? false

      // slot bg
      ctx.fillStyle = isSelected ? 'rgba(59,130,246,0.30)' : 'rgba(255,255,255,0.04)'
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#334155'
      ctx.lineWidth = 1.5
      roundRect(ctx, x, slotY, slotW, barH - 6, 5)
      ctx.fill(); ctx.stroke()

      // label
      ctx.font = 'bold 12px monospace'
      ctx.fillStyle = isSelected ? '#fbbf24' : '#94a3b8'
      ctx.fillText(`[${WEAPON_KEYS[wType]}] ${WEAPON_LABELS[wType]}`, x + 6, slotY + 17)

      // ammo
      ctx.font = '11px monospace'
      ctx.fillStyle = (weapon?.ammo ?? 0) === 0 ? '#ef4444' : '#e2e8f0'
      ctx.fillText(`ammo ${weapon?.ammo ?? 0}`, x + 6, slotY + 30)

      // cooldown bar
      const cdMax = COOLDOWN_MAX[wType]
      const cdRatio = weapon && weapon.cooldownTick > 0 ? weapon.cooldownTick / cdMax : 0
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(x + 6, slotY + 35, slotW - 12, 4)
      ctx.fillStyle = cdRatio > 0 ? '#f59e0b' : '#22c55e'
      ctx.fillRect(x + 6, slotY + 35, (slotW - 12) * (cdRatio > 0 ? 1 - cdRatio : 1), 4)

      // AUTO/MAN toggle
      const btnX = x + 6
      const btnY = slotY + 43
      const btnW = slotW - 12
      const btnH = 16
      ctx.fillStyle = isAuto ? 'rgba(34,197,94,0.22)' : 'rgba(100,116,139,0.18)'
      ctx.strokeStyle = isAuto ? '#22c55e' : '#475569'
      ctx.lineWidth = 1
      roundRect(ctx, btnX, btnY, btnW, btnH, 3)
      ctx.fill(); ctx.stroke()

      ctx.font = 'bold 10px monospace'
      ctx.fillStyle = isAuto ? '#4ade80' : '#64748b'
      ctx.textAlign = 'center'
      ctx.fillText(isAuto ? '● AUTO' : '○ MAN', btnX + btnW / 2, btnY + 11)
      ctx.textAlign = 'left'

      this.clickRegions.push({ id: `toggle:${wType}`, x: btnX, y: btnY, w: btnW, h: btnH })
    }

    // ALL AUTO button (to the right of weapon slots)
    const allBtnX = slotsStartX + WEAPON_ORDER.length * (slotW + slotGap) + 8
    const allBtnY = slotY + 20
    const allBtnW = 80
    const allBtnH = 24
    const allAuto = player.weapons.every(w => w.autoFire)

    ctx.fillStyle = allAuto ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.18)'
    ctx.strokeStyle = allAuto ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1.5
    roundRect(ctx, allBtnX, allBtnY, allBtnW, allBtnH, 4)
    ctx.fill(); ctx.stroke()

    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = allAuto ? '#4ade80' : '#f87171'
    ctx.textAlign = 'center'
    ctx.fillText(allAuto ? 'ALL AUTO' : 'ALL MAN', allBtnX + allBtnW / 2, allBtnY + 16)
    ctx.textAlign = 'left'

    this.clickRegions.push({ id: 'toggle-all', x: allBtnX, y: allBtnY, w: allBtnW, h: allBtnH })
  }

  private renderHullSectionStatus(player: ShipEntity, x: number, y: number): void {
    const { ctx } = this
    const sections = estimateHullSections(player)
    const cellW = 68
    const rowH = 11

    ctx.font = '9px monospace'
    for (let i = 0; i < HULL_SECTION_ORDER.length; i++) {
      const section = HULL_SECTION_ORDER[i]!
      const col = i % 2
      const row = Math.floor(i / 2)
      const sx = x + col * (cellW + 5)
      const sy = y + row * rowH
      const ratio = sections[section]

      ctx.fillStyle = '#94a3b8'
      ctx.fillText(HULL_SECTION_LABELS[section], sx, sy + 7)

      const barX = sx + 27
      const barY = sy + 2
      const barW = 36
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(barX, barY, barW, 5)
      ctx.fillStyle = durabilityColor(ratio)
      ctx.fillRect(barX, barY, barW * ratio, 5)
      ctx.strokeStyle = 'rgba(148,163,184,0.25)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 4)
    }
  }

  private renderSpeedIndicator(player: ShipEntity, x: number, y: number): void {
    const { ctx } = this
    const level = player.speedLevel
    const knots = Math.abs(player.speed * KNOTS_PER_UNIT)
    const targetKnots = Math.abs(player.targetSpeed * KNOTS_PER_UNIT)
    const label = SPEED_LEVEL_LABEL[level]

    // level label color
    const levelColor: Record<SpeedLevel, string> = {
      full:    '#f87171',
      cruise:  '#fbbf24',
      slow:    '#86efac',
      stop:    '#94a3b8',
      reverse: '#a78bfa',
    }
    ctx.font = 'bold 12px monospace'
    ctx.fillStyle = levelColor[level]
    ctx.fillText(label, x, y)

    // knots
    ctx.font = '11px monospace'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`${knots.toFixed(0)} kt → ${targetKnots.toFixed(0)} kt`, x, y + 13)

    // mini speed bar (10 segments for 5 levels × 2 directions)
    const barW = 140
    const barH = 4
    const totalLevels = SPEED_LEVEL_ORDER.length
    const levelIdx = SPEED_LEVEL_ORDER.indexOf(level)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(x, y + 17, barW, barH)
    // fill from stop (index 1) toward current level
    const stopIdx = SPEED_LEVEL_ORDER.indexOf('stop')
    const segW = barW / (totalLevels - 1)
    if (levelIdx !== stopIdx) {
      const from = Math.min(levelIdx, stopIdx) * segW
      const to   = Math.max(levelIdx, stopIdx) * segW
      ctx.fillStyle = levelColor[level]
      ctx.fillRect(x + from, y + 17, to - from, barH)
    }
    // stop marker
    ctx.fillStyle = '#64748b'
    ctx.fillRect(x + stopIdx * segW - 1, y + 16, 2, barH + 2)
  }

  private renderRadar(state: CombatState, player: ShipEntity, worldSize: number): void {
    const { ctx, canvas } = this
    const rSize = RADAR_SIZE
    const rX = canvas.width - rSize - RADAR_PAD
    const rY = canvas.height - rSize - 30 - RADAR_PAD  // above bottom bar

    // background
    ctx.fillStyle = 'rgba(0,10,20,0.82)'
    ctx.strokeStyle = '#1e4a6a'
    ctx.lineWidth = 1.5
    roundRect(ctx, rX, rY, rSize, rSize, 6)
    ctx.fill(); ctx.stroke()

    // sweep rings
    ctx.strokeStyle = 'rgba(0,200,80,0.15)'
    ctx.lineWidth = 1
    for (const r of [0.25, 0.5, 0.75, 1]) {
      ctx.beginPath()
      ctx.arc(rX + rSize / 2, rY + rSize / 2, (rSize / 2) * r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // crosshair
    ctx.strokeStyle = 'rgba(0,200,80,0.12)'
    ctx.beginPath()
    ctx.moveTo(rX + rSize / 2, rY)
    ctx.lineTo(rX + rSize / 2, rY + rSize)
    ctx.moveTo(rX, rY + rSize / 2)
    ctx.lineTo(rX + rSize, rY + rSize / 2)
    ctx.stroke()

    const toRadar = (wx: number, wy: number): [number, number] => [
      rX + (wx / worldSize) * rSize,
      rY + (wy / worldSize) * rSize,
    ]

    // enemy blips
    for (const entity of state.entities.values()) {
      if (entity.kind !== 'ship') continue
      const ship = entity as ShipEntity
      if (ship.destroyed) continue
      if (ship.team === 'player') continue

      const [bx, by] = toRadar(ship.pos.x, ship.pos.y)
      const isCruiser = ship.templateId === 'hull.cruiser.basic'

      // pulsing outer ring
      ctx.beginPath()
      ctx.arc(bx, by, isCruiser ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = isCruiser ? 'rgba(251,146,60,0.4)' : 'rgba(239,68,68,0.3)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(bx, by, isCruiser ? 3 : 2, 0, Math.PI * 2)
      ctx.fillStyle = isCruiser ? '#fb923c' : '#f87171'
      ctx.fill()
    }

    // player blip
    const [px, py] = toRadar(player.pos.x, player.pos.y)
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()

    // label
    ctx.fillStyle = 'rgba(0,200,80,0.6)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('RADAR', rX + rSize - 4, rY + 12)
    ctx.textAlign = 'left'
  }

  private renderBottomBar(): void {
    const { ctx, canvas } = this
    const barH = 28
    const y = canvas.height - barH

    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, y, canvas.width, barH)

    ctx.fillStyle = '#475569'
    ctx.font = '11px monospace'
    ctx.fillText(
      '↑/W: 増速  ↓/S: 減速  ←→/AD: 旋回  Click: 射撃  1-4: 兵装選択  AUTO/MAN: 自動切替',
      12,
      y + 18
    )
  }

  private renderResultOverlay(result: 'completed' | 'failed'): void {
    const { ctx, canvas } = this

    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const text = result === 'completed' ? 'MISSION COMPLETE' : 'MISSION FAILED'
    const color = result === 'completed' ? '#22c55e' : '#ef4444'

    ctx.font = 'bold 60px monospace'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    ctx.font = '22px monospace'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 54)
    ctx.textAlign = 'left'
  }
}

const COOLDOWN_MAX: Record<WeaponType, number> = {
  gun: 15, torpedo: 60, aa: 8, missile: 90,
}

function estimateHullSections(ship: ShipEntity): Record<HullSection, number> {
  const hpRatio = clamp01(ship.hp / ship.maxHp)
  return {
    bow: clamp01(hpRatio * 1.08 - 0.04),
    stern: clamp01(hpRatio * 1.02 - 0.02),
    superstructure: clamp01(hpRatio * 0.94 + 0.03),
    deck: clamp01(hpRatio * 0.98),
  }
}

function durabilityColor(ratio: number): string {
  return ratio > 0.55 ? '#22c55e' : ratio > 0.28 ? '#eab308' : '#ef4444'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}
