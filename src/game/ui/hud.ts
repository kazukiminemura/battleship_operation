import { MAX_WEAPON_SLOTS, type BuildingEntity, type CombatState, type ShipEntity, type WeaponType, type SpeedLevel } from '../simulation/types'
import { SPEED_LEVEL_LABEL, SPEED_LEVEL_ORDER, KNOTS_PER_UNIT } from '../simulation/movement'
import { getWeaponConfig } from '../simulation/weapon-strategies'
import {
  HULL_SECTION_LABELS,
  HULL_SECTION_ORDER,
  durabilityColor,
  estimateHullSections,
} from './hullstatus'

export type WeaponMode = number

export interface ClickRegion {
  id: string          // 'toggle:<slotIndex>' | 'toggle-all'
  x: number
  y: number
  w: number
  h: number
}

const WEAPON_LABELS: Record<WeaponType, string> = {
  gun: '主砲',
  secondary: '副砲',
  torpedo: '魚雷',
  aa: '対空',
  missile: '誘導',
}

const RADAR_SIZE = 160   // px, radar panel side length
const RADAR_PAD  = 12
const RADAR_WORLD_RANGE = 4500
const RADAR_CONTACT_TICKS = 120

interface RadarContact {
  tick: number
  stage: number
  x: number
  y: number
  templateId: string
}

export class HUD {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private clickRegions: ClickRegion[] = []
  private radarContacts = new Map<string, RadarContact>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx
  }

  getClickRegions(): readonly ClickRegion[] {
    return this.clickRegions
  }

  render(state: CombatState, weaponMode: WeaponMode, worldSize: number, bgmEnabled: boolean): void {
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    if (!player) return

    this.clickRegions = []
    this.renderTopBar(state, player, weaponMode, bgmEnabled)
    this.renderRadar(state, player, worldSize)
    this.renderBottomBar()

    if (state.missionResult !== 'none') {
      this.renderResultOverlay(state)
    }
  }

  private renderTopBar(state: CombatState, player: ShipEntity, weaponMode: WeaponMode, bgmEnabled: boolean): void {
    const { ctx, canvas } = this
    const barH = 130
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

    ctx.font = 'bold 10px monospace'
    ctx.fillStyle = '#38bdf8'
    ctx.fillText(`STAGE ${state.stage}/${state.maxStage}`, pad, 65)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(state.stageName, pad, 76)

    if (state.stage >= 90) {
      ctx.font = 'bold 10px monospace'
      ctx.fillStyle = '#fbbf24'
      ctx.fillText('DEBUG MAP', pad + 84, 65)
    }

    // speed level + knots
    this.renderSpeedIndicator(player, pad, 86)
    this.renderHullSectionStatus(player, pad, 111)

    // weapon slots
    const slotGap = 5
    const allBtnW = 80
    const sideGap = 8
    const slotsStartX = pad + 155
    const slotY = 4
    const availableW = Math.max(0, canvas.width - slotsStartX - allBtnW - sideGap - pad)
    const slotW = Math.max(70, Math.min(118, (availableW - slotGap * (MAX_WEAPON_SLOTS - 1)) / MAX_WEAPON_SLOTS))

    for (let i = 0; i < MAX_WEAPON_SLOTS; i++) {
      const weapon = player.weapons[i]
      const x = slotsStartX + i * (slotW + slotGap)
      const isSelected = weaponMode === i
      const isAuto = weapon?.autoFire ?? false
      const wType = weapon?.type

      // slot bg
      ctx.fillStyle = isSelected ? 'rgba(59,130,246,0.30)' : 'rgba(255,255,255,0.04)'
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#334155'
      ctx.lineWidth = 1.5
      roundRect(ctx, x, slotY, slotW, barH - 6, 5)
      ctx.fill(); ctx.stroke()

      // label
      ctx.font = 'bold 12px monospace'
      ctx.fillStyle = weapon ? (isSelected ? '#fbbf24' : '#94a3b8') : '#475569'
      ctx.fillText(`[${i + 1}] ${wType ? WEAPON_LABELS[wType] : '空'}`, x + 6, slotY + 17)

      ctx.font = '10px monospace'
      ctx.fillStyle = weapon ? '#cbd5e1' : '#475569'
      ctx.fillText(fitText(ctx, weapon?.name ?? '未装備', slotW - 12), x + 6, slotY + 31)

      // ammo
      ctx.font = '11px monospace'
      ctx.fillStyle = !weapon ? '#475569' : weapon.ammo === 0 ? '#ef4444' : '#e2e8f0'
      ctx.fillText(weapon ? `ammo ${weapon.ammo}` : '---', x + 6, slotY + 44)

      // cooldown bar
      const cdMax = weapon ? getWeaponConfig(weapon.id, weapon.type).cooldown : 1
      const cdRatio = weapon && weapon.cooldownTick > 0 ? weapon.cooldownTick / cdMax : 0
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(x + 6, slotY + 49, slotW - 12, 4)
      ctx.fillStyle = cdRatio > 0 ? '#f59e0b' : '#22c55e'
      ctx.fillRect(x + 6, slotY + 49, (slotW - 12) * (cdRatio > 0 ? 1 - cdRatio : 1), 4)

      // AUTO/MAN toggle
      const btnX = x + 6
      const btnY = slotY + 57
      const btnW = slotW - 12
      const btnH = 16
      ctx.fillStyle = !weapon ? 'rgba(30,41,59,0.18)' : isAuto ? 'rgba(34,197,94,0.22)' : 'rgba(100,116,139,0.18)'
      ctx.strokeStyle = !weapon ? '#334155' : isAuto ? '#22c55e' : '#475569'
      ctx.lineWidth = 1
      roundRect(ctx, btnX, btnY, btnW, btnH, 3)
      ctx.fill(); ctx.stroke()

      ctx.font = 'bold 10px monospace'
      ctx.fillStyle = !weapon ? '#475569' : isAuto ? '#4ade80' : '#64748b'
      ctx.textAlign = 'center'
      ctx.fillText(!weapon ? 'EMPTY' : isAuto ? '● AUTO' : '○ MAN', btnX + btnW / 2, btnY + 11)
      ctx.textAlign = 'left'

      if (weapon) this.clickRegions.push({ id: `toggle:${i}`, x: btnX, y: btnY, w: btnW, h: btnH })
    }

    // ALL AUTO button (to the right of weapon slots)
    const allBtnX = slotsStartX + MAX_WEAPON_SLOTS * slotW + (MAX_WEAPON_SLOTS - 1) * slotGap + sideGap
    const allBtnY = slotY + 20
    const allBtnH = 24
    const allAuto = player.weapons.length > 0 && player.weapons.every(w => w.autoFire)

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

    const bgmBtnY = allBtnY + 32
    ctx.fillStyle = bgmEnabled ? 'rgba(59,130,246,0.25)' : 'rgba(100,116,139,0.18)'
    ctx.strokeStyle = bgmEnabled ? '#60a5fa' : '#475569'
    ctx.lineWidth = 1.5
    roundRect(ctx, allBtnX, bgmBtnY, allBtnW, allBtnH, 4)
    ctx.fill(); ctx.stroke()

    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = bgmEnabled ? '#93c5fd' : '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText(bgmEnabled ? 'BGM ON' : 'BGM OFF', allBtnX + allBtnW / 2, bgmBtnY + 16)
    ctx.textAlign = 'left'

    this.clickRegions.push({ id: 'toggle-bgm', x: allBtnX, y: bgmBtnY, w: allBtnW, h: allBtnH })
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

  private renderRadar(state: CombatState, player: ShipEntity, _worldSize: number): void {
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
    ctx.save()
    roundRect(ctx, rX, rY, rSize, rSize, 6)
    ctx.clip()

    const cX = rX + rSize / 2
    const cY = rY + rSize / 2
    const radarR = rSize / 2
    const sweepAngle = (state.tick * 0.055) % (Math.PI * 2)

    const toRadar = (wx: number, wy: number): [number, number] => [
      cX + ((wx - player.pos.x) / RADAR_WORLD_RANGE) * radarR,
      cY + ((wy - player.pos.y) / RADAR_WORLD_RANGE) * radarR,
    ]
    const isInRadarRange = (wx: number, wy: number, margin = 0): boolean => {
      const dx = wx - player.pos.x
      const dy = wy - player.pos.y
      return dx * dx + dy * dy <= (RADAR_WORLD_RANGE + margin) * (RADAR_WORLD_RANGE + margin)
    }
    const sweepStrength = (sx: number, sy: number): number => {
      const angle = Math.atan2(sy - cY, sx - cX)
      const diff = angularDistance(angle, sweepAngle)
      return Math.max(0, 1 - diff / 0.42)
    }

    // land masses
    for (const land of state.mapObstacles) {
      if (!isInRadarRange(land.x, land.y, Math.max(land.rx, land.ry))) continue
      const [lx, ly] = toRadar(land.x, land.y)
      const rx = (land.rx / RADAR_WORLD_RANGE) * radarR
      const ry = (land.ry / RADAR_WORLD_RANGE) * radarR

      ctx.beginPath()
      ctx.ellipse(lx, ly, rx * 1.18, ry * 1.18, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(125,211,252,0.22)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.beginPath()
      ctx.ellipse(lx, ly, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(186,230,253,0.18)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.beginPath()
      ctx.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(132,204,22,0.20)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(190,242,100,0.48)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

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

    const liveEnemyIds = new Set<string>()
    for (const entity of state.entities.values()) {
      if (entity.kind !== 'ship') continue
      const ship = entity as ShipEntity
      if (ship.destroyed || ship.team === 'player') continue

      liveEnemyIds.add(ship.id)
      if (!isInRadarRange(ship.pos.x, ship.pos.y)) continue
      const [bx, by] = toRadar(ship.pos.x, ship.pos.y)
      if (sweepStrength(bx, by) > 0.72) {
        this.radarContacts.set(ship.id, {
          tick: state.tick,
          stage: state.stage,
          x: ship.pos.x,
          y: ship.pos.y,
          templateId: ship.templateId,
        })
      }
    }
    for (const [id, contact] of this.radarContacts) {
      if (contact.stage !== state.stage || !liveEnemyIds.has(id) || state.tick - contact.tick > RADAR_CONTACT_TICKS || contact.tick > state.tick) {
        this.radarContacts.delete(id)
      }
    }

    // rotating radar sweep
    ctx.save()
    ctx.beginPath()
    ctx.rect(rX, rY, rSize, rSize)
    ctx.clip()
    ctx.globalCompositeOperation = 'screen'
    const sweepSteps = 7
    for (let i = 0; i < sweepSteps; i++) {
      const width = 0.12 + i * 0.055
      const alpha = 0.18 * (1 - i / sweepSteps)
      ctx.beginPath()
      ctx.moveTo(cX, cY)
      ctx.arc(cX, cY, radarR, sweepAngle - width, sweepAngle - width * 0.18)
      ctx.closePath()
      ctx.fillStyle = `rgba(74,222,128,${alpha})`
      ctx.fill()
    }
    const sx = cX + Math.cos(sweepAngle) * radarR
    const sy = cY + Math.sin(sweepAngle) * radarR
    const sweepGrad = ctx.createLinearGradient(cX, cY, sx, sy)
    sweepGrad.addColorStop(0, 'rgba(134,239,172,0.08)')
    sweepGrad.addColorStop(0.75, 'rgba(74,222,128,0.48)')
    sweepGrad.addColorStop(1, 'rgba(187,247,208,0.85)')
    ctx.beginPath()
    ctx.moveTo(cX, cY)
    ctx.lineTo(sx, sy)
    ctx.strokeStyle = sweepGrad
    ctx.lineWidth = 1.7
    ctx.stroke()
    ctx.restore()

    // scanned enemy afterimages
    for (const contact of this.radarContacts.values()) {
      const age = state.tick - contact.tick
      if (age < 0 || age > RADAR_CONTACT_TICKS) continue
      if (!isInRadarRange(contact.x, contact.y)) continue
      const fade = 1 - age / RADAR_CONTACT_TICKS
      const [bx, by] = toRadar(contact.x, contact.y)
      const isCruiser = contact.templateId === 'hull.cruiser.basic'
      const isBoss = contact.templateId === 'hull.enemy.boss.dreadnought'
      const outer = isBoss ? 8 : isCruiser ? 5.5 : 3.5
      const inner = isBoss ? 4 : isCruiser ? 3 : 2

      ctx.beginPath()
      ctx.arc(bx, by, outer, 0, Math.PI * 2)
      ctx.fillStyle = isBoss
        ? `rgba(216,70,239,${fade * 0.26})`
        : isCruiser
          ? `rgba(251,146,60,${fade * 0.24})`
          : `rgba(239,68,68,${fade * 0.22})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(bx, by, inner, 0, Math.PI * 2)
      ctx.fillStyle = isBoss
        ? `rgba(232,121,249,${fade * 0.78})`
        : isCruiser
          ? `rgba(251,146,60,${fade * 0.72})`
          : `rgba(248,113,113,${fade * 0.68})`
      ctx.fill()
    }

    // buildings / bases
    for (const entity of state.entities.values()) {
      if (entity.kind !== 'building') continue
      const building = entity as BuildingEntity
      if (building.destroyed) continue
      if (!isInRadarRange(building.pos.x, building.pos.y, building.radius)) continue

      const [bx, by] = toRadar(building.pos.x, building.pos.y)
      const pulse = sweepStrength(bx, by)
      const size = building.templateId.includes('command') ? 5 : 4
      ctx.fillStyle = building.team === 'enemy'
        ? `rgba(250,204,21,${0.68 + pulse * 0.32})`
        : `rgba(148,163,184,${0.55 + pulse * 0.30})`
      ctx.strokeStyle = building.templateId.includes('radar') ? '#67e8f9' : 'rgba(15,23,42,0.85)'
      ctx.lineWidth = 1
      ctx.fillRect(bx - size / 2, by - size / 2, size, size)
      ctx.strokeRect(bx - size / 2 + 0.5, by - size / 2 + 0.5, size - 1, size - 1)
    }

    // enemy blips
    for (const entity of state.entities.values()) {
      if (entity.kind !== 'ship') continue
      const ship = entity as ShipEntity
      if (ship.destroyed) continue
      if (ship.team === 'player') continue
      if (!isInRadarRange(ship.pos.x, ship.pos.y)) continue

      const [bx, by] = toRadar(ship.pos.x, ship.pos.y)
      const isCruiser = ship.templateId === 'hull.cruiser.basic'
      const isBoss = ship.templateId === 'hull.enemy.boss.dreadnought'
      const pulse = sweepStrength(bx, by)
      const contact = this.radarContacts.get(ship.id)
      const contactFade = contact && contact.stage === state.stage
        ? Math.max(0, 1 - (state.tick - contact.tick) / RADAR_CONTACT_TICKS)
        : 0
      const signal = Math.max(pulse, contactFade * 0.55)

      // スイープ前（未探知）は描画しない
      if (signal <= 0) continue

      // pulsing outer ring
      ctx.beginPath()
      ctx.arc(bx, by, isBoss ? 7 + signal * 2 : isCruiser ? 5 + signal * 1.5 : 3 + signal, 0, Math.PI * 2)
      ctx.fillStyle = isBoss
        ? `rgba(216,70,239,${signal * 0.56})`
        : isCruiser
          ? `rgba(251,146,60,${signal * 0.52})`
          : `rgba(239,68,68,${signal * 0.48})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(bx, by, isBoss ? 4 : isCruiser ? 3 : 2, 0, Math.PI * 2)
      ctx.fillStyle = isBoss
        ? `rgba(232,121,249,${signal * 0.78})`
        : isCruiser
          ? `rgba(251,146,60,${signal * 0.72})`
          : `rgba(248,113,113,${signal * 0.70})`
      ctx.fill()
    }

    // player blip
    const [px, py] = toRadar(player.pos.x, player.pos.y)
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()
    ctx.restore()

    // label
    ctx.fillStyle = 'rgba(0,200,80,0.6)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('RADAR', rX + rSize - 4, rY + 12)
    ctx.fillStyle = 'rgba(148,225,180,0.55)'
    ctx.textAlign = 'left'
    ctx.fillText(`${(RADAR_WORLD_RANGE / 1000).toFixed(1)}km`, rX + 5, rY + rSize - 6)
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
      '↑/W: 増速  ↓/S: 減速  ←→/A/E: 旋回  D:デバッグ切替  Click: 射撃  1-8:兵装選択',
      12,
      y + 18
    )
  }

  private renderResultOverlay(state: CombatState): void {
    const { ctx, canvas } = this
    const result = state.missionResult

    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const text = result === 'completed' && state.stage === state.maxStage ? 'ALL STAGES CLEAR' :
      result === 'completed' ? 'MISSION COMPLETE' : 'MISSION FAILED'
    const color = result === 'completed' ? '#22c55e' : '#ef4444'

    ctx.font = 'bold 60px monospace'
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    ctx.font = '22px monospace'
    ctx.fillStyle = '#cbd5e1'
    const prompt = result === 'completed' && state.stage < state.maxStage ? 'Press Enter for next stage / R for ship select' :
      result === 'completed' ? 'Press Enter or R for ship select' : 'Press R to restart'
    ctx.fillText(prompt, canvas.width / 2, canvas.height / 2 + 54)
    ctx.textAlign = 'left'
  }
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

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '...'
  let fitted = text
  while (fitted.length > 0 && ctx.measureText(`${fitted}${ellipsis}`).width > maxWidth) {
    fitted = fitted.slice(0, -1)
  }
  return fitted.length > 0 ? `${fitted}${ellipsis}` : ellipsis
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % (Math.PI * 2)
  return Math.min(diff, Math.PI * 2 - diff)
}
