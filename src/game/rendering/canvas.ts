import type { BuildingEntity, CombatEvent, CombatState, Entity, MapObstacle, ShipEntity, ProjectileEntity, Vec3, WeaponState, WeaponType } from '../simulation/types'
import { isOnLand, WORLD_SIZE } from '../simulation/movement'
import { effectiveDetectionRange } from '../simulation/detection'
import { getWeaponConfig } from '../simulation/weapon-strategies'
import { renderShipExplosions } from './effects-renderer'
import { renderProjectile as renderProjectileEntity } from './projectile-renderer'
import { SHIP_DIMS, SHIP_SHAPES, type ShipShapeClass } from './ship-rendering-data'
import { ThreeBattlefieldRenderer } from './three-battlefield-renderer'
import { ShipWakeRenderer } from './wake-renderer'

// Isometric projection parameters
interface IsoParams {
  scale: number    // world units → screen pixels (horizontal component)
  ox: number       // screen origin X (maps world 0,0 → ox, oy in screen)
  oy: number
}

const HUD_TOP    = 134
const HUD_BOTTOM = 32
export type WeatherMode = 'clear' | 'storm'

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private iso: IsoParams = { scale: 0.08, ox: 0, oy: 0 }
  private camX = 5000
  private camY = 5000
  private zoomLevel = 1.0  // ズーム倍率 (1.0 = デフォルト)
  private tiltAngle = 0.6  // カメラ틸ト角度 (ラジアン) - 斜め上から見下ろす角度
  // イベントはシミュレーション毎ティック消去されるためレンダラー側で蓄積
  private effectLog: CombatEvent[] = []
  private effectKeys = new Set<string>()
  private shipWakeRenderer = new ShipWakeRenderer()
  private threeRenderer: ThreeBattlefieldRenderer
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx
    this.threeRenderer = new ThreeBattlefieldRenderer(canvas)
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  setCamera(x: number, y: number): void {
    this.camX = x
    this.camY = y
  }

  setZoom(level: number): void {
    // ズーム範囲: 0.5 (拡大) 〜 2.0 (縮小)
    this.zoomLevel = Math.max(0.5, Math.min(2.0, level))
  }

  getZoom(): number {
    return this.zoomLevel
  }

  setTilt(angle: number): void {
    this.tiltAngle = Math.max(0.3, Math.min(1.2, angle))
  }

  getTilt(): number {
    return this.tiltAngle
  }

  private resize(): void {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.threeRenderer.resize(this.canvas.width, this.canvas.height)
    this.recalcIso()
  }

  private recalcIso(): void {
    const W = this.canvas.width
    const contentH = this.canvas.height - HUD_TOP - HUD_BOTTOM
    // Tactical zoom: keep ships small and show a wider battle area.
    const baseScale = Math.min(W / 6200, contentH / 3500)
    // Apply zoom level (zoomLevel > 1 = zoom in, zoomLevel < 1 = zoom out)
    const scale = baseScale * this.zoomLevel
    this.iso = {
      scale,
      ox: W / 2,
      oy: HUD_TOP + contentH / 2,
    }
  }

  // World → screen (camera-relative isometric with tilt for 3D perspective)
  w2s(wx: number, wy: number): [number, number] {
    const { scale, ox, oy } = this.iso
    const rx = wx - this.camX
    const ry = wy - this.camY
    // Apply tilt angle to create more 3D-like perspective from above
    const tiltFactor = Math.sin(this.tiltAngle)
    return [
      ox + (rx - ry) * scale,
      oy + (rx + ry) * scale * tiltFactor,
    ]
  }

  // Screen → world (inverse isometric with tilt)
  s2w(sx: number, sy: number): [number, number] {
    const { scale, ox, oy } = this.iso
    const tiltFactor = Math.sin(this.tiltAngle)
    const dx = sx - ox
    const dy = sy - oy
    return [
      (dx / scale + dy / (scale * tiltFactor)) / 2 + this.camX,
      (dy / (scale * tiltFactor) - dx / scale) / 2 + this.camY,
    ]
  }

  render(state: CombatState, selectedWeapon?: WeaponState, aimPoint?: Vec3 | null): void {
    this.recalcIso()
    const { ctx } = this
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // 毎ティック消去されるeventLogをレンダラー側で蓄積し、エフェクトを複数フレーム描画できるようにする
    for (const ev of state.eventLog) {
      const key = combatEventEffectKey(ev)
      if (!this.effectKeys.has(key)) {
        this.effectKeys.add(key)
        this.effectLog.push(ev)
      }
    }
    const MAX_EFFECT_AGE = 120
    this.effectLog = this.effectLog.filter(ev => state.tick - ev.tick < MAX_EFFECT_AGE)
    this.effectKeys = new Set(this.effectLog.map(combatEventEffectKey))

    const weather = battlefieldWeather(state)
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    const playerDetectionRange = player ? effectiveDetectionRange(player.detectionRange, state.weather) : 0
    const canSeePosition = (pos: Vec3 | undefined): boolean => (
      !pos || !player || player.destroyed || distanceSq(pos, player.pos) <= playerDetectionRange * playerDetectionRange
    )
    const canSeeEvent = (ev: CombatEvent): boolean => {
      if (ev.position) return canSeePosition(ev.position)
      const source = ev.sourceId ? state.entities.get(ev.sourceId) : undefined
      const target = ev.targetId ? state.entities.get(ev.targetId) : undefined
      return canSeeEntity(source, state, canSeePosition) || canSeeEntity(target, state, canSeePosition)
    }

    const visibleEffects = this.effectLog.filter(canSeeEvent)

    // Depth-sort all non-destroyed ships; then split by visibility
    const allShips = ([...state.entities.values()]
      .filter(e => e.kind === 'ship' && !(e as ShipEntity).destroyed) as ShipEntity[])
      .sort((a, b) => a.pos.y - b.pos.y)

    // Ships visible this tick (player always visible; enemies only if detected)
    const ships = allShips.filter(s =>
      s.team === 'player' || state.detectedByPlayer.has(s.id)
    )

    this.shipWakeRenderer.update(ships, state.tick)

    const projectiles = [...state.entities.values()]
      .filter(e => e.kind === 'projectile' && !(e as ProjectileEntity).destroyed && canSeePosition((e as ProjectileEntity).pos)) as ProjectileEntity[]

    const buildings = ([...state.entities.values()]
      .filter(e => e.kind === 'building' && canSeeEntity(e, state, canSeePosition)) as BuildingEntity[])
      .sort((a, b) => a.pos.y - b.pos.y)

    this.threeRenderer.render(state, ships, weather, this.iso, this.w2s.bind(this))
    this.renderGrid()
    this.renderIslands(state.mapObstacles)

    // Range ellipse for selected weapon
    if (selectedWeapon) {
      const player = state.entities.get('ship.player') as ShipEntity | undefined
      if (player && !player.destroyed) this.renderRangeEllipse(player, selectedWeapon)
    }

    this.renderWaterSplashes(visibleEffects, state.tick, state.mapObstacles)
    for (const b of buildings)   this.renderBuilding(b)
    for (const p of projectiles) this.renderProjectile(p)
    this.renderMuzzleBursts(visibleEffects, state.tick)
    this.shipWakeRenderer.render(this.ctx, this.iso, this.w2s.bind(this), ships, state.tick)
    this.renderShipFires(ships, state.tick)
    this.renderShipStatusOverlays(ships)
    this.renderLandDust(visibleEffects, state.tick, state.entities, state.mapObstacles)
    renderShipExplosions(this.ctx, this.iso, this.w2s.bind(this), visibleEffects, state.tick, state.entities)
    this.renderTacticalAtmosphere(weather)

    // Fog of war + detection boundary
    this.renderDetectionFog(state)

    // Ghost blips for recently-detected enemies now out of visual range
    this.renderEnemyGhosts(state)

    if (selectedWeapon && aimPoint) {
      const player = state.entities.get('ship.player') as ShipEntity | undefined
      if (player && !player.destroyed) this.renderAimPointer(player, selectedWeapon, aimPoint, state.mapObstacles)
    }

  }

  // ── water splashes ─────────────────────────────────────────────────────────

  private static readonly SPLASH_TICKS = 40
  private static readonly DUST_TICKS = 46

  private renderWaterSplashes(events: CombatEvent[], tick: number, obstacles: readonly MapObstacle[]): void {
    const { ctx } = this
    const D = CanvasRenderer.SPLASH_TICKS

    for (const ev of events) {
      if (ev.type !== 'weapon.missed' || !ev.position) continue
      if (isOnLand(ev.position.x, ev.position.y, obstacles)) continue
      const age = tick - ev.tick
      if (age < 0 || age >= D) continue

      const t   = age / D
      const pos = ev.position
      const wtype = weaponTypeFromId(ev.weaponId)
      const s   = this.iso.scale
      const [cx, cy] = this.w2s(pos.x, pos.y)

      // Weapon-specific sizing (world units)
      const maxR = wtype === 'torpedo' ? 190 : wtype === 'missile' ? 150 : wtype === 'gun' ? 85 : wtype === 'secondary' ? 65 : 42
      const N    = wtype === 'torpedo' ? 22  : wtype === 'missile' ? 16  : wtype === 'gun' ? 12 : wtype === 'secondary' ? 9 : 7
      const ringColor =
        wtype === 'torpedo' ? '100,195,255' :
        wtype === 'missile' ? '180,215,255' : '170,228,255'

      // Soft underwater shadow / pressure bloom below the splash.
      if (t < 0.70) {
        const bloomT = Math.min(1, t / 0.70)
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1.45, 0.58)
        const bloomR = maxR * s * (0.18 + bloomT * 0.88)
        const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomR)
        bloom.addColorStop(0, `rgba(210,242,255,${(1 - bloomT) * 0.28})`)
        bloom.addColorStop(0.55, `rgba(95,180,230,${(1 - bloomT) * 0.16})`)
        bloom.addColorStop(1, 'rgba(40,100,160,0)')
        ctx.beginPath()
        ctx.arc(0, 0, bloomR, 0, Math.PI * 2)
        ctx.fillStyle = bloom
        ctx.fill()
        ctx.restore()
      }

      // ── 1. Impact flash (t < 0.10) ──────────────────────────
      if (t < 0.10) {
        const ft = t / 0.10
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1, 0.5)
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR * s * Math.SQRT2 * 0.55)
        gr.addColorStop(0,   `rgba(255,255,255,${(1 - ft) * 0.95})`)
        gr.addColorStop(0.5, `rgba(210,242,255,${(1 - ft) * 0.6})`)
        gr.addColorStop(1,   'rgba(200,238,255,0)')
        ctx.beginPath()
        ctx.arc(0, 0, maxR * s * Math.SQRT2 * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = gr
        ctx.fill()
        ctx.restore()
      }

      // ── 2. Water column (t < 0.48) ──────────────────────────
      if (t < 0.48) {
        const ct     = t / 0.48
        const colH   = maxR * s * 2.2 * Math.sin(Math.PI * ct)
        const colWBot = maxR * s * 0.20
        const colWTop = maxR * s * 0.06 * (1 - ct * 0.7)
        const colA   = (1 - ct) * 0.80

        const grad = ctx.createLinearGradient(cx, cy, cx, cy - colH)
        grad.addColorStop(0,   `rgba(200,235,255,${colA})`)
        grad.addColorStop(0.5, `rgba(225,245,255,${colA * 0.75})`)
        grad.addColorStop(1,   'rgba(240,250,255,0)')

        ctx.beginPath()
        ctx.moveTo(cx - colWBot, cy)
        ctx.bezierCurveTo(
          cx - colWTop * 2, cy - colH * 0.4,
          cx - colWTop,     cy - colH * 0.8,
          cx,               cy - colH,
        )
        ctx.bezierCurveTo(
          cx + colWTop,     cy - colH * 0.8,
          cx + colWTop * 2, cy - colH * 0.4,
          cx + colWBot,     cy,
        )
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()

        // Crown ring at column base
        const crownR = maxR * 0.28 * (1 + ct * 0.5)
        ctx.beginPath()
        const CR = 32
        for (let i = 0; i <= CR; i++) {
          const a = (i / CR) * Math.PI * 2
          const [rx, ry] = this.w2s(pos.x + Math.cos(a) * crownR, pos.y + Math.sin(a) * crownR)
          i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry)
        }
        ctx.strokeStyle = `rgba(200,238,255,${colA * 0.6})`
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Torn side sheets of water, asymmetric so it feels less like a perfect icon.
        const sheetCount = wtype === 'aa' ? 4 : wtype === 'gun' ? 7 : 10
        for (let i = 0; i < sheetCount; i++) {
          const n = signedNoise(pos.x, pos.y, i)
          const side = i % 2 === 0 ? -1 : 1
          const spread = (0.20 + Math.abs(n) * 0.50) * maxR * s
          const height = colH * (0.18 + Math.abs(signedNoise(pos.y, pos.x, i + 11)) * 0.32)
          const x0 = cx + side * colWBot * (0.55 + i / sheetCount)
          const x1 = cx + side * spread
          const y1 = cy - height
          ctx.beginPath()
          ctx.moveTo(x0, cy)
          ctx.quadraticCurveTo(cx + side * spread * 0.35, cy - height * 0.85, x1, y1)
          ctx.strokeStyle = `rgba(225,246,255,${colA * (0.28 + Math.abs(n) * 0.26)})`
          ctx.lineWidth = Math.max(0.6, maxR * s * 0.012 * (1 - ct))
          ctx.stroke()
        }
      }

      // ── 3. Spray particles ──────────────────────────────────
      const peakH = maxR * s * 1.9
      const seed  = Math.sin(pos.x * 0.0031 + pos.y * 0.0019) * 1.2

      for (let i = 0; i < N; i++) {
        const angle       = (i / N) * Math.PI * 2 + seed
        const speedFactor = 0.50 + 0.50 * Math.abs(Math.sin(i * 2.39))
        const horizT      = Math.min(1, t * 2.0) * speedFactor
        const vertT       = Math.min(1, t * 1.6) * speedFactor

        const [px, pyBase] = this.w2s(
          pos.x + Math.cos(angle) * maxR * horizT,
          pos.y + Math.sin(angle) * maxR * horizT,
        )
        const arcH = peakH * Math.sin(Math.PI * Math.min(1, vertT)) * speedFactor
        const py   = pyBase - arcH
        const alpha = Math.max(0, (1 - t * 1.15) * 0.88)
        const dotR  = Math.max(0.7, maxR * s * 0.048 * (1 - t * 0.55))

        ctx.beginPath()
        ctx.arc(px, py, dotR, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(215,240,255,${alpha})`
        ctx.fill()

        // Thin trail line from base to particle
        if (arcH > 4 && t < 0.45) {
          ctx.beginPath()
          ctx.moveTo(px, pyBase)
          ctx.lineTo(px, py)
          ctx.strokeStyle = `rgba(200,235,255,${alpha * 0.25})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }

      // Fine mist cloud that lingers after the hard water column collapses.
      if (t > 0.05 && t < 0.80) {
        const mt = (t - 0.05) / 0.75
        const mistCount = wtype === 'aa' ? 8 : wtype === 'gun' ? 18 : 28
        for (let i = 0; i < mistCount; i++) {
          const a = signedNoise(pos.x + 31, pos.y - 17, i) * Math.PI
          const r = maxR * (0.10 + Math.abs(signedNoise(pos.y, pos.x, i + 23)) * 0.82) * Math.min(1, mt * 1.8)
          const [mx, myBase] = this.w2s(pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r)
          const lift = peakH * (0.15 + Math.abs(signedNoise(pos.x, pos.y, i + 41)) * 0.50) * Math.sin(Math.PI * Math.min(1, mt))
          const radius = Math.max(0.5, maxR * s * (0.015 + Math.abs(signedNoise(pos.x, pos.y, i + 59)) * 0.020))
          const alpha = Math.max(0, (1 - mt) * 0.22)

          ctx.beginPath()
          ctx.arc(mx, myBase - lift, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(235,248,255,${alpha})`
          ctx.fill()
        }
      }

      // ── 4. Wave rings (isometric, via w2s) ──────────────────
      const rings = wtype === 'torpedo' ? 4 : wtype === 'missile' ? 3 : 2
      const STEPS = 40

      for (let ri = 0; ri < rings; ri++) {
        const delay = ri * 0.17
        const rt    = Math.max(0, (t - delay) / (1 - delay))
        if (rt <= 0) continue

        const worldRt = maxR * rt
        const alpha   = (1 - rt) * (ri === 0 ? 0.90 : 0.55)
        const lw      = Math.max(0.3, (3.0 - ri * 0.8) * (1 - rt * 0.55))

        ctx.beginPath()
        for (let i = 0; i <= STEPS; i++) {
          const a = (i / STEPS) * Math.PI * 2
          const [rx, ry] = this.w2s(pos.x + Math.cos(a) * worldRt, pos.y + Math.sin(a) * worldRt)
          i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry)
        }
        ctx.closePath()
        ctx.strokeStyle = `rgba(${ringColor},${alpha})`
        ctx.lineWidth   = lw
        ctx.stroke()
      }

      // ── 5. Foam scatter (settling droplets, late phase) ──────
      if (t > 0.18) {
        const ft  = (t - 0.18) / 0.82
        const Nf  = Math.round(N * 0.75)
        for (let i = 0; i < Nf; i++) {
          const fAngle = (i / Nf) * Math.PI * 2 + i * 0.18
          const fr     = maxR * (0.15 + 0.75 * Math.abs(Math.sin(i * 1.73 + 0.5)))
          const [fx, fy] = this.w2s(pos.x + Math.cos(fAngle) * fr, pos.y + Math.sin(fAngle) * fr)
          const fAlpha   = Math.max(0, (1 - ft) * 0.40)
          const fR       = Math.max(0.5, maxR * s * 0.030)
          ctx.beginPath()
          ctx.arc(fx, fy, fR, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(225,242,255,${fAlpha})`
          ctx.fill()

          // Short foam streaks aligned with the ripple flow.
          if (i % 2 === 0) {
            const [fx2, fy2] = this.w2s(
              pos.x + Math.cos(fAngle) * (fr + maxR * 0.09),
              pos.y + Math.sin(fAngle) * (fr + maxR * 0.09),
            )
            ctx.beginPath()
            ctx.moveTo(fx, fy)
            ctx.lineTo(fx2, fy2)
            ctx.strokeStyle = `rgba(225,242,255,${fAlpha * 0.55})`
            ctx.lineWidth = Math.max(0.4, maxR * s * 0.006)
            ctx.stroke()
          }
        }
      }
    }
  }

  // ── land dust ─────────────────────────────────────────────────────────────

  private renderLandDust(events: CombatEvent[], tick: number, entities: Map<string, Entity>, obstacles: readonly MapObstacle[]): void {
    const { ctx } = this
    const D = CanvasRenderer.DUST_TICKS

    for (const ev of events) {
      if (!ev.position) continue

      const target = ev.targetId ? entities.get(ev.targetId) : undefined
      const isLandImpact =
        (ev.type === 'weapon.missed' && isOnLand(ev.position.x, ev.position.y, obstacles)) ||
        (ev.type === 'weapon.hit' && target?.kind === 'building')
      if (!isLandImpact) continue

      const age = tick - ev.tick
      if (age < 0 || age >= D) continue

      const t = age / D
      const pos = ev.position
      const s = this.iso.scale
      const [cx, cy] = this.w2s(pos.x, pos.y)
      const wtype = weaponTypeFromId(ev.weaponId)
      const maxR = impactWorldRadius(wtype) * 0.82

      if (t < 0.18) {
        const ft = t / 0.18
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1.35, 0.55)
        const flashR = maxR * s * (0.18 + ft * 0.45)
        const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR)
        flash.addColorStop(0, `rgba(255,245,190,${(1 - ft) * 0.75})`)
        flash.addColorStop(0.45, `rgba(232,154,74,${(1 - ft) * 0.32})`)
        flash.addColorStop(1, 'rgba(232,154,74,0)')
        ctx.beginPath()
        ctx.arc(0, 0, flashR, 0, Math.PI * 2)
        ctx.fillStyle = flash
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1.48, 0.64)
      const groundR = maxR * s * (0.20 + t * 0.90)
      const ground = ctx.createRadialGradient(0, 0, 0, 0, 0, groundR)
      ground.addColorStop(0, `rgba(96,74,48,${(1 - t) * 0.36})`)
      ground.addColorStop(0.62, `rgba(148,112,75,${(1 - t) * 0.22})`)
      ground.addColorStop(1, 'rgba(148,112,75,0)')
      ctx.beginPath()
      ctx.arc(0, 0, groundR, 0, Math.PI * 2)
      ctx.fillStyle = ground
      ctx.fill()
      ctx.restore()

      const puffCount = wtype === 'missile' ? 22 : wtype === 'torpedo' ? 16 : wtype === 'gun' ? 14 : wtype === 'secondary' ? 11 : 8
      for (let i = 0; i < puffCount; i++) {
        const n = Math.abs(signedNoise(pos.x, pos.y, i + 190))
        const a = (i / puffCount) * Math.PI * 2 + signedNoise(pos.y, pos.x, i + 203) * 0.65
        const spread = maxR * (0.10 + n * 0.88) * Math.min(1, t * 1.7)
        const [px, pyBase] = this.w2s(pos.x + Math.cos(a) * spread, pos.y + Math.sin(a) * spread)
        const lift = maxR * s * (0.18 + n * 0.62) * Math.sin(Math.PI * Math.min(1, t * 1.15))
        const r = Math.max(1.4, maxR * s * (0.026 + n * 0.050) * (1 - t * 0.28))
        const alpha = Math.max(0, (1 - t) * (0.28 + n * 0.24))
        ctx.beginPath()
        ctx.arc(px, pyBase - lift, r, 0, Math.PI * 2)
        ctx.fillStyle = i % 3 === 0 ? `rgba(64,58,51,${alpha})` : `rgba(153,126,90,${alpha})`
        ctx.fill()
      }
    }
  }

  private renderMuzzleBursts(events: CombatEvent[], tick: number): void {
    const { ctx } = this
    const D = 9

    for (const ev of events) {
      if (ev.type !== 'weapon.fired' || !ev.position) continue
      const age = tick - ev.tick
      if (age < 0 || age >= D) continue

      const t = age / D
      const [cx, cy] = this.w2s(ev.position.x, ev.position.y)
      const isTorpedo = ev.weaponId?.includes('torpedo') ?? false
      if (isTorpedo) {
        const target = ev.targetPosition ?? { x: ev.position.x + 1, y: ev.position.y, z: 0 }
        const dx = target.x - ev.position.x
        const dy = target.y - ev.position.y
        const len = Math.hypot(dx, dy) || 1
        const wakeStart = this.w2s(ev.position.x - (dx / len) * 42, ev.position.y - (dy / len) * 42)
        const wakeEnd = this.w2s(ev.position.x + (dx / len) * 28, ev.position.y + (dy / len) * 28)

        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(wakeStart[0], wakeStart[1])
        ctx.lineTo(wakeEnd[0], wakeEnd[1])
        ctx.strokeStyle = `rgba(159,232,255,${(1 - t) * 0.82})`
        ctx.lineWidth = Math.max(1.4, 8 * this.iso.scale * (1 - t * 0.25))
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(cx, cy, Math.max(2, 18 * this.iso.scale * (1 + t)), Math.max(1, 7 * this.iso.scale * (1 + t)), -Math.PI * 0.2, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(221,250,255,${(1 - t) * 0.70})`
        ctx.lineWidth = Math.max(0.8, 2.5 * this.iso.scale)
        ctx.stroke()
        ctx.restore()
        continue
      }

      const isMissile  = ev.weaponId?.includes('missile')   ?? false
      const isAa       = ev.weaponId?.includes('aa')        ?? false
      const isSecondary = ev.weaponId?.includes('secondary') ?? false
      const r = (isMissile ? 38 : isAa ? 18 : isSecondary ? 22 : 28) * this.iso.scale * (1 + t * 1.5)

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1.35, 0.55)
      const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(3, r))
      flash.addColorStop(0, `rgba(255,244,160,${(1 - t) * 0.95})`)
      flash.addColorStop(0.42, `rgba(255,184,45,${(1 - t) * 0.55})`)
      flash.addColorStop(1, 'rgba(255,184,45,0)')
      ctx.beginPath()
      ctx.arc(0, 0, Math.max(3, r), 0, Math.PI * 2)
      ctx.fillStyle = flash
      ctx.fill()
      ctx.restore()
    }
  }

  // ── ocean ──────────────────────────────────────────────────────────────────

  private renderOcean(tick: number, weather: WeatherMode): void {
    const { ctx } = this
    ctx.fillStyle = weather === 'storm' ? '#05090d' : '#a8daf2'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    if (weather === 'storm') this.renderCloudDeck(tick)
    else this.renderClearSky(tick)

    // World diamond fill
    const corners = [
      this.w2s(0, 0),
      this.w2s(WORLD_SIZE, 0),
      this.w2s(WORLD_SIZE, WORLD_SIZE),
      this.w2s(0, WORLD_SIZE),
    ] as [number, number][]

    ctx.beginPath()
    ctx.moveTo(...corners[0]!)
    for (const c of corners.slice(1)) ctx.lineTo(...c)
    ctx.closePath()

    const [cx0, cy0] = corners[0]!
    const [cx2, cy2] = corners[2]!
    const grad = ctx.createLinearGradient(cx0, cy0, cx2, cy2)
    if (weather === 'storm') {
      grad.addColorStop(0, '#0a2b44')
      grad.addColorStop(0.42, '#071d33')
      grad.addColorStop(1, '#03111f')
    } else {
      grad.addColorStop(0, '#2388b6')
      grad.addColorStop(0.45, '#176c9a')
      grad.addColorStop(1, '#0f4e7d')
    }
    ctx.fillStyle = grad
    ctx.fill()

    ctx.strokeStyle = weather === 'storm' ? 'rgba(130,185,205,0.18)' : 'rgba(218,246,255,0.35)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    this.renderWaveField(tick, weather)
    this.renderSurfaceGrain(weather)
  }

  private renderClearSky(tick: number): void {
    const { ctx, canvas } = this
    const battleTop = HUD_TOP
    const battleH = canvas.height - HUD_TOP - HUD_BOTTOM
    const skyGrad = ctx.createLinearGradient(0, battleTop, 0, battleTop + battleH * 0.45)
    skyGrad.addColorStop(0, 'rgba(157,215,242,0.88)')
    skyGrad.addColorStop(0.52, 'rgba(106,183,224,0.42)')
    skyGrad.addColorStop(1, 'rgba(78,157,204,0)')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, battleTop, canvas.width, battleH * 0.50)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const sunX = canvas.width * 0.18 + Math.sin(tick * 0.003) * 12
    const sunY = battleTop + battleH * 0.11
    const sunR = Math.max(canvas.width, canvas.height) * 0.34
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
    sun.addColorStop(0, 'rgba(255,244,184,0.34)')
    sun.addColorStop(0.25, 'rgba(255,235,153,0.16)')
    sun.addColorStop(1, 'rgba(255,245,190,0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, battleTop, canvas.width, battleH * 0.62)

    for (let i = 0; i < 9; i++) {
      const x = ((signedNoise(i * 9.7, this.camX * 0.0004 + tick * 0.001, 3200) * 0.5 + 0.5) * canvas.width * 1.12) - canvas.width * 0.06
      const y = battleTop + battleH * (0.08 + Math.abs(signedNoise(i, this.camY * 0.0006, 3210)) * 0.18)
      const w = canvas.width * (0.10 + Math.abs(signedNoise(i, tick * 0.001, 3220)) * 0.10)
      const h = battleH * (0.025 + Math.abs(signedNoise(i, this.camX * 0.001, 3230)) * 0.025)
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h))
      cloud.addColorStop(0, 'rgba(255,255,255,0.16)')
      cloud.addColorStop(0.62, 'rgba(242,250,255,0.08)')
      cloud.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, h / w)
      ctx.beginPath()
      ctx.arc(0, 0, w, 0, Math.PI * 2)
      ctx.fillStyle = cloud
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  private renderCloudDeck(tick: number): void {
    const { ctx, canvas } = this
    const battleTop = HUD_TOP
    const battleH = canvas.height - HUD_TOP - HUD_BOTTOM
    const skyGrad = ctx.createLinearGradient(0, battleTop, 0, battleTop + battleH * 0.45)
    skyGrad.addColorStop(0, 'rgba(17,24,32,0.92)')
    skyGrad.addColorStop(0.48, 'rgba(31,39,47,0.54)')
    skyGrad.addColorStop(1, 'rgba(10,16,24,0)')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, battleTop, canvas.width, battleH * 0.52)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 18; i++) {
      const x = ((signedNoise(i * 13.1, this.camX * 0.0007 + tick * 0.002, 2200) * 0.5 + 0.5) * canvas.width * 1.25) - canvas.width * 0.12
      const y = battleTop + (signedNoise(i * 7.3, this.camY * 0.0009, 2210) * 0.5 + 0.5) * battleH * 0.24
      const w = canvas.width * (0.16 + Math.abs(signedNoise(i, tick * 0.001, 2220)) * 0.18)
      const h = battleH * (0.045 + Math.abs(signedNoise(i, this.camX * 0.001, 2230)) * 0.06)
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h))
      cloud.addColorStop(0, 'rgba(118,132,142,0.11)')
      cloud.addColorStop(0.55, 'rgba(76,88,99,0.07)')
      cloud.addColorStop(1, 'rgba(32,38,46,0)')
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, h / w)
      ctx.beginPath()
      ctx.arc(0, 0, w, 0, Math.PI * 2)
      ctx.fillStyle = cloud
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  private renderWaveField(tick: number, weather: WeatherMode): void {
    const { ctx, canvas } = this
    const battleTop = HUD_TOP
    const battleBottom = canvas.height - HUD_BOTTOM
    const waveCount = Math.round((canvas.width * (battleBottom - battleTop)) / 14500)

    ctx.save()
    ctx.lineCap = 'round'
    for (let i = 0; i < waveCount; i++) {
      const nx = signedNoise(this.camX * 0.002 + tick * 0.018, i * 3.17, 1800)
      const ny = signedNoise(this.camY * 0.002 - tick * 0.014, i * 4.11, 1810)
      const x = (nx * 0.5 + 0.5) * canvas.width
      const y = battleTop + (ny * 0.5 + 0.5) * (battleBottom - battleTop)
      const len = 16 + Math.abs(signedNoise(i, this.camX * 0.003, 1820)) * 44
      const tilt = -0.28 + signedNoise(i, this.camY * 0.003, 1830) * 0.20
      const alphaBase = weather === 'storm' ? 0.05 : 0.08
      const alphaRange = weather === 'storm' ? 0.12 : 0.16
      const alpha = alphaBase + Math.abs(signedNoise(i, tick * 0.01, 1840)) * alphaRange

      ctx.beginPath()
      ctx.moveTo(x - len * 0.5, y - tilt * len * 0.5)
      ctx.quadraticCurveTo(x, y - 2.5, x + len * 0.5, y + tilt * len * 0.5)
      ctx.strokeStyle = i % 5 === 0
        ? `rgba(244,253,255,${alpha * 1.45})`
        : weather === 'storm' ? `rgba(132,183,204,${alpha})` : `rgba(178,232,246,${alpha})`
      ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.7
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'multiply'
    for (let y = battleTop; y < battleBottom; y += 18) {
      const a = (weather === 'storm' ? 0.035 : 0.018) + Math.sin(y * 0.05 + tick * 0.025) * 0.010
      ctx.fillStyle = `rgba(1,8,14,${a})`
      ctx.fillRect(0, y, canvas.width, 8)
    }
    ctx.restore()
  }

  private renderGrid(): void {
    const { ctx } = this
    ctx.strokeStyle = 'rgba(120,210,255,0.11)'
    ctx.lineWidth = 0.45
    const step = 500
    for (let i = 0; i <= WORLD_SIZE; i += step) {
      const [ax, ay] = this.w2s(i, 0)
      const [bx, by] = this.w2s(i, WORLD_SIZE)
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      const [cx, cy] = this.w2s(0, i)
      const [dx, dy] = this.w2s(WORLD_SIZE, i)
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke()
    }
  }

  private renderSurfaceGrain(weather: WeatherMode): void {
    const { ctx } = this
    const count = Math.round((this.canvas.width * this.canvas.height) / 5200)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < count; i++) {
      const nx = signedNoise(this.camX * 0.013, this.camY * 0.017, i + 500)
      const ny = signedNoise(this.camY * 0.011, this.camX * 0.019, i + 900)
      const x = (nx * 0.5 + 0.5) * this.canvas.width
      const y = HUD_TOP + (ny * 0.5 + 0.5) * (this.canvas.height - HUD_TOP - HUD_BOTTOM)
      const a = (weather === 'storm' ? 0.025 : 0.018) + Math.abs(signedNoise(this.camX, this.camY, i + 1300)) * (weather === 'storm' ? 0.055 : 0.040)
      ctx.fillStyle = i % 4 === 0 ? `rgba(234,252,255,${a})` : `rgba(128,213,240,${a})`
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1)
    }
    ctx.restore()
  }

  // ── island and buildings ──────────────────────────────────────────────────

  private renderIslands(obstacles: readonly MapObstacle[]): void {
    for (const obstacle of obstacles) this.renderIsland(obstacle)
  }

  private renderIsland(obstacle: MapObstacle): void {
    if (obstacle.points && obstacle.points.length >= 3) {
      this.renderIslandPoly(obstacle)
    } else {
      this.renderIslandEllipse(obstacle)
    }
  }

  private renderIslandEllipse(obstacle: MapObstacle): void {
    const { ctx } = this
    const steps = 72
    const shoreline: [number, number][] = []
    const beach: [number, number][] = []
    const grass: [number, number][] = []

    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const n1 = signedNoise(obstacle.x, obstacle.y, i)
      const n2 = signedNoise(obstacle.y, obstacle.x, i + 19)
      const r = 1 + n1 * 0.08 + n2 * 0.04
      shoreline.push(this.w2s(
        obstacle.x + Math.cos(a) * obstacle.rx * r,
        obstacle.y + Math.sin(a) * obstacle.ry * r,
      ))
      beach.push(this.w2s(
        obstacle.x + Math.cos(a) * obstacle.rx * 0.91 * r,
        obstacle.y + Math.sin(a) * obstacle.ry * 0.91 * r,
      ))
      grass.push(this.w2s(
        obstacle.x + Math.cos(a) * obstacle.rx * 0.74 * r,
        obstacle.y + Math.sin(a) * obstacle.ry * 0.74 * r,
      ))
    }

    drawClosedPath(ctx, shoreline)
    ctx.fillStyle = 'rgba(212,176,92,0.52)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(225,240,220,0.34)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    drawClosedPath(ctx, beach)
    const beachGrad = ctx.createLinearGradient(0, this.canvas.height * 0.35, 0, this.canvas.height * 0.72)
    beachGrad.addColorStop(0, '#d8bd73')
    beachGrad.addColorStop(1, '#8c7441')
    ctx.fillStyle = beachGrad
    ctx.fill()

    drawClosedPath(ctx, grass)
    const grassGrad = ctx.createLinearGradient(0, this.canvas.height * 0.30, 0, this.canvas.height * 0.78)
    grassGrad.addColorStop(0, '#597f3d')
    grassGrad.addColorStop(0.55, '#335f36')
    grassGrad.addColorStop(1, '#1d3f2e')
    ctx.fillStyle = grassGrad
    ctx.fill()

    for (let i = 0; i < 11; i++) {
      const px = obstacle.x + signedNoise(obstacle.x, obstacle.y, i + 100) * obstacle.rx * 0.42
      const py = obstacle.y + signedNoise(obstacle.y, obstacle.x, i + 130) * obstacle.ry * 0.34
      const [sx, sy] = this.w2s(px, py)
      ctx.save()
      ctx.translate(sx, sy)
      ctx.scale(1.5, 0.62)
      ctx.beginPath()
      ctx.arc(0, 0, (45 + Math.abs(signedNoise(px, py, i)) * 45) * this.iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = i % 3 === 0 ? 'rgba(104,132,74,0.28)' : 'rgba(38,77,44,0.30)'
      ctx.fill()
      ctx.restore()
    }

    for (let i = 0; i < steps; i += 6) {
      const a = (i / steps) * Math.PI * 2
      const [x0, y0] = this.w2s(obstacle.x + Math.cos(a) * obstacle.rx * 1.03, obstacle.y + Math.sin(a) * obstacle.ry * 1.03)
      const [x1, y1] = this.w2s(obstacle.x + Math.cos(a + 0.10) * obstacle.rx * 1.03, obstacle.y + Math.sin(a + 0.10) * obstacle.ry * 1.03)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.strokeStyle = 'rgba(220,245,255,0.26)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }

  private renderIslandPoly(obstacle: MapObstacle): void {
    const { ctx } = this
    const pts = obstacle.points!
    const cx = obstacle.x
    const cy = obstacle.y

    // Build screen-space point array with optional inward scaling and a small noise perturbation.
    const screenLayer = (factor: number): [number, number][] =>
      pts.map((p, i) => {
        const n = signedNoise(p.x * 0.0015, p.y * 0.0015, i + 37) * 0.04
        return this.w2s(
          cx + (p.x - cx) * factor * (1 + n),
          cy + (p.y - cy) * factor * (1 + n),
        ) as [number, number]
      })

    const shoreline = screenLayer(1.0)
    const beach     = screenLayer(0.91)
    const grass     = screenLayer(0.74)

    drawSmoothClosedPath(ctx, shoreline)
    ctx.fillStyle = 'rgba(212,176,92,0.52)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(225,240,220,0.34)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    drawSmoothClosedPath(ctx, beach)
    const beachGrad = ctx.createLinearGradient(0, this.canvas.height * 0.35, 0, this.canvas.height * 0.72)
    beachGrad.addColorStop(0, '#d8bd73')
    beachGrad.addColorStop(1, '#8c7441')
    ctx.fillStyle = beachGrad
    ctx.fill()

    drawSmoothClosedPath(ctx, grass)
    const grassGrad = ctx.createLinearGradient(0, this.canvas.height * 0.30, 0, this.canvas.height * 0.78)
    grassGrad.addColorStop(0, '#597f3d')
    grassGrad.addColorStop(0.55, '#335f36')
    grassGrad.addColorStop(1, '#1d3f2e')
    ctx.fillStyle = grassGrad
    ctx.fill()

    for (let i = 0; i < 11; i++) {
      const px = cx + signedNoise(cx, cy, i + 100) * obstacle.rx * 0.42
      const py = cy + signedNoise(cy, cx, i + 130) * obstacle.ry * 0.34
      const [sx, sy] = this.w2s(px, py)
      ctx.save()
      ctx.translate(sx, sy)
      ctx.scale(1.5, 0.62)
      ctx.beginPath()
      ctx.arc(0, 0, (45 + Math.abs(signedNoise(px, py, i)) * 45) * this.iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = i % 3 === 0 ? 'rgba(104,132,74,0.28)' : 'rgba(38,77,44,0.30)'
      ctx.fill()
      ctx.restore()
    }

    // Surf strokes along each polygon edge.
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i]!
      const p1 = pts[(i + 1) % pts.length]!
      const [x0, y0] = this.w2s(cx + (p0.x - cx) * 1.03, cy + (p0.y - cy) * 1.03)
      const [x1, y1] = this.w2s(cx + (p1.x - cx) * 1.03, cy + (p1.y - cy) * 1.03)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.strokeStyle = 'rgba(220,245,255,0.26)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }

  private renderBuilding(building: BuildingEntity): void {
    if (building.destroyed) {
      this.renderRuins(building)
      return
    }

    const { ctx, iso } = this
    const [cx, cy] = this.w2s(building.pos.x, building.pos.y)
    const hpRatio = building.hp / building.maxHp
    const spec = building.templateId.includes('radar')
      ? { w: 48, d: 42, h: 130, top: '#94a3b8', side: '#475569' }
      : building.templateId.includes('depot')
        ? { w: 130, d: 92, h: 54, top: '#9a3412', side: '#5c1f0a' }
        : { w: 112, d: 82, h: 72, top: '#78716c', side: '#44403c' }

    this.drawIsoBox(building.pos.x, building.pos.y, spec.w, spec.d, spec.h, spec.top, spec.side)

    if (building.templateId.includes('radar')) {
      const mastTop = cy - spec.h * iso.scale
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = Math.max(1, 2 * iso.scale)
      ctx.beginPath()
      ctx.moveTo(cx, cy - 8 * iso.scale)
      ctx.lineTo(cx, mastTop)
      ctx.stroke()
      ctx.save()
      ctx.translate(cx, mastTop)
      ctx.scale(1.7, 0.55)
      ctx.beginPath()
      ctx.arc(0, 0, 34 * iso.scale, 0, Math.PI * 2)
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = Math.max(1, 2.4 * iso.scale)
      ctx.stroke()
      ctx.restore()
    }

    const barW = Math.max(18, building.radius * iso.scale * 1.4)
    const barY = cy - spec.h * iso.scale - 13
    ctx.fillStyle = 'rgba(0,0,0,0.62)'
    ctx.fillRect(cx - barW / 2 - 1, barY - 1, barW + 2, 5)
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444'
    ctx.fillRect(cx - barW / 2, barY, barW * hpRatio, 3)
  }

  private renderRuins(building: BuildingEntity): void {
    const { ctx, iso } = this
    const [cx, cy] = this.w2s(building.pos.x, building.pos.y)
    const r = building.radius * iso.scale

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1.35, 0.55)
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(40,32,28,0.55)'
    ctx.fill()
    ctx.restore()

    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + signedNoise(building.pos.x, building.pos.y, i) * 0.5
      const dist = r * (0.25 + Math.abs(signedNoise(building.pos.y, building.pos.x, i + 8)) * 0.9)
      const x = cx + Math.cos(a) * dist
      const y = cy + Math.sin(a) * dist * 0.45
      const size = Math.max(2, r * (0.12 + Math.abs(signedNoise(building.pos.x, building.pos.y, i + 14)) * 0.14))
      ctx.fillStyle = i % 2 === 0 ? '#57534e' : '#292524'
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
    }
  }

  private drawIsoBox(wx: number, wy: number, w: number, d: number, h: number, top: string, side: string): void {
    const { ctx, iso } = this
    const hw = w / 2
    const hd = d / 2
    const hPx = h * iso.scale
    const base = [
      this.w2s(wx - hw, wy - hd),
      this.w2s(wx + hw, wy - hd),
      this.w2s(wx + hw, wy + hd),
      this.w2s(wx - hw, wy + hd),
    ] as [number, number][]
    const roof = base.map(([x, y]) => [x, y - hPx]) as [number, number][]

    ctx.beginPath()
    ctx.moveTo(base[1]![0], base[1]![1])
    ctx.lineTo(base[2]![0], base[2]![1])
    ctx.lineTo(roof[2]![0], roof[2]![1])
    ctx.lineTo(roof[1]![0], roof[1]![1])
    ctx.closePath()
    ctx.fillStyle = side
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(base[2]![0], base[2]![1])
    ctx.lineTo(base[3]![0], base[3]![1])
    ctx.lineTo(roof[3]![0], roof[3]![1])
    ctx.lineTo(roof[2]![0], roof[2]![1])
    ctx.closePath()
    ctx.fillStyle = lerpHex(side, top, 0.35)
    ctx.fill()

    drawClosedPath(ctx, roof)
    ctx.fillStyle = top
    ctx.fill()
    ctx.strokeStyle = lerpHex(top, '#ffffff', 0.25)
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  // ── ship ───────────────────────────────────────────────────────────────────

  private renderShip(ship: ShipEntity, tick: number): void {
    const { ctx, iso } = this
    const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
    const shape = SHIP_SHAPES[ship.templateId] ?? 'destroyer'
    const L = dim.l / 2
    const W = dim.w / 2
    // Apply tilt angle to height for more 3D perspective
    const tiltFactor = Math.sin(this.tiltAngle)
    const hPx = dim.h * iso.scale * 0.9 * tiltFactor   // hull height in screen pixels

    const cosA = Math.cos(ship.angle)
    const sinA = Math.sin(ship.angle)
    const localToWorld = (lon: number, lat: number): [number, number] => [
      ship.pos.x + cosA * lon + sinA * lat,
      ship.pos.y + sinA * lon - cosA * lat,
    ]

    if (ship.templateId === 'hull.bb.yukimura') {
      this.renderYukimuraShip(ship, dim, hPx, localToWorld)
      return
    }

    const hullLocal = shipHullPoints(shape, L, W)
    const wc = hullLocal.map(([lon, lat]) => localToWorld(lon, lat))
    const sc = wc.map(([x, y]) => this.w2s(x, y)) as [number, number][]

    // Signed area → determine winding (positive = CCW in screen with Y down)
    let area = 0
    for (let i = 0; i < sc.length; i++) {
      const [x0, y0] = sc[i]!
      const [x1, y1] = sc[(i + 1) % sc.length]!
      area += x0 * y1 - x1 * y0
    }
    const ccw = area > 0

    const isPlayer  = ship.team === 'player'
    const isCruiser = ship.templateId === 'hull.cruiser.basic'
    const topColor  = isPlayer
      ? '#0b7663'
      : (isCruiser ? '#9b7f1e' : '#6f6d1f')
    const sideColor = isPlayer ? '#06352f' : '#2b2609'
    const rimColor  = isPlayer ? '#18e0a5' : '#f5d64b'

    // 1. Shadow
    ctx.beginPath()
    ctx.moveTo(sc[0]![0] + 3, sc[0]![1] + 4)
    for (let i = 1; i < sc.length; i++) ctx.lineTo(sc[i]![0] + 3, sc[i]![1] + 4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.fill()

    const [cx, cy] = this.w2s(ship.pos.x, ship.pos.y)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1.7, 0.65)
    const glowR = Math.max(5, dim.l * iso.scale * 0.26)
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR)
    glow.addColorStop(0, isPlayer ? 'rgba(15,238,166,0.18)' : 'rgba(245,214,75,0.13)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(0, 0, glowR, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
    ctx.restore()

    // 2. Visible side faces
    for (let i = 0; i < sc.length; i++) {
      const j = (i + 1) % sc.length
      const [x0, y0] = sc[i]!
      const [x1, y1] = sc[j]!
      // outward normal.y in screen space: CCW→(x0-x1), CW→(x1-x0)
      const ny = ccw ? (x0 - x1) : (x1 - x0)
      if (ny > 0) {
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x1, y1 - hPx)
        ctx.lineTo(x0, y0 - hPx)
        ctx.closePath()
        // lighter shade for front faces (larger ny = more front-facing)
        const t = Math.min(ny / 80, 1)
        ctx.fillStyle = lerpHex(sideColor, topColor, t * 0.45)
        ctx.fill()
      }
    }

    // 3. Top deck
    ctx.beginPath()
    ctx.moveTo(sc[0]![0], sc[0]![1] - hPx)
    for (let i = 1; i < sc.length; i++) ctx.lineTo(sc[i]![0], sc[i]![1] - hPx)
    ctx.closePath()
    ctx.fillStyle = topColor
    ctx.fill()
    ctx.strokeStyle = rimColor
    ctx.lineWidth = 0.8
    ctx.stroke()

    this.renderDeckDetails(ship, shape, dim, hPx, topColor, rimColor, localToWorld, tick)

    // 4. Superstructure
    if (dim.h >= 13) {
      const superSpec = superstructureSpec(shape, dim)
      const sL = superSpec.l / 2
      const sW = superSpec.w / 2
      const superWc: [number, number][] = [
        localToWorld(superSpec.offset + sL, sW),
        localToWorld(superSpec.offset + sL, -sW),
        localToWorld(superSpec.offset - sL, -sW),
        localToWorld(superSpec.offset - sL, sW),
      ]
      const ss = superWc.map(([x, y]) => this.w2s(x, y)) as [number, number][]
      const sHpx = hPx * superSpec.h

      ctx.beginPath()
      ctx.moveTo(ss[0]![0], ss[0]![1] - hPx)
      for (let i = 1; i < 4; i++) ctx.lineTo(ss[i]![0], ss[i]![1] - hPx)
      ctx.closePath()
      ctx.fillStyle = lerpHex(topColor, '#ffffff', 0.25)
      ctx.fill()
      ctx.strokeStyle = rimColor
      ctx.lineWidth = 0.5
      ctx.stroke()

      // superstructure sides
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        const [x0, y0] = ss[i]!
        const [x1, y1] = ss[j]!
        const ny = ccw ? (x0 - x1) : (x1 - x0)
        if (ny > 0) {
          ctx.beginPath()
          ctx.moveTo(x0, y0 - hPx)
          ctx.lineTo(x1, y1 - hPx)
          ctx.lineTo(x1, y1 - hPx - sHpx)
          ctx.lineTo(x0, y0 - hPx - sHpx)
          ctx.closePath()
          ctx.fillStyle = lerpHex(topColor, '#ffffff', 0.12)
          ctx.fill()
        }
      }

      // superstructure roof
      ctx.beginPath()
      ctx.moveTo(ss[0]![0], ss[0]![1] - hPx - sHpx)
      for (let i = 1; i < 4; i++) ctx.lineTo(ss[i]![0], ss[i]![1] - hPx - sHpx)
      ctx.closePath()
      ctx.fillStyle = lerpHex(topColor, '#ffffff', 0.35)
      ctx.fill()

      if (shape === 'battleship' || shape === 'yukimura' || shape === 'boss') {
        const mastBase = localToWorld(superSpec.offset, 0)
        const [mx, my] = this.w2s(mastBase[0], mastBase[1])
        ctx.strokeStyle = lerpHex(rimColor, '#ffffff', 0.35)
        ctx.lineWidth = Math.max(1, 2 * iso.scale)
        ctx.beginPath()
        ctx.moveTo(mx, my - hPx - sHpx)
        ctx.lineTo(mx, my - hPx - sHpx - dim.h * iso.scale * 0.75)
        ctx.stroke()
      }
    }

    if (shape === 'yukimura') {
      this.renderYukimuraDetails(dim, hPx, localToWorld)
    }

    // 6. Compact HP bar
    const barW = dim.l * iso.scale * 0.65
    const barY = cy - hPx - 11
    const hpRatio = ship.hp / ship.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(cx - barW / 2 - 1, barY - 1, barW + 2, 6)
    ctx.fillStyle = hpRatio > 0.5 ? (isPlayer ? '#22c55e' : '#d8c94c') : hpRatio > 0.25 ? '#eab308' : '#ef4444'
    ctx.fillRect(cx - barW / 2, barY, barW * hpRatio, 4)
  }

  private renderDeckDetails(
    ship: ShipEntity,
    shape: ShipShapeClass,
    dim: { l: number; w: number; h: number },
    hPx: number,
    topColor: string,
    rimColor: string,
    localToWorld: (lon: number, lat: number) => [number, number],
    tick: number,
  ): void {
    const { ctx, iso } = this
    const lineCount = shape === 'destroyer' ? 1 : shape === 'cruiser' ? 2 : 3
    ctx.strokeStyle = shape === 'yukimura' ? 'rgba(22,163,74,0.45)' : 'rgba(226,232,240,0.20)'
    ctx.lineWidth = Math.max(0.7, 1.5 * iso.scale)
    for (let i = 0; i < lineCount; i++) {
      const lat = (i - (lineCount - 1) / 2) * dim.w * 0.18
      const [aX, aY] = localToWorld(-dim.l * 0.34, lat)
      const [bX, bY] = localToWorld(dim.l * 0.34, lat)
      const [sx, sy] = this.w2s(aX, aY)
      const [ex, ey] = this.w2s(bX, bY)
      ctx.beginPath()
      ctx.moveTo(sx, sy - hPx - 1)
      ctx.lineTo(ex, ey - hPx - 1)
      ctx.stroke()
    }

    const turrets = turretLayout(shape, dim)
    for (const turret of turrets) {
      const [tx, ty] = localToWorld(turret.lon, turret.lat)
      const [sx, sy] = this.w2s(tx, ty)
      const r = Math.max(2.4, turret.radius * iso.scale)
      ctx.save()
      ctx.translate(sx, sy - hPx - r * 0.25)
      ctx.scale(1.25, 0.62)
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = lerpHex(topColor, '#ffffff', shape === 'boss' ? 0.42 : 0.30)
      ctx.fill()
      ctx.strokeStyle = rimColor
      ctx.lineWidth = 0.7
      ctx.stroke()
      ctx.restore()

      const aim = this.turretAimDirection(ship, { x: tx, y: ty, z: 0 }, tick, dim.l * 0.22)
      const bx = tx + aim.x * dim.l * 0.12
      const by = ty + aim.y * dim.l * 0.12
      const [barrelX, barrelY] = this.w2s(bx, by)
      ctx.beginPath()
      ctx.moveTo(sx, sy - hPx - r * 0.35)
      ctx.lineTo(barrelX, barrelY - hPx - r * 0.35)
      ctx.strokeStyle = lerpHex(rimColor, '#ffffff', 0.25)
      ctx.lineWidth = Math.max(0.8, turret.barrels * 0.55)
      ctx.stroke()
    }
  }

  private renderYukimuraShip(
    ship: ShipEntity,
    dim: { l: number; w: number; h: number },
    hPx: number,
    localToWorld: (lon: number, lat: number) => [number, number],
  ): void {
    const { ctx, iso } = this
    const [cx, cy] = this.w2s(ship.pos.x, ship.pos.y)
    const L = dim.l / 2
    const W = dim.w / 2
    const hullLocal = shipHullPoints('yukimura', L, W)
    const worldHull = hullLocal.map(([lon, lat]) => localToWorld(lon, lat))
    const screenHull = worldHull.map(([x, y]) => this.w2s(x, y)) as [number, number][]

    let area = 0
    for (let i = 0; i < screenHull.length; i++) {
      const [x0, y0] = screenHull[i]!
      const [x1, y1] = screenHull[(i + 1) % screenHull.length]!
      area += x0 * y1 - x1 * y0
    }
    const ccw = area > 0

    const drawSnowPoly = (lon: number, lat: number, rx: number, ry: number, lift: number, rows: number, cols: number): void => {
      const [wx, wy] = localToWorld(lon, lat)
      const [sx, sy] = this.w2s(wx, wy)
      const bodyGrad = ctx.createRadialGradient(
        sx - rx * 0.24,
        sy - lift - ry * 0.34,
        Math.max(1, rx * 0.06),
        sx,
        sy - lift,
        Math.max(rx, ry),
      )
      bodyGrad.addColorStop(0, '#ffffff')
      bodyGrad.addColorStop(0.62, '#f8fafc')
      bodyGrad.addColorStop(1, '#dbe4ee')
      drawClosedPath(ctx, facetedOvalPoints(sx, sy - lift, rx, ry * 0.74, Math.max(22, Math.floor(cols * 0.7)), -Math.PI / 2))
      ctx.fillStyle = bodyGrad
      ctx.fill()
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1.6
      ctx.stroke()
      drawFacetedEllipseMesh(ctx, {
        cx: sx,
        cy: sy - lift,
        rx,
        ry: ry * 0.74,
        rows,
        cols,
        baseColor: '#f3f4f6',
        lightColor: '#ffffff',
        shadowColor: '#cbd5e1',
        wobble: 0.028,
        stroke: '#e2e8f0',
        strokeWidth: 0.28,
        lightBiasX: -0.38,
        lightBiasY: -0.52,
      })
    }
    const drawDeckFitting = (lon: number, lat: number, radius: number, lift: number, color: string, rim: string): void => {
      const [wx, wy] = localToWorld(lon, lat)
      const [sx, sy] = this.w2s(wx, wy)
      ctx.save()
      ctx.translate(sx, sy - lift)
      ctx.scale(1.18, 0.68)
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = rim
      ctx.lineWidth = 0.7
      ctx.stroke()
      ctx.restore()
    }
    const drawPorthole = (lon: number, lat: number, lift: number, radius: number): void => {
      const [wx, wy] = localToWorld(lon, lat)
      const [sx, sy] = this.w2s(wx, wy)
      ctx.save()
      ctx.translate(sx, sy - lift)
      ctx.scale(1.05, 0.82)
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#334155'
      ctx.fill()
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 0.6
      ctx.stroke()
      ctx.restore()
    }

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1.75, 0.70)
    ctx.beginPath()
    ctx.arc(0, 0, dim.l * iso.scale * 0.30, 0, Math.PI * 2)
    ctx.fillStyle = '#334155'
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(screenHull[0]![0] + 4, screenHull[0]![1] + 6)
    for (let i = 1; i < screenHull.length; i++) ctx.lineTo(screenHull[i]![0] + 4, screenHull[i]![1] + 6)
    ctx.closePath()
    ctx.fillStyle = '#1e293b'
    ctx.fill()

    for (let i = 0; i < screenHull.length; i++) {
      const j = (i + 1) % screenHull.length
      const [x0, y0] = screenHull[i]!
      const [x1, y1] = screenHull[j]!
      const ny = ccw ? (x0 - x1) : (x1 - x0)
      if (ny > 0) {
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x1, y1 - hPx * 1.18)
        ctx.lineTo(x0, y0 - hPx * 1.18)
        ctx.closePath()
        ctx.fillStyle = lerpHex('#1f2937', '#475569', Math.min(1, ny / 72) * 0.72)
        ctx.fill()
      }
    }

    const topDeck = screenHull.map(([x, y]) => [x, y - hPx * 1.18] as [number, number])
    drawClosedPath(ctx, topDeck)
    ctx.fillStyle = '#f8fafc'
    ctx.fill()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 0.9
    ctx.stroke()

    const innerDeck = topDeck.map(([x, y]) => [cx + (x - cx) * 0.90, cy - hPx * 1.10 + (y - (cy - hPx * 1.18)) * 0.90] as [number, number])
    drawClosedPath(ctx, innerDeck)
    ctx.fillStyle = '#e2e8f0'
    ctx.fill()

    const stripeInsets = 0.88
    const stripeTop = screenHull.map(([x, y]) => [cx + (x - cx) * stripeInsets, y - hPx * 0.50] as [number, number])
    for (let i = 0; i < stripeTop.length; i++) {
      const a = stripeTop[i]!
      const b = stripeTop[(i + 1) % stripeTop.length]!
      const a0 = screenHull[i]!
      const b0 = screenHull[(i + 1) % screenHull.length]!
      ctx.beginPath()
      ctx.moveTo(a0[0], a0[1] - hPx * 0.18)
      ctx.lineTo(b0[0], b0[1] - hPx * 0.18)
      ctx.lineTo(b[0], b[1])
      ctx.lineTo(a[0], a[1])
      ctx.closePath()
      ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#166534'
      ctx.fill()
    }

    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(topDeck[0]![0], topDeck[0]![1])
    for (let i = 1; i < topDeck.length; i++) ctx.lineTo(topDeck[i]![0], topDeck[i]![1])
    ctx.stroke()

    const railPoints = [
      localToWorld(dim.l * 0.36, 0),
      localToWorld(dim.l * 0.18, 0),
      localToWorld(-dim.l * 0.06, 0),
      localToWorld(-dim.l * 0.34, 0),
    ].map(([x, y]) => this.w2s(x, y)) as [number, number][]
    const deckUnit = Math.max(8, dim.w * iso.scale * 0.34)
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1
    for (const [sx, sy] of railPoints) {
      ctx.beginPath()
      ctx.moveTo(sx - deckUnit * 0.16, sy - hPx * 1.19)
      ctx.lineTo(sx + deckUnit * 0.16, sy - hPx * 1.19)
      ctx.stroke()
    }

    const railPairs: Array<[number, number, number]> = [
      [dim.l * 0.26, dim.w * 0.50, dim.w * 0.82],
      [dim.l * 0.02, dim.w * 0.58, dim.w * 0.92],
      [-dim.l * 0.22, dim.w * 0.52, dim.w * 0.84],
    ]
    ctx.strokeStyle = '#94a3b8'
    for (const [lon, latA, latB] of railPairs) {
      const [ax, ay] = this.w2s(...localToWorld(lon, latA))
      const [bx, by] = this.w2s(...localToWorld(lon, latB))
      ctx.beginPath()
      ctx.moveTo(ax, ay - hPx * 1.17)
      ctx.lineTo(bx, by - hPx * 1.17)
      ctx.stroke()
      const [cx2, cy2] = this.w2s(...localToWorld(lon, -latA))
      const [dx2, dy2] = this.w2s(...localToWorld(lon, -latB))
      ctx.beginPath()
      ctx.moveTo(cx2, cy2 - hPx * 1.17)
      ctx.lineTo(dx2, dy2 - hPx * 1.17)
      ctx.stroke()
    }

    const hullBaseRx = Math.max(26, dim.w * iso.scale * 1.02)
    const hullBaseRy = Math.max(16, dim.w * iso.scale * 0.48)
    drawSnowPoly(-dim.l * 0.02, 0, hullBaseRx * 0.98, hullBaseRy * 0.92, hPx * 1.34, 18, 34)
    drawSnowPoly(dim.l * 0.18, 0, hullBaseRx * 0.62, hullBaseRy * 0.66, hPx * 2.12, 16, 28)
    drawSnowPoly(-dim.l * 0.32, 0, hullBaseRx * 0.18, hullBaseRy * 0.17, hPx * 1.02, 8, 12)

    for (const lon of [dim.l * 0.32, dim.l * 0.14, -dim.l * 0.04, -dim.l * 0.22]) {
      drawDeckFitting(lon, -dim.w * 0.10, Math.max(1.4, deckUnit * 0.11), hPx * 1.22, '#94a3b8', '#475569')
      drawDeckFitting(lon, dim.w * 0.10, Math.max(1.4, deckUnit * 0.11), hPx * 1.22, '#94a3b8', '#475569')
    }
    for (const lon of [dim.l * 0.04, -dim.l * 0.12]) {
      drawDeckFitting(lon, 0, Math.max(2, deckUnit * 0.14), hPx * 1.25, '#64748b', '#e2e8f0')
    }

    const [hx, hy] = this.w2s(...localToWorld(dim.l * 0.15, 0))
    const hatCx = hx + hullBaseRx * 0.02
    const hatCy = hy - hPx * 2.44
    drawFacetedEllipseMesh(ctx, {
      cx: hatCx,
      cy: hatCy,
      rx: hullBaseRx * 0.56,
      ry: hullBaseRy * 0.22,
      rows: 8,
      cols: 28,
      baseColor: '#166534',
      lightColor: '#84cc16',
      shadowColor: '#14532d',
      wobble: 0.04,
      stroke: '#4d7c0f',
      strokeWidth: 0.45,
      lightBiasX: -0.34,
      lightBiasY: -0.30,
    })
    drawFacetedEllipseMesh(ctx, {
      cx: hatCx + hullBaseRx * 0.05,
      cy: hatCy - hullBaseRy * 0.38,
      rx: hullBaseRx * 0.48,
      ry: hullBaseRy * 0.50,
      rows: 14,
      cols: 26,
      baseColor: '#15803d',
      lightColor: '#a3e635',
      shadowColor: '#14532d',
      wobble: 0.036,
      stroke: '#65a30d',
      strokeWidth: 0.45,
      lightBiasX: -0.40,
      lightBiasY: -0.45,
    })
    drawDeckFitting(dim.l * 0.16, 0, Math.max(5, deckUnit * 0.42), hPx * 2.64, '#6b7280', '#d1d5db')
    drawDeckFitting(dim.l * 0.13, 0, Math.max(3.2, deckUnit * 0.26), hPx * 2.86, '#4b5563', '#e5e7eb')

    const [hatTurretX, hatTurretY] = this.w2s(...localToWorld(dim.l * 0.16, 0))
    const hatTurretLift = hPx * 2.90
    ctx.save()
    ctx.translate(hatTurretX, hatTurretY - hatTurretLift)
    ctx.beginPath()
    ctx.moveTo(-deckUnit * 0.46, deckUnit * 0.18)
    ctx.lineTo(-deckUnit * 0.34, -deckUnit * 0.34)
    ctx.lineTo(deckUnit * 0.22, -deckUnit * 0.40)
    ctx.lineTo(deckUnit * 0.54, -deckUnit * 0.06)
    ctx.lineTo(deckUnit * 0.42, deckUnit * 0.34)
    ctx.lineTo(-deckUnit * 0.20, deckUnit * 0.38)
    ctx.closePath()
    ctx.fillStyle = '#9ca3af'
    ctx.fill()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
    for (const offset of [-0.34, 0, 0.34]) {
      ctx.beginPath()
      ctx.moveTo(hatTurretX + deckUnit * offset * 0.9, hatTurretY - hatTurretLift - deckUnit * 0.08)
      ctx.lineTo(hatTurretX + deckUnit * (0.78 + offset * 0.25), hatTurretY - hatTurretLift - deckUnit * 0.44)
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = Math.max(1.3, deckUnit * 0.16)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(hatTurretX + deckUnit * 0.10, hatTurretY - hatTurretLift - deckUnit * 0.30)
    ctx.lineTo(hatTurretX + deckUnit * 0.10, hatTurretY - hatTurretLift - deckUnit * 0.76)
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.stroke()
    drawDeckFitting(dim.l * 0.12, 0, Math.max(1.6, deckUnit * 0.10), hPx * 3.18, '#94a3b8', '#e2e8f0')

    const scarfY = hy - hPx * 1.88
    drawFacetedEllipseMesh(ctx, {
      cx: hx,
      cy: scarfY,
      rx: hullBaseRx * 0.58,
      ry: hullBaseRy * 0.16,
      rows: 6,
      cols: 28,
      baseColor: '#b91c1c',
      lightColor: '#ef4444',
      shadowColor: '#7f1d1d',
      wobble: 0.03,
      stroke: '#991b1b',
      strokeWidth: 0.35,
      lightBiasX: -0.25,
      lightBiasY: -0.15,
      stripeEvery: 4,
      stripeColor: '#166534',
    })
    drawFacetedRibbon(ctx, {
      x: hx + hullBaseRx * 0.04,
      y: scarfY + hullBaseRy * 0.10,
      width: hullBaseRx * 0.27,
      height: hullBaseRy * 1.15,
      slant: -hullBaseRx * 0.10,
      rows: 14,
      cols: 8,
      baseColor: '#b91c1c',
      lightColor: '#ef4444',
      shadowColor: '#7f1d1d',
      stripeEvery: 4,
      stripeColor: '#166534',
    })
    drawFacetedRibbon(ctx, {
      x: hx - hullBaseRx * 0.10,
      y: scarfY + hullBaseRy * 0.03,
      width: hullBaseRx * 0.18,
      height: hullBaseRy * 0.74,
      slant: hullBaseRx * 0.04,
      rows: 10,
      cols: 6,
      baseColor: '#166534',
      lightColor: '#22c55e',
      shadowColor: '#14532d',
      stripeEvery: 2,
      stripeColor: '#b91c1c',
    })

    ctx.fillStyle = '#0f172a'
    for (const lat of [-dim.w * 0.11, dim.w * 0.11]) {
      const [ex, ey] = this.w2s(...localToWorld(dim.l * 0.26, lat))
      const eyeR = Math.max(2.3, dim.w * iso.scale * 0.045)
      drawFacetedEllipseMesh(ctx, {
        cx: ex,
        cy: ey - hPx * 2.14,
        rx: eyeR * 1.02,
        ry: eyeR * 1.18,
        rows: 5,
        cols: 10,
        baseColor: '#111827',
        lightColor: '#4b5563',
        shadowColor: '#020617',
        wobble: 0.03,
        stroke: '#374151',
        strokeWidth: 0.2,
        lightBiasX: -0.30,
        lightBiasY: -0.50,
      })
    }

    const [nx, ny] = this.w2s(...localToWorld(dim.l * 0.33, 0))
    const noseR = Math.max(4, dim.w * iso.scale * 0.08)
    drawFacetedNose(ctx, nx, ny - hPx * 2.06, noseR)
    drawDeckFitting(dim.l * 0.30, -dim.w * 0.07, Math.max(0.75, deckUnit * 0.05), hPx * 2.18, '#ffffff', '#cbd5e1')
    drawDeckFitting(dim.l * 0.29, dim.w * 0.08, Math.max(0.75, deckUnit * 0.05), hPx * 2.18, '#ffffff', '#cbd5e1')

    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(hx - hullBaseRx * 0.21, hy - hPx * 2.02)
    ctx.bezierCurveTo(
      hx - hullBaseRx * 0.12,
      hy - hPx * 1.95,
      hx + hullBaseRx * 0.08,
      hy - hPx * 1.92,
      hx + hullBaseRx * 0.22,
      hy - hPx * 2.02,
    )
    ctx.stroke()

    for (const lon of [dim.l * 0.06, -dim.l * 0.04, -dim.l * 0.14]) {
      drawPorthole(lon, dim.w * 0.18, hPx * 1.58, Math.max(2, deckUnit * 0.10))
      drawPorthole(lon, -dim.w * 0.18, hPx * 1.58, Math.max(2, deckUnit * 0.10))
    }

    const turrets = turretLayout('yukimura', dim)
    const aimTick = this.effectLog.length > 0 ? this.effectLog[this.effectLog.length - 1]!.tick : 0
    for (const turret of turrets) {
      const [tx, ty] = localToWorld(turret.lon, turret.lat)
      const [sx, sy] = this.w2s(tx, ty)
      const r = Math.max(2.8, turret.radius * iso.scale * (Math.abs(turret.lat) > 0 ? 0.92 : 1.04))
      const lift = Math.abs(turret.lat) > 0 ? hPx * 1.52 : turret.lon > dim.l * 0.2 ? hPx * 1.30 : hPx * 1.08
      ctx.save()
      ctx.translate(sx, sy - lift)
      ctx.scale(1.22, 0.68)
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#6b7280'
      ctx.fill()
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 0.75
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.translate(sx, sy - lift - r * 0.54)
      ctx.beginPath()
      ctx.moveTo(-r * 0.9, r * 0.35)
      ctx.lineTo(-r * 0.55, -r * 0.78)
      ctx.lineTo(r * 0.48, -r * 0.78)
      ctx.lineTo(r * 0.92, r * 0.15)
      ctx.lineTo(r * 0.30, r * 0.82)
      ctx.lineTo(-r * 0.75, r * 0.72)
      ctx.closePath()
      ctx.fillStyle = '#9ca3af'
      ctx.fill()
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 0.7
      ctx.stroke()
      ctx.restore()

      const aim = this.turretAimDirection(ship, { x: tx, y: ty, z: 0 }, aimTick, dim.l * 0.25)
      const barrelBaseY = sy - lift - r * 0.46
      const spread = turret.barrels === 3 ? [-0.72, 0, 0.72] : turret.barrels === 2 ? [-0.42, 0.42] : [0]
      for (const offset of spread) {
        const bx = tx + aim.x * dim.l * 0.14
        const by = ty + aim.y * dim.l * 0.14
        const [barrelX, barrelY] = this.w2s(bx, by)
        ctx.beginPath()
        ctx.moveTo(sx + offset * r * 0.9, barrelBaseY)
        ctx.lineTo(barrelX + offset * r * 0.22, barrelY - lift - r * 0.20)
        ctx.strokeStyle = '#d1d5db'
        ctx.lineWidth = Math.max(1, r * 0.26)
        ctx.stroke()
      }
    }

    for (const lat of [-dim.w * 0.82, dim.w * 0.82]) {
      const [mx, my] = this.w2s(...localToWorld(dim.l * 0.00, lat))
      ctx.beginPath()
      ctx.moveTo(mx, my - hPx * 1.52)
      ctx.lineTo(mx + Math.sign(lat) * deckUnit * 0.58, my - hPx * 1.58)
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = Math.max(1.1, deckUnit * 0.12)
      ctx.stroke()
      drawDeckFitting(dim.l * 0.02, lat, Math.max(3.2, deckUnit * 0.20), hPx * 1.50, '#f8fafc', '#cbd5e1')
      drawDeckFitting(dim.l * 0.34, lat * 0.94, Math.max(4.2, deckUnit * 0.24), hPx * 1.34, '#f8fafc', '#cbd5e1')
    }

    const mastBase = this.w2s(...localToWorld(-dim.l * 0.14, dim.w * 0.18))
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(mastBase[0], mastBase[1] - hPx * 1.58)
    ctx.lineTo(mastBase[0], mastBase[1] - hPx * 2.48)
    ctx.stroke()
    ctx.fillStyle = '#dc2626'
    drawClosedPath(ctx, [
      [mastBase[0], mastBase[1] - hPx * 2.42],
      [mastBase[0] + hullBaseRx * 0.22, mastBase[1] - hPx * 2.34],
      [mastBase[0], mastBase[1] - hPx * 2.24],
    ])
    ctx.fill()
    ctx.fillStyle = '#166534'
    drawClosedPath(ctx, [
      [mastBase[0], mastBase[1] - hPx * 2.24],
      [mastBase[0] + hullBaseRx * 0.16, mastBase[1] - hPx * 2.19],
      [mastBase[0], mastBase[1] - hPx * 2.11],
    ])
    ctx.fill()

    for (const [lon, lat] of [[dim.l * 0.44, 0], [dim.l * 0.52, 0.10 * dim.w], [dim.l * 0.56, -0.08 * dim.w]] as Array<[number, number]>) {
      const [sx, sy] = this.w2s(...localToWorld(lon, lat))
      ctx.save()
      ctx.translate(sx, sy - hPx * 1.10)
      ctx.scale(1.2, 0.8)
      ctx.beginPath()
      ctx.arc(0, 0, Math.max(3.2, deckUnit * 0.16), 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 0.6
      ctx.stroke()
      ctx.restore()
    }

    const barW = dim.l * iso.scale * 0.65
    const barY = cy - hPx * 2.72 - 14
    const hpRatio = ship.hp / ship.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(cx - barW / 2 - 1, barY - 1, barW + 2, 6)
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444'
    ctx.fillRect(cx - barW / 2, barY, barW * hpRatio, 4)
  }

  private renderYukimuraDetails(
    dim: { l: number; w: number; h: number },
    hPx: number,
    localToWorld: (lon: number, lat: number) => [number, number],
  ): void {
    const { ctx } = this

    const drawDeckBand = (lon: number, lat0: number, lat1: number, color: string): void => {
      const halfL = dim.l * 0.018
      const pts = [
        localToWorld(lon + halfL, lat0),
        localToWorld(lon + halfL, lat1),
        localToWorld(lon - halfL, lat1),
        localToWorld(lon - halfL, lat0),
      ].map(([x, y]) => this.w2s(x, y)) as [number, number][]
      drawClosedPath(ctx, pts.map(([x, y]) => [x, y - hPx - 1] as [number, number]))
      ctx.fillStyle = color
      ctx.fill()
    }

    for (let i = 0; i < 5; i++) {
      const lon = -dim.l * 0.23 + i * dim.l * 0.052
      drawDeckBand(lon, -dim.w * 0.40, dim.w * 0.40, i % 2 === 0 ? '#dc2626' : '#15803d')
    }

    const hatCenter = localToWorld(dim.l * 0.02, 0)
    const [hx, hy] = this.w2s(hatCenter[0], hatCenter[1])
    ctx.save()
    ctx.translate(hx, hy - hPx - dim.h * 0.22)
    ctx.scale(1.55, 0.68)
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(5, dim.w * 0.16), 0, Math.PI * 2)
    ctx.fillStyle = '#166534'
    ctx.fill()
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()

    const nose = localToWorld(dim.l * 0.30, 0)
    const [nx, ny] = this.w2s(nose[0], nose[1])
    ctx.save()
    ctx.translate(nx, ny - hPx - 1)
    ctx.scale(1.25, 0.65)
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(2.5, dim.w * 0.055), 0, Math.PI * 2)
    ctx.fillStyle = '#f59e0b'
    ctx.fill()
    ctx.restore()
  }

  private turretAimDirection(ship: ShipEntity, mount: Vec3, tick: number, maxMountDistance: number): { x: number; y: number } {
    let best: CombatEvent | undefined
    let bestScore = Number.POSITIVE_INFINITY

    for (const ev of this.effectLog) {
      if (ev.type !== 'weapon.fired' || ev.sourceId !== ship.id || !ev.position || !ev.targetPosition) continue
      const age = tick - ev.tick
      if (age < 0 || age > 70) continue

      const dx = ev.position.x - mount.x
      const dy = ev.position.y - mount.y
      const distSq = dx * dx + dy * dy
      if (distSq > maxMountDistance * maxMountDistance) continue

      const score = distSq + age * 12
      if (score < bestScore) {
        best = ev
        bestScore = score
      }
    }

    if (best?.targetPosition) {
      const dx = best.targetPosition.x - mount.x
      const dy = best.targetPosition.y - mount.y
      const len = Math.hypot(dx, dy)
      if (len > 0) return { x: dx / len, y: dy / len }
    }

    return { x: Math.cos(ship.angle), y: Math.sin(ship.angle) }
  }

  // ── projectile ─────────────────────────────────────────────────────────────

  private renderProjectile(proj: ProjectileEntity): void {
    renderProjectileEntity(this.ctx, this.iso, this.w2s.bind(this), proj)
  }

  private renderShipFires(ships: readonly ShipEntity[], tick: number): void {
    const { ctx } = this

    for (const ship of ships) {
      const hpRatio = ship.maxHp > 0 ? ship.hp / ship.maxHp : 1
      if (hpRatio > 0.64) continue

      const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
      const cosA = Math.cos(ship.angle)
      const sinA = Math.sin(ship.angle)
      const damage = 1 - hpRatio
      const sourceCount = hpRatio < 0.25 ? 4 : hpRatio < 0.45 ? 3 : 2

      for (let i = 0; i < sourceCount; i++) {
        const lon = dim.l * signedNoise(ship.pos.x, ship.pos.y, i + 1140) * 0.30
        const lat = dim.w * signedNoise(ship.pos.y, ship.pos.x, i + 1150) * 0.26
        const wx = ship.pos.x + cosA * lon + sinA * lat
        const wy = ship.pos.y + sinA * lon - cosA * lat
        const [sx, sy] = this.w2s(wx, wy)
        const phase = tick * 0.18 + i * 1.91 + ship.id.length
        const pulse = 0.76 + Math.sin(phase) * 0.24
        const baseR = Math.max(2.5, dim.w * this.iso.scale * (0.18 + damage * 0.22))
        const lift = dim.h * this.iso.scale * (0.62 + damage * 0.85)

        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.translate(sx, sy - lift)
        ctx.scale(1.18, 0.86)
        const fire = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * (2.0 + pulse))
        fire.addColorStop(0, `rgba(255,244,182,${0.45 * damage})`)
        fire.addColorStop(0.34, `rgba(255,111,24,${0.42 * damage})`)
        fire.addColorStop(1, 'rgba(120,24,8,0)')
        ctx.beginPath()
        ctx.arc(0, 0, baseR * (2.0 + pulse), 0, Math.PI * 2)
        ctx.fillStyle = fire
        ctx.fill()
        ctx.restore()

        for (let j = 0; j < 4; j++) {
          const n = Math.abs(signedNoise(ship.pos.x + i * 17, ship.pos.y - j * 9, tick * 0.02 + j))
          const drift = (tick * 0.8 + j * 23) % 80
          const px = sx + signedNoise(i, j, 1160) * dim.w * this.iso.scale * 1.5 + drift * 0.10
          const py = sy - lift - drift * (0.22 + n * 0.18)
          const r = baseR * (1.4 + n * 2.1)
          const alpha = Math.max(0, (1 - drift / 80) * damage * (0.16 + n * 0.16))
          ctx.beginPath()
          ctx.arc(px, py, r, 0, Math.PI * 2)
          ctx.fillStyle = j % 3 === 0 ? `rgba(26,24,23,${alpha})` : `rgba(68,60,51,${alpha})`
          ctx.fill()
        }
      }
    }
  }

  private renderShipStatusOverlays(ships: readonly ShipEntity[]): void {
    const { ctx } = this
    for (const ship of ships) {
      const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
      const [cx, cy] = this.w2s(ship.pos.x, ship.pos.y)
      const hPx = dim.h * this.iso.scale * 0.9
      const barW = Math.max(12, dim.l * this.iso.scale * 0.65)
      const barY = cy - hPx - 12
      const hpRatio = Math.max(0, Math.min(1, ship.hp / ship.maxHp))

      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.62)'
      ctx.fillRect(cx - barW / 2 - 1, barY - 1, barW + 2, 6)
      ctx.fillStyle = hpRatio > 0.55 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444'
      ctx.fillRect(cx - barW / 2, barY, barW * hpRatio, 4)
      ctx.strokeStyle = ship.team === 'player' ? 'rgba(94,234,212,0.70)' : 'rgba(250,204,21,0.62)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(cx - barW / 2 - 1, barY - 1, barW + 2, 6)
      ctx.restore()
    }
  }

  // ── range ellipse (isometric circle = ellipse) ─────────────────────────────

  private renderRangeEllipse(player: ShipEntity, weapon: WeaponState): void {
    const { ctx } = this
    const weaponType = weapon.type
    const cfg = getWeaponConfig(weapon.id, weaponType)
    const R = cfg.maxRange
    const STEPS = 72

    ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2
      const [sx, sy] = this.w2s(player.pos.x + Math.cos(a) * R, player.pos.y + Math.sin(a) * R)
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
    }
    ctx.closePath()

    const fills: Record<WeaponType, string> = {
      gun:       'rgba(251,191,36,0.06)',
      secondary: 'rgba(250,204,21,0.06)',
      torpedo:   'rgba(249,115,22,0.06)',
      aa:        'rgba(103,232,249,0.06)',
      missile:   'rgba(167,139,250,0.06)',
    }
    const strokes: Record<WeaponType, string> = {
      gun:       'rgba(251,191,36,0.45)',
      secondary: 'rgba(250,204,21,0.40)',
      torpedo:   'rgba(249,115,22,0.45)',
      aa:        'rgba(103,232,249,0.45)',
      missile:   'rgba(167,139,250,0.45)',
    }

    ctx.fillStyle = fills[weaponType]
    ctx.fill()
    ctx.strokeStyle = strokes[weaponType]
    ctx.lineWidth = 1.2
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  private renderAimPointer(player: ShipEntity, weapon: WeaponState, aimPoint: Vec3, obstacles: readonly MapObstacle[]): void {
    const { ctx, iso } = this
    const weaponType = weapon.type
    const cfg = getWeaponConfig(weapon.id, weaponType)
    const dx = aimPoint.x - player.pos.x
    const dy = aimPoint.y - player.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const inRange = dist <= cfg.maxRange
    const blocked = weaponType === 'torpedo' && isOnLand(aimPoint.x, aimPoint.y, obstacles)
    const color = !inRange || blocked ? '#ef4444' : '#f8fafc'
    const accent: Record<WeaponType, string> = {
      gun:       '#fbbf24',
      secondary: '#facc15',
      torpedo:   '#fb923c',
      aa:        '#67e8f9',
      missile:   '#c4b5fd',
    }
    const [sx, sy] = this.w2s(aimPoint.x, aimPoint.y)
    const [px, py] = this.w2s(player.pos.x, player.pos.y)
    const r = Math.max(8, 38 * iso.scale)

    ctx.save()
    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(sx, sy)
    ctx.strokeStyle = inRange ? 'rgba(226,232,240,0.28)' : 'rgba(239,68,68,0.28)'
    ctx.lineWidth = 1
    ctx.setLineDash([7, 6])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.save()
    ctx.translate(sx, sy)
    ctx.scale(1.55, 0.62)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.strokeStyle = inRange && !blocked ? 'rgba(248,250,252,0.55)' : 'rgba(239,68,68,0.65)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(sx - r * 1.4, sy)
    ctx.lineTo(sx - r * 0.45, sy)
    ctx.moveTo(sx + r * 0.45, sy)
    ctx.lineTo(sx + r * 1.4, sy)
    ctx.moveTo(sx, sy - r * 0.9)
    ctx.lineTo(sx, sy - r * 0.28)
    ctx.moveTo(sx, sy + r * 0.28)
    ctx.lineTo(sx, sy + r * 0.9)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = accent[weaponType]
    ctx.fill()

    if (!inRange || blocked) {
      ctx.beginPath()
      ctx.moveTo(sx - r * 0.55, sy - r * 0.45)
      ctx.lineTo(sx + r * 0.55, sy + r * 0.45)
      ctx.moveTo(sx + r * 0.55, sy - r * 0.45)
      ctx.lineTo(sx - r * 0.55, sy + r * 0.45)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.4
      ctx.stroke()
    }

    ctx.restore()
  }

  // ── fog of war / detection ─────────────────────────────────────────────────

  private renderDetectionFog(state: CombatState): void {
    const { ctx, canvas } = this
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    if (!player || player.destroyed) return

    const [px, py] = this.w2s(player.pos.x, player.pos.y)
    const R = effectiveDetectionRange(player.detectionRange, state.weather) * this.iso.scale  // approx screen radius

    // Draw fog everywhere outside the detection ellipse using composite op
    ctx.save()

    // Create an off-screen ellipse mask: clip everything OUTSIDE the detection area
    ctx.beginPath()
    ctx.rect(0, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM)
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(1.0, 0.5)           // isometric: vertical axis is 0.5x
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.restore()
    // even-odd fill rule: inside ellipse = hole in the fog rect.
    // Outside detection should be unknown, not merely dimmed.
    ctx.fillStyle = 'rgba(2,8,14,0.98)'
    ctx.fill('evenodd')

    // Soft fade inside the detection boundary
    ctx.translate(px, py)
    ctx.scale(1.0, 0.5)
    const fade = ctx.createRadialGradient(0, 0, R * 0.72, 0, 0, R * 1.05)
    fade.addColorStop(0, 'rgba(4,14,26,0)')
    fade.addColorStop(1, 'rgba(4,14,26,0.88)')
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.08, 0, Math.PI * 2)
    ctx.fillStyle = fade
    ctx.fill()

    ctx.restore()

    // Draw a subtle detection boundary ring
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(1.0, 0.5)
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(20,200,160,0.20)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 5])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  private renderEnemyGhosts(state: CombatState): void {
    const { ctx } = this
    const PERSIST = 180  // matches CONTACT_PERSIST_TICKS

    for (const [id, contact] of state.enemyContacts) {
      if (state.detectedByPlayer.has(id)) continue   // currently visible — no ghost needed

      const age = state.tick - contact.tick
      if (age < 0 || age >= PERSIST) continue

      const fade = 1 - age / PERSIST   // 1 at fresh detection, 0 at expiry
      const [sx, sy] = this.w2s(contact.pos.x, contact.pos.y)

      ctx.save()
      ctx.globalAlpha = fade * 0.75

      // Isometric ellipse blip
      ctx.translate(sx, sy)
      ctx.scale(1.55, 0.62)
      ctx.beginPath()
      ctx.arc(0, 0, 14, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,80,80,0.18)'
      ctx.fill()
      ctx.strokeStyle = `rgba(255,120,100,${0.7 * fade})`
      ctx.lineWidth = 1.4
      ctx.stroke()

      ctx.restore()

      // "?" label
      ctx.save()
      ctx.globalAlpha = fade * 0.85
      ctx.font = 'bold 11px monospace'
      ctx.fillStyle = `rgba(255,160,140,${fade})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', sx, sy - 2)
      ctx.restore()
    }
  }

  private renderTacticalAtmosphere(weather: WeatherMode): void {
    const { ctx, canvas } = this
    const cx = canvas.width / 2
    const cy = HUD_TOP + (canvas.height - HUD_TOP - HUD_BOTTOM) / 2
    const radius = Math.max(canvas.width, canvas.height) * 0.72

    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    const storm = ctx.createLinearGradient(0, HUD_TOP, 0, canvas.height - HUD_BOTTOM)
    if (weather === 'storm') {
      storm.addColorStop(0, 'rgba(30,36,42,0.44)')
      storm.addColorStop(0.42, 'rgba(20,28,35,0.28)')
      storm.addColorStop(1, 'rgba(2,8,14,0.36)')
    } else {
      storm.addColorStop(0, 'rgba(255,255,255,0.03)')
      storm.addColorStop(0.46, 'rgba(31,62,82,0.08)')
      storm.addColorStop(1, 'rgba(5,34,56,0.13)')
    }
    ctx.fillStyle = storm
    ctx.fillRect(0, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM)
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius)
    vignette.addColorStop(0, 'rgba(255,255,255,0)')
    vignette.addColorStop(0.62, weather === 'storm' ? 'rgba(48,55,61,0.16)' : 'rgba(29,70,90,0.07)')
    vignette.addColorStop(1, weather === 'storm' ? 'rgba(0,0,0,0.68)' : 'rgba(0,15,26,0.36)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM)
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = weather === 'storm' ? 0.10 : 0.045
    ctx.drawImage(canvas, -1, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM, 0, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM)
    ctx.globalAlpha = weather === 'storm' ? 0.08 : 0.035
    ctx.drawImage(canvas, 1, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM, 0, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM)
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = weather === 'storm' ? 'rgba(190,225,235,0.035)' : 'rgba(255,255,255,0.020)'
    for (let y = HUD_TOP; y < canvas.height - HUD_BOTTOM; y += 3) {
      ctx.fillRect(0, y, canvas.width, 1)
    }
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'overlay'
    const count = Math.round((canvas.width * (canvas.height - HUD_TOP - HUD_BOTTOM)) / (weather === 'storm' ? 7000 : 11500))
    for (let i = 0; i < count; i++) {
      const x = (signedNoise(this.camX * 0.021, this.camY * 0.019, i + 2500) * 0.5 + 0.5) * canvas.width
      const y = HUD_TOP + (signedNoise(this.camY * 0.023, this.camX * 0.017, i + 2600) * 0.5 + 0.5) * (canvas.height - HUD_TOP - HUD_BOTTOM)
      const alpha = (weather === 'storm' ? 0.04 : 0.025) + Math.abs(signedNoise(x, y, i + 2700)) * (weather === 'storm' ? 0.10 : 0.055)
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`
      ctx.fillRect(x, y, 1, 1)
    }
    ctx.restore()
  }
}

// linear interpolate between two hex colors
function lerpHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const r = Math.round(ar! + (br! - ar!) * t)
  const g = Math.round(ag! + (bg! - ag!) * t)
  const bl2 = Math.round(ab! + (bb! - ab!) * t)
  return `rgb(${r},${g},${bl2})`
}

function drawClosedPath(ctx: CanvasRenderingContext2D, points: [number, number][]): void {
  ctx.beginPath()
  ctx.moveTo(points[0]![0], points[0]![1])
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
  ctx.closePath()
}

// Catmull-Rom spline through all points (closed loop) — smoother coastlines.
function drawSmoothClosedPath(ctx: CanvasRenderingContext2D, points: [number, number][]): void {
  if (points.length < 3) { drawClosedPath(ctx, points); return }
  const n = points.length
  ctx.beginPath()
  ctx.moveTo(points[0]![0], points[0]![1])
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!
    const p1 = points[i]!
    const p2 = points[(i + 1) % n]!
    const p3 = points[(i + 2) % n]!
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1])
  }
  ctx.closePath()
}

function facetedOvalPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  facets: number,
  phase = 0,
): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < facets; i++) {
    const a = phase + (Math.PI * 2 * i) / facets
    const wobble = 1 + (i % 3 === 0 ? 0.045 : i % 3 === 1 ? -0.025 : 0.015)
    pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble])
  }
  return pts
}

type FacetedEllipseMeshOptions = {
  cx: number
  cy: number
  rx: number
  ry: number
  rows: number
  cols: number
  baseColor: string
  lightColor: string
  shadowColor: string
  wobble: number
  stroke: string
  strokeWidth: number
  lightBiasX: number
  lightBiasY: number
  stripeEvery?: number
  stripeColor?: string
}

function drawFacetedEllipseMesh(ctx: CanvasRenderingContext2D, opts: FacetedEllipseMeshOptions): void {
  const {
    cx, cy, rx, ry, rows, cols, baseColor, lightColor, shadowColor, wobble, stroke, strokeWidth, lightBiasX, lightBiasY, stripeEvery, stripeColor,
  } = opts
  const ringPoints: [number, number][][] = []
  for (let row = 0; row <= rows; row++) {
    const v = row / rows
    const theta = -Math.PI / 2 + Math.PI * v
    const ringScaleY = Math.sin(theta)
    const ringScaleX = Math.cos(theta)
    const rowRx = Math.max(0.001, rx * ringScaleX)
    const rowCy = cy + ringScaleY * ry
    const ring: [number, number][] = []
    for (let col = 0; col <= cols; col++) {
      const u = col / cols
      const angle = u * Math.PI * 2
      const noise = 1 + signedNoise(u * 4.7, v * 5.3, row + col + 11) * wobble
      ring.push([
        cx + Math.cos(angle) * rowRx * noise,
        rowCy + Math.sin(angle) * ry * 0.04 * noise,
      ])
    }
    ringPoints.push(ring)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p00 = ringPoints[row]![col]!
      const p01 = ringPoints[row]![col + 1]!
      const p10 = ringPoints[row + 1]![col]!
      const p11 = ringPoints[row + 1]![col + 1]!
      const cellColor = stripeEvery && stripeColor && Math.floor(col / stripeEvery) % 2 === 1 ? stripeColor : baseColor
      fillFacetTriangle(ctx, p00, p10, p11, cellColor, lightColor, shadowColor, lightBiasX, lightBiasY, stroke, strokeWidth)
      fillFacetTriangle(ctx, p00, p11, p01, cellColor, lightColor, shadowColor, lightBiasX, lightBiasY, stroke, strokeWidth)
    }
  }
}

type FacetedRibbonOptions = {
  x: number
  y: number
  width: number
  height: number
  slant: number
  rows: number
  cols: number
  baseColor: string
  lightColor: string
  shadowColor: string
  stripeEvery: number
  stripeColor: string
}

function drawFacetedRibbon(ctx: CanvasRenderingContext2D, opts: FacetedRibbonOptions): void {
  const { x, y, width, height, slant, rows, cols, baseColor, lightColor, shadowColor, stripeEvery, stripeColor } = opts
  const grid: [number, number][][] = []
  for (let row = 0; row <= rows; row++) {
    const t = row / rows
    const rowWidth = width * (1 - t * 0.18)
    const centerX = x + slant * t + Math.sin(t * Math.PI * 1.2) * width * 0.08
    const rowY = y + height * t
    const rowPoints: [number, number][] = []
    for (let col = 0; col <= cols; col++) {
      const u = col / cols
      const bend = Math.sin((u - 0.5) * Math.PI) * width * 0.08
      rowPoints.push([
        centerX + (u - 0.5) * rowWidth + signedNoise(u * 7.1, t * 6.2, row + col + 31) * width * 0.012,
        rowY + bend * 0.22,
      ])
    }
    grid.push(rowPoints)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p00 = grid[row]![col]!
      const p01 = grid[row]![col + 1]!
      const p10 = grid[row + 1]![col]!
      const p11 = grid[row + 1]![col + 1]!
      const color = Math.floor(col / stripeEvery) % 2 === 0 ? baseColor : stripeColor
      fillFacetTriangle(ctx, p00, p10, p11, color, lightColor, shadowColor, -0.18, -0.34, shadowColor, 0.35)
      fillFacetTriangle(ctx, p00, p11, p01, color, lightColor, shadowColor, -0.18, -0.34, shadowColor, 0.35)
    }
  }
}

function drawFacetedNose(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const tip: [number, number] = [cx + r * 1.3, cy]
  const top: [number, number] = [cx - r * 0.42, cy - r * 0.72]
  const bottom: [number, number] = [cx - r * 0.42, cy + r * 0.72]
  const midTop: [number, number] = [cx + r * 0.36, cy - r * 0.30]
  const midBottom: [number, number] = [cx + r * 0.36, cy + r * 0.30]
  fillFacetTriangle(ctx, tip, midTop, midBottom, '#f59e0b', '#fdba74', '#c2410c', -0.25, -0.4, '#c2410c', 0.28)
  fillFacetTriangle(ctx, top, midTop, bottom, '#ea580c', '#fdba74', '#9a3412', -0.25, -0.4, '#9a3412', 0.28)
  fillFacetTriangle(ctx, bottom, midTop, midBottom, '#f97316', '#fdba74', '#c2410c', -0.25, -0.4, '#c2410c', 0.28)
}

function fillFacetTriangle(
  ctx: CanvasRenderingContext2D,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  baseColor: string,
  lightColor: string,
  shadowColor: string,
  lightBiasX: number,
  lightBiasY: number,
  stroke: string,
  strokeWidth: number,
): void {
  const mx = (a[0] + b[0] + c[0]) / 3
  const my = (a[1] + b[1] + c[1]) / 3
  const nx = ((b[1] - a[1]) + (c[1] - b[1]) + (a[1] - c[1])) * 0.02 + lightBiasX
  const ny = -((b[0] - a[0]) + (c[0] - b[0]) + (a[0] - c[0])) * 0.02 + lightBiasY
  const light = Math.max(-1, Math.min(1, nx * 0.85 + ny * 1.1 + signedNoise(mx * 0.01, my * 0.01, 97) * 0.18))
  const tone = light >= 0
    ? lerpHex(baseColor, lightColor, Math.min(0.78, light * 0.72))
    : lerpHex(baseColor, shadowColor, Math.min(0.82, -light * 0.70))
  drawClosedPath(ctx, [a, b, c])
  ctx.fillStyle = tone
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = strokeWidth
  ctx.stroke()
}

function signedNoise(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

function distanceSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function canSeeEntity(
  entity: Entity | undefined,
  state: CombatState,
  canSeePosition: (pos: Vec3 | undefined) => boolean,
): boolean {
  if (!entity) return false
  if (entity.kind === 'objective') return true
  if (entity.kind === 'ship') {
    const ship = entity as ShipEntity
    return ship.team === 'player' || state.detectedByPlayer.has(ship.id)
  }
  if (entity.kind === 'building') {
    const building = entity as BuildingEntity
    return state.detectedByPlayer.has(building.id) || canSeePosition(building.pos)
  }
  if (entity.kind === 'projectile') return canSeePosition((entity as ProjectileEntity).pos)
  return false
}

function battlefieldWeather(state: CombatState): WeatherMode {
  for (const entity of state.entities.values()) {
    if (
      entity.kind === 'ship' &&
      !(entity as ShipEntity).destroyed &&
      (entity as ShipEntity).templateId === 'hull.enemy.boss.dreadnought'
    ) {
      return 'storm'
    }
  }
  return 'clear'
}

function impactWorldRadius(type: WeaponType): number {
  return type === 'torpedo' ? 210 : type === 'missile' ? 185 : type === 'gun' ? 120 : type === 'secondary' ? 90 : 64
}

function weaponTypeFromId(weaponId: string | undefined): WeaponType {
  if (!weaponId) return 'gun'
  if (weaponId.includes('torpedo')) return 'torpedo'
  if (weaponId.includes('missile')) return 'missile'
  if (weaponId.includes('secondary')) return 'secondary'
  if (weaponId.includes('aa')) return 'aa'
  return 'gun'
}

function combatEventEffectKey(ev: CombatEvent): string {
  const p = ev.position
  const tp = ev.targetPosition
  return [
    ev.tick,
    ev.type,
    ev.sourceId ?? '',
    ev.targetId ?? '',
    ev.weaponId ?? '',
    p ? `${Math.round(p.x * 10)},${Math.round(p.y * 10)},${Math.round(p.z * 10)}` : '',
    tp ? `${Math.round(tp.x * 10)},${Math.round(tp.y * 10)},${Math.round(tp.z * 10)}` : '',
  ].join('|')
}

function shipHullPoints(shape: ShipShapeClass, l: number, w: number): [number, number][] {
  if (shape === 'destroyer') {
    return [
      [l, 0],
      [l * 0.66, -w * 0.78],
      [-l * 0.74, -w],
      [-l, -w * 0.42],
      [-l, w * 0.42],
      [-l * 0.74, w],
      [l * 0.66, w * 0.78],
    ]
  }
  if (shape === 'cruiser') {
    return [
      [l, 0],
      [l * 0.78, -w * 0.85],
      [l * 0.18, -w],
      [-l * 0.78, -w * 0.88],
      [-l, -w * 0.55],
      [-l, w * 0.55],
      [-l * 0.78, w * 0.88],
      [l * 0.18, w],
      [l * 0.78, w * 0.85],
    ]
  }
  if (shape === 'yukimura') {
    // 丸みを帯びた雪だるま船体: 船首は小さく尖り、最大幅は中央付近、船尾は広く丸い
    return [
      [l,         0],
      [l * 0.88, -w * 0.50],
      [l * 0.55, -w * 0.90],
      [l * 0.05, -w * 1.00],
      [-l * 0.45, -w * 0.92],
      [-l * 0.82, -w * 0.64],
      [-l,        -w * 0.28],
      [-l,         w * 0.28],
      [-l * 0.82,  w * 0.64],
      [-l * 0.45,  w * 0.92],
      [l * 0.05,   w * 1.00],
      [l * 0.55,   w * 0.90],
      [l * 0.88,   w * 0.50],
    ]
  }
  const sternWidth = shape === 'boss' ? 0.78 : 0.62
  return [
    [l, 0],
    [l * 0.88, -w * 0.62],
    [l * 0.40, -w],
    [-l * 0.72, -w],
    [-l, -w * sternWidth],
    [-l, w * sternWidth],
    [-l * 0.72, w],
    [l * 0.40, w],
    [l * 0.88, w * 0.62],
  ]
}

function superstructureSpec(shape: ShipShapeClass, dim: { l: number; w: number; h: number }): { offset: number; l: number; w: number; h: number } {
  if (shape === 'destroyer') return { offset: -dim.l * 0.03, l: dim.l * 0.22, w: dim.w * 0.46, h: 0.42 }
  if (shape === 'cruiser') return { offset: -dim.l * 0.02, l: dim.l * 0.25, w: dim.w * 0.54, h: 0.58 }
  if (shape === 'yukimura') return { offset: -dim.l * 0.02, l: dim.l * 0.28, w: dim.w * 0.60, h: 0.72 }
  if (shape === 'boss') return { offset: -dim.l * 0.04, l: dim.l * 0.34, w: dim.w * 0.62, h: 0.82 }
  return { offset: -dim.l * 0.03, l: dim.l * 0.30, w: dim.w * 0.58, h: 0.70 }
}

function turretLayout(shape: ShipShapeClass, dim: { l: number; w: number }): Array<{ lon: number; lat: number; radius: number; barrels: number }> {
  if (shape === 'destroyer') {
    return [
      { lon: dim.l * 0.26, lat: 0, radius: dim.w * 0.20, barrels: 1 },
    ]
  }
  if (shape === 'cruiser') {
    return [
      { lon: dim.l * 0.27, lat: 0, radius: dim.w * 0.18, barrels: 2 },
      { lon: -dim.l * 0.28, lat: 0, radius: dim.w * 0.18, barrels: 2 },
    ]
  }
  if (shape === 'boss') {
    return [
      { lon: dim.l * 0.34, lat: 0, radius: dim.w * 0.19, barrels: 3 },
      { lon: dim.l * 0.12, lat: 0, radius: dim.w * 0.18, barrels: 3 },
      { lon: -dim.l * 0.34, lat: 0, radius: dim.w * 0.19, barrels: 3 },
      { lon: -dim.l * 0.08, lat: -dim.w * 0.28, radius: dim.w * 0.12, barrels: 2 },
      { lon: -dim.l * 0.08, lat: dim.w * 0.28, radius: dim.w * 0.12, barrels: 2 },
    ]
  }
  if (shape === 'yukimura') {
    return [
      { lon: dim.l * 0.34, lat: 0, radius: dim.w * 0.17, barrels: 2 },
      { lon: dim.l * 0.08, lat: 0, radius: dim.w * 0.16, barrels: 2 },
      { lon: -dim.l * 0.32, lat: 0, radius: dim.w * 0.17, barrels: 2 },
      { lon: -dim.l * 0.08, lat: dim.w * 0.30, radius: dim.w * 0.11, barrels: 2 },
      { lon: -dim.l * 0.08, lat: -dim.w * 0.30, radius: dim.w * 0.11, barrels: 2 },
    ]
  }
  return [
    { lon: dim.l * 0.34, lat: 0, radius: dim.w * 0.18, barrels: 2 },
    { lon: dim.l * 0.10, lat: 0, radius: dim.w * 0.17, barrels: 2 },
    { lon: -dim.l * 0.32, lat: 0, radius: dim.w * 0.18, barrels: 2 },
    { lon: -dim.l * 0.08, lat: dim.w * 0.28, radius: dim.w * 0.12, barrels: 2 },
    { lon: -dim.l * 0.08, lat: -dim.w * 0.28, radius: dim.w * 0.12, barrels: 2 },
  ]
}
