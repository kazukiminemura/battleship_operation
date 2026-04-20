import type { BuildingEntity, CombatEvent, CombatState, Entity, MapObstacle, ShipEntity, ProjectileEntity, Vec3, WeaponState, WeaponType } from '../simulation/types'
import { isOnLand, WORLD_SIZE } from '../simulation/movement'
import { getWeaponConfig } from '../simulation/weapon-strategies'
import { renderShipExplosions } from './effects-renderer'
import { renderProjectile as renderProjectileEntity } from './projectile-renderer'
import { SHIP_DIMS, SHIP_SHAPES, type ShipShapeClass } from './ship-rendering-data'
import { ShipWakeRenderer } from './wake-renderer'

// Isometric projection parameters
interface IsoParams {
  scale: number    // world units → screen pixels (horizontal component)
  ox: number       // screen origin X (maps world 0,0 → ox, oy in screen)
  oy: number
}

const HUD_TOP    = 134
const HUD_BOTTOM = 32

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private iso: IsoParams = { scale: 0.08, ox: 0, oy: 0 }
  private camX = 5000
  private camY = 5000
  // イベントはシミュレーション毎ティック消去されるためレンダラー側で蓄積
  private effectLog: CombatEvent[] = []
  private effectKeys = new Set<string>()
  private shipWakeRenderer = new ShipWakeRenderer()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  setCamera(x: number, y: number): void {
    this.camX = x
    this.camY = y
  }

  private resize(): void {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.recalcIso()
  }

  private recalcIso(): void {
    const W = this.canvas.width
    const contentH = this.canvas.height - HUD_TOP - HUD_BOTTOM
    // Tactical zoom: keep ships small and show a wider battle area.
    const scale = Math.min(W / 6200, contentH / 3500)
    this.iso = {
      scale,
      ox: W / 2,
      oy: HUD_TOP + contentH / 2,
    }
  }

  // World → screen (camera-relative isometric)
  w2s(wx: number, wy: number): [number, number] {
    const { scale, ox, oy } = this.iso
    const rx = wx - this.camX
    const ry = wy - this.camY
    return [
      ox + (rx - ry) * scale,
      oy + (rx + ry) * scale * 0.5,
    ]
  }

  // Screen → world (inverse isometric)
  s2w(sx: number, sy: number): [number, number] {
    const { scale, ox, oy } = this.iso
    const dx = sx - ox
    const dy = sy - oy
    return [
      (dx / scale + dy / (scale * 0.5)) / 2 + this.camX,
      (dy / (scale * 0.5) - dx / scale) / 2 + this.camY,
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
    const MAX_EFFECT_AGE = 70
    this.effectLog = this.effectLog.filter(ev => state.tick - ev.tick < MAX_EFFECT_AGE)
    this.effectKeys = new Set(this.effectLog.map(combatEventEffectKey))

    this.renderOcean()
    this.renderGrid()
    this.renderIslands(state.mapObstacles)

    // Range ellipse for selected weapon
    if (selectedWeapon) {
      const player = state.entities.get('ship.player') as ShipEntity | undefined
      if (player && !player.destroyed) this.renderRangeEllipse(player, selectedWeapon)
    }

    // Depth-sort ships by world Y (higher Y = further south = drawn later / on top)
    const ships = ([...state.entities.values()]
      .filter(e => e.kind === 'ship' && !(e as ShipEntity).destroyed) as ShipEntity[])
      .sort((a, b) => a.pos.y - b.pos.y)

    this.shipWakeRenderer.update(ships, state.tick)

    const projectiles = [...state.entities.values()]
      .filter(e => e.kind === 'projectile' && !(e as ProjectileEntity).destroyed) as ProjectileEntity[]

    const buildings = ([...state.entities.values()]
      .filter(e => e.kind === 'building') as BuildingEntity[])
      .sort((a, b) => a.pos.y - b.pos.y)

    this.renderWaterSplashes(this.effectLog, state.tick, state.mapObstacles)
    for (const b of buildings)   this.renderBuilding(b)
    for (const p of projectiles) this.renderProjectile(p)
    this.renderMuzzleBursts(this.effectLog, state.tick)
    this.shipWakeRenderer.render(this.ctx, this.iso, this.w2s.bind(this), ships, state.tick)
    for (const s of ships)       this.renderShip(s, state.tick)
    this.renderLandDust(this.effectLog, state.tick, state.entities, state.mapObstacles)
    renderShipExplosions(this.ctx, this.iso, this.w2s.bind(this), this.effectLog, state.tick, state.entities)

    if (selectedWeapon && aimPoint) {
      const player = state.entities.get('ship.player') as ShipEntity | undefined
      if (player && !player.destroyed) this.renderAimPointer(player, selectedWeapon, aimPoint, state.mapObstacles)
    }

    this.renderTacticalAtmosphere()
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

  private renderOcean(): void {
    const { ctx } = this
    // Full canvas background, styled like a dim tactical sea chart.
    ctx.fillStyle = '#04111f'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

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
    grad.addColorStop(0, '#0d4f8f')
    grad.addColorStop(0.42, '#0a3669')
    grad.addColorStop(1, '#061d3c')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.strokeStyle = 'rgba(102,194,255,0.24)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    this.renderSurfaceGrain()
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

  private renderSurfaceGrain(): void {
    const { ctx } = this
    const count = Math.round((this.canvas.width * this.canvas.height) / 5200)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < count; i++) {
      const nx = signedNoise(this.camX * 0.013, this.camY * 0.017, i + 500)
      const ny = signedNoise(this.camY * 0.011, this.camX * 0.019, i + 900)
      const x = (nx * 0.5 + 0.5) * this.canvas.width
      const y = HUD_TOP + (ny * 0.5 + 0.5) * (this.canvas.height - HUD_TOP - HUD_BOTTOM)
      const a = 0.025 + Math.abs(signedNoise(this.camX, this.camY, i + 1300)) * 0.055
      ctx.fillStyle = i % 4 === 0 ? `rgba(164,225,255,${a})` : `rgba(80,170,220,${a})`
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1)
    }
    ctx.restore()
  }

  // ── island and buildings ──────────────────────────────────────────────────

  private renderIslands(obstacles: readonly MapObstacle[]): void {
    for (const obstacle of obstacles) this.renderIsland(obstacle)
  }

  private renderIsland(obstacle: MapObstacle): void {
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

    // Small elevation patches make the island read as land rather than a flat decal.
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

    // Thin surf strokes around the coast.
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
    const hPx = dim.h * iso.scale * 0.9   // hull height in screen pixels

    const cosA = Math.cos(ship.angle)
    const sinA = Math.sin(ship.angle)
    const localToWorld = (lon: number, lat: number): [number, number] => [
      ship.pos.x + cosA * lon + sinA * lat,
      ship.pos.y + sinA * lon - cosA * lat,
    ]

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

      if (shape === 'battleship' || shape === 'boss') {
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
    ctx.strokeStyle = 'rgba(226,232,240,0.20)'
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

  private renderTacticalAtmosphere(): void {
    const { ctx, canvas } = this
    const cx = canvas.width / 2
    const cy = HUD_TOP + (canvas.height - HUD_TOP - HUD_BOTTOM) / 2
    const radius = Math.max(canvas.width, canvas.height) * 0.72

    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius)
    vignette.addColorStop(0, 'rgba(255,255,255,0)')
    vignette.addColorStop(0.62, 'rgba(116,86,19,0.10)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, HUD_TOP, canvas.width, canvas.height - HUD_TOP - HUD_BOTTOM)
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(246,203,65,0.045)'
    for (let y = HUD_TOP; y < canvas.height - HUD_BOTTOM; y += 3) {
      ctx.fillRect(0, y, canvas.width, 1)
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

function signedNoise(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
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
  return [
    { lon: dim.l * 0.34, lat: 0, radius: dim.w * 0.18, barrels: 2 },
    { lon: dim.l * 0.10, lat: 0, radius: dim.w * 0.17, barrels: 2 },
    { lon: -dim.l * 0.32, lat: 0, radius: dim.w * 0.18, barrels: 2 },
    { lon: -dim.l * 0.08, lat: dim.w * 0.28, radius: dim.w * 0.12, barrels: 2 },
    { lon: -dim.l * 0.08, lat: -dim.w * 0.28, radius: dim.w * 0.12, barrels: 2 },
  ]
}
