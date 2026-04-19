import type { CombatState, ShipEntity, ProjectileEntity, WeaponType } from '../simulation/types'
import { WORLD_SIZE } from '../simulation/movement'
import { WEAPON_CONFIGS } from '../simulation/weapons'

// Ship physical dimensions in world units (length, width, height)
const SHIP_DIMS: Record<string, { l: number; w: number; h: number }> = {
  'hull.destroyer.basic':       { l: 130, w: 28, h: 15 },  // player
  'hull.enemy.destroyer.basic': { l: 90,  w: 20, h: 11 },  // small enemy
  'hull.cruiser.basic':         { l: 165, w: 36, h: 22 },  // large enemy
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize(): void {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.recalcIso()
  }

  private recalcIso(): void {
    const W = this.canvas.width
    const H = this.canvas.height - HUD_TOP - HUD_BOTTOM
    // diamond width = 2*WORLD_SIZE*scale, height = WORLD_SIZE*scale
    const scale = Math.min(W / (2 * WORLD_SIZE), H / WORLD_SIZE) * 0.96
    this.iso = {
      scale,
      ox: W / 2,                                          // world(0,0) → center of diamond top
      oy: HUD_TOP + (H - WORLD_SIZE * scale) / 2,
    }
  }

  // World → screen (isometric: x-axis goes right+down, y-axis goes left+down)
  w2s(wx: number, wy: number): [number, number] {
    const { scale, ox, oy } = this.iso
    return [
      ox + (wx - wy) * scale,
      oy + (wx + wy) * scale * 0.5,
    ]
  }

  // Screen → world (inverse isometric)
  s2w(sx: number, sy: number): [number, number] {
    const { scale, ox, oy } = this.iso
    const dx = sx - ox
    const dy = sy - oy
    return [
      (dx / scale + dy / (scale * 0.5)) / 2,
      (dy / (scale * 0.5) - dx / scale) / 2,
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

    for (const p of projectiles) this.renderProjectile(p)
    for (const s of ships)       this.renderShip(s)
  }

  // ── ocean ──────────────────────────────────────────────────────────────────

  private renderOcean(): void {
    const { ctx } = this
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
    const step = 500
    for (let i = step; i < WORLD_SIZE; i += step) {
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

    if (proj.weaponType === 'torpedo') {
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
      // trail
      const [tx, ty] = this.w2s(proj.pos.x - proj.vel.x * 5, proj.pos.y - proj.vel.y * 5)
      ctx.beginPath()
      ctx.moveTo(sx, sy); ctx.lineTo(tx, ty)
      ctx.strokeStyle = 'rgba(167,139,250,0.5)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(sx, sy, 4 * iso.scale, 0, Math.PI * 2)
      ctx.fillStyle = '#c4b5fd'
      ctx.fill()
    } else {
      const r = proj.weaponType === 'gun' ? 2.5 : 2
      ctx.beginPath()
      ctx.arc(sx, sy, r * iso.scale, 0, Math.PI * 2)
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
