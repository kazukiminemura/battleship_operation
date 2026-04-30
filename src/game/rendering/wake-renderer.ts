import type { ShipEntity } from '../simulation/types'
import { SHIP_DIMS } from './ship-rendering-data'

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
  bowWave: OffscreenCanvas
  foamLg: OffscreenCanvas
  foamSm: OffscreenCanvas
  foamMist: OffscreenCanvas
  sternWash: OffscreenCanvas
}

const TRAIL_HISTORY = 46
const TRAIL_RECORD_INTERVAL = 2
const STERN_WAKE_OFFSET = 0.62

export class ShipWakeRenderer {
  private trails = new Map<string, SternTrailPoint[]>()
  private sprites: WakeSprites | null = null

  update(ships: ShipEntity[], tick: number): void {
    const alive = new Set<string>()
    for (const ship of ships) {
      alive.add(ship.id)
      if (tick % TRAIL_RECORD_INTERVAL !== 0) continue
      const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
      const cosA = Math.cos(ship.angle)
      const sinA = Math.sin(ship.angle)
      const stern = localPoint(ship, cosA, sinA, -dim.l * STERN_WAKE_OFFSET, 0)
      let trail = this.trails.get(ship.id)
      if (!trail) { trail = []; this.trails.set(ship.id, trail) }
      trail.push({ x: stern.x, y: stern.y, speed: Math.abs(ship.speed), tick })
      if (trail.length > TRAIL_HISTORY) trail.shift()
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
  ): void {
    if (!this.sprites) this.sprites = buildWakeSprites()
    const sp = this.sprites

    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    for (const ship of ships) {
      const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
      const speedRatio = ship.maxSpeed > 0 ? Math.min(1, Math.abs(ship.speed) / ship.maxSpeed) : 0
      const speedF = Math.max(speedRatio, Math.min(1, Math.abs(ship.speed) / 5))
      if (speedF < 0.06 || ship.speedLevel === 'stop') continue

      const cosA = Math.cos(ship.angle)
      const sinA = Math.sin(ship.angle)
      const screenAngle = projectedAngle(cosA, sinA, iso)
      const sternAlpha = 0.24 + speedF * 0.48
      const baseSize = Math.max(3, dim.w * iso.scale * (0.16 + speedF * 0.18))
      const currentStern = localPoint(ship, cosA, sinA, -dim.l * STERN_WAKE_OFFSET, 0)
      const trail = [
        ...(this.trails.get(ship.id) ?? []),
        { x: currentStern.x, y: currentStern.y, speed: Math.abs(ship.speed), tick },
      ]

      drawBowSplash(ctx, sp, w2s, ship, dim, iso, cosA, sinA, screenAngle, speedF)
      drawSternTrail(ctx, sp, w2s, trail, tick, baseSize, sternAlpha)
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

    ctx.globalAlpha = alpha * fade * 0.24
    ctx.strokeStyle = 'rgba(130,210,232,0.44)'
    ctx.lineWidth = Math.max(1.4, baseSize * (0.42 + fade * 0.18))
    ctx.beginPath()
    ctx.moveTo(prev.screen[0], prev.screen[1])
    ctx.lineTo(next.screen[0], next.screen[1])
    ctx.stroke()

    ctx.globalAlpha = alpha * fade * 0.46
    ctx.strokeStyle = 'rgba(238,252,255,0.62)'
    ctx.lineWidth = Math.max(0.7, baseSize * (0.08 + fade * 0.12))
    ctx.beginPath()
    ctx.moveTo(prev.screen[0], prev.screen[1])
    ctx.lineTo(next.screen[0], next.screen[1])
    ctx.stroke()
  }

  for (let i = Math.max(0, screenTrail.length - 12); i < screenTrail.length - 3; i += 2) {
    const point = screenTrail[i]!
    const age = Math.max(0, tick - point.tick)
    if (age < 8) continue
    const fade = Math.max(0, 1 - age / maxAge)
    const size = baseSize * (0.75 + fade * 0.70)
    ctx.globalAlpha = alpha * fade * 0.18
    drawFoam(ctx, sp.foamMist, point.screen[0], point.screen[1], 0, size * 2.10, size * 1.10)
    ctx.globalAlpha = alpha * fade * 0.34
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

function drawBowSplash(
  ctx: CanvasRenderingContext2D,
  sp: WakeSprites,
  w2s: WorldToScreen,
  ship: ShipEntity,
  dim: { l: number; w: number; h: number },
  iso: ProjectionContext,
  cosA: number,
  sinA: number,
  screenAngle: number,
  speedF: number,
): void {
  const [sx, sy] = projectLocal(w2s, ship, cosA, sinA, dim.l * 0.48, 0)
  const sprW = dim.l * iso.scale * 0.58
  const sprH = dim.w * iso.scale * 1.35
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(screenAngle)
  ctx.globalAlpha *= 0.22 + speedF * 0.28
  ctx.drawImage(sp.bowWave, -sprW * 0.10, -sprH / 2, sprW, sprH)
  ctx.restore()
}

function projectLocal(
  w2s: WorldToScreen,
  ship: ShipEntity,
  cosA: number,
  sinA: number,
  lon: number,
  lat: number,
): [number, number] {
  return w2s(
    ship.pos.x + cosA * lon + sinA * lat,
    ship.pos.y + sinA * lon - cosA * lat,
  )
}

function localPoint(
  ship: ShipEntity,
  cosA: number,
  sinA: number,
  lon: number,
  lat: number,
): { x: number; y: number } {
  return {
    x: ship.pos.x + cosA * lon + sinA * lat,
    y: ship.pos.y + sinA * lon - cosA * lat,
  }
}

function projectedAngle(cosA: number, sinA: number, iso: ProjectionContext): number {
  const svx = (cosA - sinA) * iso.scale
  const svy = (cosA + sinA) * iso.scale * 0.5
  return Math.atan2(svy, svx)
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
  const BW = 200, BH = 80
  const bowOC = new OffscreenCanvas(BW, BH)
  const bowCtx = bowOC.getContext('2d')!
  const apexX = BW, apexY = BH / 2

  for (const side of [-1, 1]) {
    const grad = bowCtx.createLinearGradient(apexX, apexY, 0, apexY + side * BH * 0.46)
    grad.addColorStop(0, 'rgba(255,255,255,0.58)')
    grad.addColorStop(0.35, 'rgba(230,248,255,0.34)')
    grad.addColorStop(1, 'rgba(200,240,255,0)')
    bowCtx.beginPath()
    for (let i = 0; i <= 22; i++) {
      const t = i / 22
      const x = apexX - BW * t
      const y = apexY + side * BH * 0.34 * Math.pow(t, 1.45)
      i === 0 ? bowCtx.moveTo(x, y) : bowCtx.lineTo(x, y)
    }
    bowCtx.strokeStyle = grad
    bowCtx.lineWidth = Math.max(1.2, BH * 0.032)
    bowCtx.lineCap = 'round'
    bowCtx.stroke()
  }

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

  return { bowWave: bowOC, foamLg: foamLgOC, foamSm: foamSmOC, foamMist: foamMistOC, sternWash: sternOC }
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
