import { MAX_WEAPON_SLOTS, type BuildingEntity, type CombatState, type ShipEntity, type WeaponType, type SpeedLevel } from '../simulation/types'
import { SPEED_LEVEL_LABEL, SPEED_LEVEL_ORDER, KNOTS_PER_UNIT } from '../simulation/movement'
import { getWeaponConfig } from '../simulation/weapon-strategies'
import {
  HULL_SECTION_LABELS,
  HULL_SECTION_ORDER,
  durabilityColor,
  estimateHullSections,
} from './hullstatus'
import { drawAccessKeyHint, isAccessKey } from './accesskeys'

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

  checkAccessKey(e: KeyboardEvent): string | null {
    for (const region of this.clickRegions) {
      const key = accessKeyForClickRegion(region.id)
      if (key && isAccessKey(e, key)) return region.id
    }
    return null
  }

  render(state: CombatState, weaponMode: WeaponMode, worldSize: number, bgmEnabled: boolean, subtitle = '', showAccessKeys = false, autoPilot = false): void {
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    if (!player) return

    this.clickRegions = []
    this.renderTopBar(state, player, weaponMode, bgmEnabled, showAccessKeys, autoPilot)
    this.renderRadar(state, player, worldSize)
    this.renderGlobalMap(state, player, worldSize)
    this.renderBottomBar()
    if (subtitle) this.renderSubtitle(subtitle)
  }

  private renderSubtitle(text: string): void {
    const { ctx, canvas } = this
    const pad = 16
    const barH = 40
    ctx.font = 'bold 17px sans-serif'
    const textW = ctx.measureText(text).width
    const boxW = textW + pad * 2
    const boxH = 34
    const bx = (canvas.width - boxW) / 2
    const by = canvas.height - barH - boxH - 8

    ctx.globalAlpha = 0.82
    ctx.fillStyle = '#020c1a'
    roundRect(ctx, bx, by, boxW, boxH, 6)
    ctx.fill()
    ctx.strokeStyle = '#2563a8'
    ctx.lineWidth = 1.5
    roundRect(ctx, bx, by, boxW, boxH, 6)
    ctx.stroke()
    ctx.globalAlpha = 1.0

    ctx.fillStyle = '#e2f0ff'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, by + boxH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
  }

  private renderTopBar(state: CombatState, player: ShipEntity, weaponMode: WeaponMode, bgmEnabled: boolean, showAccessKeys: boolean, autoPilot = false): void {
    const { ctx, canvas } = this
    const barH = 130
    const coverH = barH + 8
    const pad = 12

    ctx.fillStyle = '#020812'
    ctx.fillRect(0, 0, canvas.width, coverH)

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
      ctx.fillStyle = isSelected ? '#0b2a5f' : '#07111f'
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
      ctx.fillStyle = !weapon ? '#111827' : isAuto ? '#064e2d' : '#172033'
      ctx.strokeStyle = !weapon ? '#334155' : isAuto ? '#22c55e' : '#475569'
      ctx.lineWidth = 1
      roundRect(ctx, btnX, btnY, btnW, btnH, 3)
      ctx.fill(); ctx.stroke()

      ctx.font = 'bold 10px monospace'
      ctx.fillStyle = !weapon ? '#475569' : isAuto ? '#4ade80' : '#64748b'
      ctx.textAlign = 'center'
      ctx.fillText(!weapon ? 'EMPTY' : isAuto ? '● AUTO' : '○ MAN', btnX + btnW / 2, btnY + 11)
      ctx.textAlign = 'left'

      if (weapon) {
        const region = { id: `toggle:${i}`, x: btnX, y: btnY, w: btnW, h: btnH }
        if (showAccessKeys) {
          const key = accessKeyForClickRegion(region.id)
          if (key) drawAccessKeyHint(ctx, key, btnX + 3, btnY - 2)
        }
        this.clickRegions.push(region)
      }
    }

    // ALL AUTO button (to the right of weapon slots)
    const allBtnX = slotsStartX + MAX_WEAPON_SLOTS * slotW + (MAX_WEAPON_SLOTS - 1) * slotGap + sideGap
    const allBtnY = slotY + 20
    const allBtnH = 24
    const allAuto = player.weapons.length > 0 && player.weapons.every(w => w.autoFire)

    ctx.fillStyle = allAuto ? '#064e2d' : '#3b1118'
    ctx.strokeStyle = allAuto ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1.5
    roundRect(ctx, allBtnX, allBtnY, allBtnW, allBtnH, 4)
    ctx.fill(); ctx.stroke()

    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = allAuto ? '#4ade80' : '#f87171'
    ctx.textAlign = 'center'
    ctx.fillText(allAuto ? 'ALL AUTO' : 'ALL MAN', allBtnX + allBtnW / 2, allBtnY + 16)
    ctx.textAlign = 'left'
    const allRegion = { id: 'toggle-all', x: allBtnX, y: allBtnY, w: allBtnW, h: allBtnH }
    if (showAccessKeys) {
      const key = accessKeyForClickRegion(allRegion.id)
      if (key) drawAccessKeyHint(ctx, key, allBtnX + 4, allBtnY + 2)
    }
    this.clickRegions.push(allRegion)

    const bgmBtnY = allBtnY + 32
    ctx.fillStyle = bgmEnabled ? '#12356b' : '#172033'
    ctx.strokeStyle = bgmEnabled ? '#60a5fa' : '#475569'
    ctx.lineWidth = 1.5
    roundRect(ctx, allBtnX, bgmBtnY, allBtnW, allBtnH, 4)
    ctx.fill(); ctx.stroke()

    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = bgmEnabled ? '#93c5fd' : '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText(bgmEnabled ? 'BGM ON' : 'BGM OFF', allBtnX + allBtnW / 2, bgmBtnY + 16)
    ctx.textAlign = 'left'
    const bgmRegion = { id: 'toggle-bgm', x: allBtnX, y: bgmBtnY, w: allBtnW, h: allBtnH }
    if (showAccessKeys) {
      const key = accessKeyForClickRegion(bgmRegion.id)
      if (key) drawAccessKeyHint(ctx, key, allBtnX + 4, bgmBtnY + 2)
    }
    this.clickRegions.push(bgmRegion)

    const navBtnY = bgmBtnY + 32
    ctx.fillStyle = autoPilot ? '#12235a' : '#172033'
    ctx.strokeStyle = autoPilot ? '#818cf8' : '#475569'
    ctx.lineWidth = 1.5
    roundRect(ctx, allBtnX, navBtnY, allBtnW, allBtnH, 4)
    ctx.fill(); ctx.stroke()
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = autoPilot ? '#a5b4fc' : '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText(autoPilot ? '● AUTO NAV' : '○ MAN NAV', allBtnX + allBtnW / 2, navBtnY + 16)
    ctx.textAlign = 'left'
    const navRegion = { id: 'toggle-autopilot', x: allBtnX, y: navBtnY, w: allBtnW, h: allBtnH }
    if (showAccessKeys) {
      const key = accessKeyForClickRegion(navRegion.id)
      if (key) drawAccessKeyHint(ctx, key, allBtnX + 4, navBtnY + 2)
    }
    this.clickRegions.push(navRegion)

    ctx.fillStyle = '#020812'
    ctx.fillRect(0, barH, canvas.width, coverH - barH)
    ctx.strokeStyle = '#0f3d64'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, barH + 0.5)
    ctx.lineTo(canvas.width, barH + 0.5)
    ctx.stroke()
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
    const rY = canvas.height - rSize - 42 - RADAR_PAD  // above bottom bar

    // background
    ctx.fillStyle = '#020812'
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

    // detection range ring
    const detR = (player.detectionRange / RADAR_WORLD_RANGE) * radarR
    ctx.beginPath()
    ctx.arc(cX, cY, detR, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(20,200,160,0.45)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])

    const liveEnemyIds = new Set<string>()
    const knownEnemyIds = new Set<string>(state.enemyContacts.keys())
    for (const entity of state.entities.values()) {
      if (entity.kind !== 'ship') continue
      const ship = entity as ShipEntity
      if (ship.destroyed || ship.team === 'player') continue

      liveEnemyIds.add(ship.id)
      if (!state.detectedByPlayer.has(ship.id)) continue
      knownEnemyIds.add(ship.id)
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
      if (contact.stage !== state.stage || !liveEnemyIds.has(id) || !knownEnemyIds.has(id) || state.tick - contact.tick > RADAR_CONTACT_TICKS || contact.tick > state.tick) {
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
      if (!state.detectedByPlayer.has(building.id)) continue
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

  private renderGlobalMap(state: CombatState, player: ShipEntity, worldSize: number): void {
    const { ctx, canvas } = this
    const mSize = RADAR_SIZE
    const mGap  = 6
    const mX = canvas.width - RADAR_SIZE - RADAR_PAD - mGap - mSize
    const mY = canvas.height - mSize - 42 - RADAR_PAD

    ctx.fillStyle = '#020812'
    ctx.strokeStyle = '#1e4a6a'
    ctx.lineWidth = 1.5
    roundRect(ctx, mX, mY, mSize, mSize, 6)
    ctx.fill(); ctx.stroke()

    ctx.save()
    roundRect(ctx, mX, mY, mSize, mSize, 6)
    ctx.clip()

    const scale = mSize / worldSize
    const toMap = (wx: number, wy: number): [number, number] => [
      mX + wx * scale,
      mY + wy * scale,
    ]

    // grid lines
    ctx.strokeStyle = 'rgba(0,200,80,0.07)'
    ctx.lineWidth = 0.5
    const gridStep = worldSize / 4
    for (let i = 1; i < 4; i++) {
      const gx = mX + i * gridStep * scale
      const gy = mY + i * gridStep * scale
      ctx.beginPath(); ctx.moveTo(gx, mY); ctx.lineTo(gx, mY + mSize); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mX, gy); ctx.lineTo(mX + mSize, gy); ctx.stroke()
    }

    // islands
    for (const land of state.mapObstacles) {
      const [lx, ly] = toMap(land.x, land.y)
      const rx = land.rx * scale
      const ry = land.ry * scale
      ctx.beginPath()
      ctx.ellipse(lx, ly, Math.max(rx, 1.5), Math.max(ry, 1.5), 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(132,204,22,0.35)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(190,242,100,0.55)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // player blip
    const [px, py] = toMap(player.pos.x, player.pos.y)
    ctx.beginPath()
    ctx.arc(px, py, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#60a5fa'
    ctx.fill()

    // heading tick
    const tickLen = 7
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px + Math.cos(player.angle) * tickLen, py + Math.sin(player.angle) * tickLen)
    ctx.strokeStyle = '#93c5fd'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.restore()

    ctx.fillStyle = 'rgba(0,200,80,0.6)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('MAP', mX + mSize - 4, mY + 12)
    ctx.textAlign = 'left'
  }

  private renderBottomBar(): void {
    const { ctx, canvas } = this
    const barH = 40
    const y = canvas.height - barH

    ctx.fillStyle = '#020812'
    ctx.fillRect(0, y, canvas.width, barH)
    ctx.strokeStyle = '#12395a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(canvas.width, y + 0.5)
    ctx.stroke()

    const items: Array<[string, string]> = [
      ['↑ / W', '増速'],
      ['↓ / S', '減速'],
      ['← → / A E', '旋回'],
      ['Click', '射撃'],
      ['1-8', '兵装選択'],
      ['P / Esc', 'ポーズ'],
      ['D', 'デバッグ'],
      ['R', 'タイトル'],
    ]

    let x = 14
    const cy = y + 24
    ctx.textBaseline = 'middle'
    for (const [key, label] of items) {
      ctx.font = 'bold 13px monospace'
      const keyW = ctx.measureText(key).width + 14
      const labelW = ctx.measureText(label).width + 12

      ctx.fillStyle = '#0b2742'
      roundRect(ctx, x, y + 8, keyW, 24, 4)
      ctx.fill()
      ctx.strokeStyle = '#25638c'
      ctx.lineWidth = 1
      roundRect(ctx, x, y + 8, keyW, 24, 4)
      ctx.stroke()

      ctx.fillStyle = '#93c5fd'
      ctx.textAlign = 'center'
      ctx.fillText(key, x + keyW / 2, cy)

      ctx.fillStyle = '#cbd5e1'
      ctx.textAlign = 'left'
      ctx.font = '13px sans-serif'
      ctx.fillText(label, x + keyW + 7, cy)

      x += keyW + labelW + 18
      if (x > canvas.width - 140) break
    }
    ctx.textBaseline = 'alphabetic'
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

function accessKeyForClickRegion(id: string): string | null {
  if (id === 'toggle-all') return 'O'
  if (id === 'toggle-bgm') return 'B'
  if (id === 'toggle-autopilot') return 'N'
  if (id.startsWith('toggle:')) {
    const slot = Number(id.slice(7))
    return slot >= 0 && slot < MAX_WEAPON_SLOTS ? String(slot + 1) : null
  }
  return null
}
