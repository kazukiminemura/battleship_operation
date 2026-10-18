import type { ShipEntity } from '../simulation/types'

interface ProjectionContext {
  scale: number
}

type WorldToScreen = (wx: number, wy: number) => [number, number]

interface SternTrailPoint {
  x: number
  y: number
  speed: number
  tick: number
}

interface WakeSprites {
  foamLg: OffscreenCanvas
  foamSm: OffscreenCanvas
  foamMist: OffscreenCanvas
  sternWash: OffscreenCanvas
}

const TRAIL_HISTORY = 84
const TRAIL_RECORD_INTERVAL = 2
export type WaterlinePoint = (ship: ShipEntity, longitudinal: number, lateral?: number) => { x: number; y: number } | undefined

export class ShipWakeRenderer {
  private trails = new Map<string, SternTrailPoint[]>()
  private sprites: WakeSprites | null = null
  private lastRecordedTick = -1

  update(ships: ShipEntity[], tick: number, waterline: WaterlinePoint): void {
    if (tick === this.lastRecordedTick) return
    if (tick < this.lastRecordedTick) this.trails.clear()
    this.lastRecordedTick = tick
    const alive = new Set<string>()
    for (const ship of ships) {
      alive.add(ship.id)
      if (tick % TRAIL_RECORD_INTERVAL !== 0) continue
      const stern = waterline(ship, -0.5)
      if (!stern) continue
      let trail = this.trails.get(ship.id)
      if (!trail) { trail = []; this.trails.set(ship.id, trail) }
      if (Math.abs(ship.speed) > 0.03) trail.push({ x: stern.x, y: stern.y, speed: Math.abs(ship.speed), tick })
      while (trail.length && (trail.length > TRAIL_HISTORY || tick - trail[0]!.tick >= TRAIL_HISTORY * TRAIL_RECORD_INTERVAL)) trail.shift()
    }

    for (const id of this.trails.keys()) {
      if (!alive.has(id)) this.trails.delete(id)
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    iso: ProjectionContext,
    w2s: WorldToScreen,
    ships: ShipEntity[],
    tick: number,
    waterline: WaterlinePoint,
  ): void {
    if (!this.sprites) this.sprites = buildWakeSprites()
    const sp = this.sprites

    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    for (const ship of ships) {
      const currentStern = waterline(ship, -0.5)
      const bow = waterline(ship, 0.5)
      const port = waterline(ship, 0, -0.5)
      const starboard = waterline(ship, 0, 0.5)
      if (!currentStern || !bow || !port || !starboard) continue
      const [sx, sy] = w2s(currentStern.x, currentStern.y)
      const [bx, by] = w2s(bow.x, bow.y)
      const [px, py] = w2s(port.x, port.y)
      const [tx, ty] = w2s(starboard.x, starboard.y)
      const screenAngle = Math.atan2(by - sy, bx - sx)
      const beam = Math.hypot(tx - px, ty - py)
      const speedF = ship.maxSpeed > 0 ? Math.min(1, Math.abs(ship.speed) / ship.maxSpeed) : 0
      const sternAlpha = 0.44 + speedF * 0.38
      const baseSize = Math.max(3, beam * (0.40 + speedF * 0.50))
      const trail = [
        ...(this.trails.get(ship.id) ?? []),
        ...(speedF > 0.03 ? [{ x: currentStern.x, y: currentStern.y, speed: Math.abs(ship.speed), tick }] : []),
      ]

      drawSternTrail(ctx, sp, w2s, trail, tick, baseSize, sternAlpha)
      if (speedF > 0.03) {
        ctx.globalAlpha = speedF * 0.48
        drawFoam(ctx, sp.sternWash, sx - Math.cos(screenAngle) * baseSize * 1.75, sy - Math.sin(screenAngle) * baseSize * 1.75, screenAngle, baseSize * 3.5, baseSize * 1.6)
      }
    }

    ctx.restore()
  }
}

function drawSternTrail(
  ctx: CanvasRenderingContext2D,
  sp: WakeSprites,
  w2s: WorldToScreen,
  trail: SternTrailPoint[],
  tick: number,
  baseSize: number,
  alpha: number,
): void {
  if (trail.length < 2) return

  const maxAge = TRAIL_HISTORY * TRAIL_RECORD_INTERVAL
  const screenTrail = trail.map(point => ({ ...point, screen: w2s(point.x, point.y) as [number, number] }))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Centerline: this is the actual stern path, so it always starts at the stern center.
  for (let i = 1; i < screenTrail.length; i++) {
    const prev = screenTrail[i - 1]!
    const next = screenTrail[i]!
    const age = Math.max(0, tick - next.tick)
    const fade = Math.max(0, 1 - age / maxAge)

    const spread = baseSize * (0.9 + (1 - fade) * 1.7)
    ctx.globalAlpha = alpha * fade * fade * 0.52
    ctx.strokeStyle = 'rgba(203,232,230,0.68)'
    ctx.lineWidth = Math.max(2, spread)
    ctx.beginPath()
    ctx.moveTo(prev.screen[0], prev.screen[1])
    ctx.lineTo(next.screen[0], next.screen[1])
    ctx.stroke()

    ctx.globalAlpha = alpha * Math.pow(fade, 1.3) * 0.75
    ctx.strokeStyle = 'rgba(238,252,255,0.62)'
    ctx.lineWidth = Math.max(0.7, baseSize * (0.35 + fade * 0.45))
    ctx.beginPath()
    ctx.moveTo(prev.screen[0], prev.screen[1])
    ctx.lineTo(next.screen[0], next.screen[1])
    ctx.stroke()
  }

  for (let i = 0; i < screenTrail.length - 2; i += 2) {
    const point = screenTrail[i]!
    const age = Math.max(0, tick - point.tick)
    if (age < 8) continue
    const fade = Math.max(0, 1 - age / maxAge)
    const size = baseSize * (1.0 + (1 - fade) * 1.8)
    ctx.globalAlpha = alpha * fade * 0.32
    drawFoam(ctx, sp.foamMist, point.screen[0], point.screen[1], 0, size * 2.10, size * 1.10)
    ctx.globalAlpha = alpha * fade * 0.55
    drawFoam(ctx, sp.foamLg, point.screen[0], point.screen[1], 0, size * 1.45, size * 0.82)
  }

  // Turn splash: start from the stern path, then open outward only after the root.
  for (let i = 2; i < screenTrail.length - 1; i += 2) {
    const prev = screenTrail[i - 2]!
    const point = screenTrail[i]!
    const next = screenTrail[i + 1]!
    const age = Math.max(0, tick - point.tick)
    if (age < 8) continue
    const fade = Math.max(0, 1 - age / maxAge)
    const rootOpen = smoothstep(0.10, 0.34, age / maxAge)
    if (rootOpen <= 0.01) continue

    const ax = point.screen[0] - prev.screen[0]
    const ay = point.screen[1] - prev.screen[1]
    const bx = next.screen[0] - point.screen[0]
    const by = next.screen[1] - point.screen[1]
    const turn = clamp((ax * by - ay * bx) / 28, -1, 1)
    if (Math.abs(turn) < 0.10) continue

    const len = Math.hypot(bx, by) || 1
    const nx = -by / len
    const ny = bx / len
    const side = Math.sign(turn)
    const offset = baseSize * (1.10 + Math.abs(turn) * 1.40) * rootOpen
    const size = baseSize * (0.70 + Math.abs(turn) * 0.55) * fade

    ctx.globalAlpha = alpha * fade * Math.abs(turn) * 0.18
    drawFoam(ctx, sp.foamMist, point.screen[0] + nx * side * offset, point.screen[1] + ny * side * offset, Math.atan2(by, bx), size * 2.10, size)
    ctx.globalAlpha = alpha * fade * Math.abs(turn) * 0.38
    drawFoam(ctx, sp.foamLg, point.screen[0] + nx * side * offset, point.screen[1] + ny * side * offset, Math.atan2(by, bx), size * 1.35, size * 0.78)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return x * x * (3 - 2 * x)
}

function drawFoam(
  ctx: CanvasRenderingContext2D,
  sprite: OffscreenCanvas,
  x: number,
  y: number,
  angle: number,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.drawImage(sprite, -width / 2, -height / 2, width, height)
  ctx.restore()
}

function signedNoise(a: number, b: number, c: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

function buildWakeSprites(): WakeSprites {
  const foamLgOC = buildFoamSprite(40, 24, 34, 0.82)
  const foamSmOC = buildFoamSprite(20, 14, 16, 0.74)
  const foamMistOC = buildFoamSprite(64, 28, 42, 0.34)

  const sternOC = new OffscreenCanvas(56, 56)
  const stCtx = sternOC.getContext('2d')!
  const stGrad = stCtx.createRadialGradient(28, 28, 0, 28, 28, 28)
  stGrad.addColorStop(0, 'rgba(255,255,255,0.85)')
  stGrad.addColorStop(0.30, 'rgba(220,248,255,0.60)')
  stGrad.addColorStop(0.65, 'rgba(190,235,255,0.25)')
  stGrad.addColorStop(1, 'rgba(180,230,255,0)')
  stCtx.beginPath(); stCtx.arc(28, 28, 28, 0, Math.PI * 2)
  stCtx.fillStyle = stGrad; stCtx.fill()

  return { foamLg: foamLgOC, foamSm: foamSmOC, foamMist: foamMistOC, sternWash: sternOC }
}

function buildFoamSprite(width: number, height: number, bubbles: number, strength: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  const cx = width / 2
  const cy = height / 2
  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.55)
  base.addColorStop(0, `rgba(245,253,255,${0.40 * strength})`)
  base.addColorStop(0.42, `rgba(206,240,250,${0.26 * strength})`)
  base.addColorStop(1, 'rgba(180,230,245,0)')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  ctx.lineCap = 'round'
  for (let i = 0; i < bubbles; i++) {
    const n1 = deterministic01(i, width, height)
    const n2 = deterministic01(i + 97, height, width)
    const n3 = deterministic01(i + 211, width + height, bubbles)
    const x = cx + (n1 - 0.5) * width * 0.82
    const y = cy + (n2 - 0.5) * height * 0.72
    const r = (0.45 + n3 * 1.80) * Math.min(width, height) / 18
    const dot = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6)
    dot.addColorStop(0, `rgba(255,255,255,${0.88 * strength})`)
    dot.addColorStop(0.35, `rgba(232,250,255,${0.48 * strength})`)
    dot.addColorStop(1, 'rgba(200,240,255,0)')
    ctx.beginPath()
    ctx.ellipse(x, y, r * (1.4 + n1 * 1.8), r * (0.55 + n2 * 0.75), n3 * Math.PI, 0, Math.PI * 2)
    ctx.fillStyle = dot
    ctx.fill()
  }

  for (let i = 0; i < 5; i++) {
    const y = cy + (deterministic01(i + 401, width, height) - 0.5) * height * 0.46
    ctx.beginPath()
    ctx.moveTo(width * 0.16, y)
    ctx.bezierCurveTo(width * 0.36, y - height * 0.16, width * 0.62, y + height * 0.16, width * 0.86, y)
    ctx.strokeStyle = `rgba(255,255,255,${0.12 * strength})`
    ctx.lineWidth = Math.max(0.5, height * 0.035)
    ctx.stroke()
  }

  return canvas
}

function deterministic01(a: number, b: number, c: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453
  return n - Math.floor(n)
}
