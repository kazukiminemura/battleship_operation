import type { CombatState, ShipEntity, ProjectileEntity, WeaponType } from '../simulation/types'
import { WORLD_SIZE } from '../simulation/movement'
import { WEAPON_CONFIGS } from '../simulation/weapons'

// Ship physical dimensions in world units (length, width, height)
const SHIP_DIMS: Record<string, { l: number; w: number; h: number }> = {
  'hull.destroyer.basic':       { l: 130, w: 28, h: 15 },
  'hull.enemy.destroyer.basic': { l: 90,  w: 20, h: 11 },
  'hull.cruiser.basic':         { l: 165, w: 36, h: 22 },
  'hull.cruiser.player':        { l: 190, w: 44, h: 27 },
  'hull.battleship.basic':      { l: 255, w: 62, h: 38 },
}

// Isometric projection parameters
interface IsoParams {
  scale: number    // world units → screen pixels (horizontal component)
  ox: number       // screen origin X (maps world 0,0 → ox, oy in screen)
  oy: number
}

const HUD_TOP    = 72
const HUD_BOTTOM = 32

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private iso: IsoParams = { scale: 0.08, ox: 0, oy: 0 }
  private camX = 5000
  private camY = 5000

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
    // Fixed zoom: show ~4000 world units horizontally
    const scale = Math.min(W / 4000, contentH / 2000)
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

  render(state: CombatState, selectedWeapon?: WeaponType): void {
    this.recalcIso()
    const { ctx } = this
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.renderOcean()
    this.renderGrid()

    // Range ellipse for selected weapon
    if (selectedWeapon) {
      const player = state.entities.get('ship.player') as ShipEntity | undefined
      if (player && !player.destroyed) this.renderRangeEllipse(player, selectedWeapon)
    }

    // Depth-sort ships by world Y (higher Y = further south = drawn later / on top)
    const ships = ([...state.entities.values()]
      .filter(e => e.kind === 'ship' && !(e as ShipEntity).destroyed) as ShipEntity[])
      .sort((a, b) => a.pos.y - b.pos.y)

    const projectiles = [...state.entities.values()]
      .filter(e => e.kind === 'projectile' && !(e as ProjectileEntity).destroyed) as ProjectileEntity[]

    this.renderSplashes(state)
    for (const p of projectiles) this.renderProjectile(p)
    for (const s of ships)       this.renderShip(s)
  }

  // ── water splashes ─────────────────────────────────────────────────────────

  private static readonly SPLASH_TICKS = 40

  private renderSplashes(state: CombatState): void {
    const { ctx } = this
    const D = CanvasRenderer.SPLASH_TICKS

    for (const ev of state.eventLog) {
      if (ev.type !== 'weapon.missed' || !ev.position) continue
      const age = state.tick - ev.tick
      if (age < 0 || age >= D) continue

      const t   = age / D
      const pos = ev.position
      const wtype = (ev.weaponId ?? 'gun') as WeaponType
      const s   = this.iso.scale
      const [cx, cy] = this.w2s(pos.x, pos.y)

      // Weapon-specific sizing (world units)
      const maxR = wtype === 'torpedo' ? 190 : wtype === 'missile' ? 150 : wtype === 'gun' ? 85 : 42
      const N    = wtype === 'torpedo' ? 22  : wtype === 'missile' ? 16  : wtype === 'gun' ? 12 : 7
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

  // ── ocean ──────────────────────────────────────────────────────────────────

  private renderOcean(): void {
    const { ctx } = this
    // Full canvas background (ocean beyond world bounds)
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
    grad.addColorStop(0, '#0d3f78')
    grad.addColorStop(0.5, '#092e5a')
    grad.addColorStop(1, '#061c38')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.strokeStyle = '#1a5a8a'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private renderGrid(): void {
    const { ctx } = this
    ctx.strokeStyle = 'rgba(16,56,100,0.45)'
    ctx.lineWidth = 0.6
    const step = 1000
    for (let i = 0; i <= WORLD_SIZE; i += step) {
      const [ax, ay] = this.w2s(i, 0)
      const [bx, by] = this.w2s(i, WORLD_SIZE)
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
      const [cx, cy] = this.w2s(0, i)
      const [dx, dy] = this.w2s(WORLD_SIZE, i)
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke()
    }
  }

  // ── ship ───────────────────────────────────────────────────────────────────

  private renderShip(ship: ShipEntity): void {
    const { ctx, iso } = this
    const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
    const L = dim.l / 2
    const W = dim.w / 2
    const hPx = dim.h * iso.scale * 0.9   // hull height in screen pixels

    const cosA = Math.cos(ship.angle)
    const sinA = Math.sin(ship.angle)

    // 4 deck corners in world space (CCW-ish in screen)
    const wc: [number, number][] = [
      [ship.pos.x + cosA * L + sinA * W, ship.pos.y + sinA * L - cosA * W],
      [ship.pos.x + cosA * L - sinA * W, ship.pos.y + sinA * L + cosA * W],
      [ship.pos.x - cosA * L - sinA * W, ship.pos.y - sinA * L + cosA * W],
      [ship.pos.x - cosA * L + sinA * W, ship.pos.y - sinA * L - cosA * W],
    ]
    const sc = wc.map(([x, y]) => this.w2s(x, y)) as [number, number][]

    // Signed area → determine winding (positive = CCW in screen with Y down)
    let area = 0
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = sc[i]!
      const [x1, y1] = sc[(i + 1) % 4]!
      area += x0 * y1 - x1 * y0
    }
    const ccw = area > 0

    const isPlayer  = ship.team === 'player'
    const isCruiser = ship.templateId === 'hull.cruiser.basic'
    const topColor  = isPlayer
      ? (isCruiser ? '#1d4ed8' : '#2563eb')
      : (isCruiser ? '#b91c1c' : '#dc2626')
    const sideColor = isPlayer ? '#172554' : '#450a0a'
    const rimColor  = isPlayer ? '#93c5fd' : '#fca5a5'

    // 1. Shadow
    ctx.beginPath()
    ctx.moveTo(sc[0]![0] + 3, sc[0]![1] + 4)
    for (let i = 1; i < 4; i++) ctx.lineTo(sc[i]![0] + 3, sc[i]![1] + 4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.fill()

    // 2. Visible side faces
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
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
    for (let i = 1; i < 4; i++) ctx.lineTo(sc[i]![0], sc[i]![1] - hPx)
    ctx.closePath()
    ctx.fillStyle = topColor
    ctx.fill()
    ctx.strokeStyle = rimColor
    ctx.lineWidth = 0.8
    ctx.stroke()

    // 4. Bow tip
    const [bowSx, bowSy] = this.w2s(
      ship.pos.x + cosA * (L + dim.l * 0.12),
      ship.pos.y + sinA * (L + dim.l * 0.12),
    )
    ctx.beginPath()
    ctx.moveTo(sc[0]![0], sc[0]![1] - hPx * 0.7)
    ctx.lineTo(sc[1]![0], sc[1]![1] - hPx * 0.7)
    ctx.lineTo(bowSx, bowSy - hPx * 0.3)
    ctx.closePath()
    ctx.fillStyle = rimColor
    ctx.fill()

    // 5. Superstructure (small box on center of deck)
    if (dim.h >= 13) {
      const sL = dim.l * 0.18
      const sW = dim.w * 0.45
      const superWc: [number, number][] = [
        [ship.pos.x + cosA * sL + sinA * sW, ship.pos.y + sinA * sL - cosA * sW],
        [ship.pos.x + cosA * sL - sinA * sW, ship.pos.y + sinA * sL + cosA * sW],
        [ship.pos.x - cosA * sL - sinA * sW, ship.pos.y - sinA * sL + cosA * sW],
        [ship.pos.x - cosA * sL + sinA * sW, ship.pos.y - sinA * sL - cosA * sW],
      ]
      const ss = superWc.map(([x, y]) => this.w2s(x, y)) as [number, number][]
      const sHpx = hPx * 0.6

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
    }

    // 6. HP bar
    const [cx, cy] = this.w2s(ship.pos.x, ship.pos.y)
    const barW = dim.l * iso.scale * 0.65
    const barY = cy - hPx - 11
    const hpRatio = ship.hp / ship.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(cx - barW / 2 - 1, barY - 1, barW + 2, 6)
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444'
    ctx.fillRect(cx - barW / 2, barY, barW * hpRatio, 4)
  }

  // ── projectile ─────────────────────────────────────────────────────────────

  private renderProjectile(proj: ProjectileEntity): void {
    const { ctx, iso } = this
    const [sx, sy] = this.w2s(proj.pos.x, proj.pos.y)

    // parabolic arc: sin-curve from 0 → peak → 0 over lifetime
    const progress = proj.initialLifetime > 0
      ? (proj.initialLifetime - proj.lifetime) / proj.initialLifetime
      : 0
    const arcPx = proj.maxHeight * Math.sin(Math.PI * progress) * iso.scale

    if (proj.weaponType === 'torpedo') {
      // torpedoes stay flat (maxHeight=0), draw wake trail
      const [tx, ty] = this.w2s(proj.pos.x - proj.vel.x * 6, proj.pos.y - proj.vel.y * 6)
      ctx.beginPath()
      ctx.moveTo(sx, sy); ctx.lineTo(tx, ty)
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 3 * iso.scale
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(sx, sy, 3 * iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = '#fb923c'
      ctx.fill()
    } else if (proj.weaponType === 'missile') {
      const elevated = sy - arcPx
      // shadow on ocean
      ctx.beginPath()
      ctx.arc(sx, sy, 2.5 * iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fill()
      // vertical drop line
      if (arcPx > 2) {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, elevated)
        ctx.strokeStyle = 'rgba(196,181,253,0.2)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
      // smoke trail (to previous position)
      const [tx, ty] = this.w2s(proj.pos.x - proj.vel.x * 5, proj.pos.y - proj.vel.y * 5)
      const trailProgress = Math.max(0, progress - 0.08)
      const trailArcPx = proj.maxHeight * Math.sin(Math.PI * trailProgress) * iso.scale
      ctx.beginPath()
      ctx.moveTo(sx, elevated); ctx.lineTo(tx, ty - trailArcPx)
      ctx.strokeStyle = 'rgba(167,139,250,0.45)'
      ctx.lineWidth = 2
      ctx.stroke()
      // projectile dot
      ctx.beginPath()
      ctx.arc(sx, elevated, 4 * iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = '#c4b5fd'
      ctx.fill()
    } else {
      // gun or aa: arcing shell
      const elevated = sy - arcPx
      const r = proj.weaponType === 'gun' ? 2.5 : 1.8
      // shadow
      ctx.beginPath()
      ctx.arc(sx, sy, r * 0.7 * iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fill()
      // drop line
      if (arcPx > 2) {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, elevated)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(sx, elevated, r * iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = proj.weaponType === 'gun' ? '#fbbf24' : '#67e8f9'
      ctx.fill()
    }
  }

  // ── range ellipse (isometric circle = ellipse) ─────────────────────────────

  private renderRangeEllipse(player: ShipEntity, weaponType: WeaponType): void {
    const { ctx } = this
    const cfg = WEAPON_CONFIGS[weaponType]
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
      gun:     'rgba(251,191,36,0.06)',
      torpedo: 'rgba(249,115,22,0.06)',
      aa:      'rgba(103,232,249,0.06)',
      missile: 'rgba(167,139,250,0.06)',
    }
    const strokes: Record<WeaponType, string> = {
      gun:     'rgba(251,191,36,0.45)',
      torpedo: 'rgba(249,115,22,0.45)',
      aa:      'rgba(103,232,249,0.45)',
      missile: 'rgba(167,139,250,0.45)',
    }

    ctx.fillStyle = fills[weaponType]
    ctx.fill()
    ctx.strokeStyle = strokes[weaponType]
    ctx.lineWidth = 1.2
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])
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

function signedNoise(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}
