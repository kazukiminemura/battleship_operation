import type { ShipEntity, SpeedLevel } from '../simulation/types'
import { SHIP_DIMS } from './ship-rendering-data'

interface ProjectionContext {
  scale: number
}

type WorldToScreen = (wx: number, wy: number) => [number, number]

interface ShipWakePoint {
  x: number
  y: number
  angle: number
  speed: number
  speedRatio: number
  speedLevel: SpeedLevel
  turn: number
  tick: number
}

interface WakeSprites {
  bowWave: OffscreenCanvas
  foamLg: OffscreenCanvas
  foamSm: OffscreenCanvas
  sternWash: OffscreenCanvas
}

const WAKE_HISTORY = 55
const WAKE_RECORD_INTERVAL = 2

export class ShipWakeRenderer {
  private history = new Map<string, ShipWakePoint[]>()
  private sprites: WakeSprites | null = null

  update(ships: ShipEntity[], tick: number): void {
    const alive = new Set<string>()
    for (const ship of ships) {
      alive.add(ship.id)
      if (tick % WAKE_RECORD_INTERVAL !== 0) continue
      let hist = this.history.get(ship.id)
      if (!hist) { hist = []; this.history.set(ship.id, hist) }
      const previous = hist[hist.length - 1]
      const turn = previous ? normalizeAngle(ship.angle - previous.angle) : 0
      const speedRatio = ship.maxSpeed > 0 ? Math.min(1.35, Math.abs(ship.speed / ship.maxSpeed)) : 0
      hist.push({
        x: ship.pos.x,
        y: ship.pos.y,
        angle: ship.angle,
        speed: ship.speed,
        speedRatio,
        speedLevel: ship.speedLevel,
        turn,
        tick,
      })
      if (hist.length > WAKE_HISTORY) hist.shift()
    }
    for (const id of this.history.keys()) {
      if (!alive.has(id)) this.history.delete(id)
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

    for (const ship of ships) {
      const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
      const hist = this.history.get(ship.id)
      const cosA = Math.cos(ship.angle)
      const sinA = Math.sin(ship.angle)

      const svx = (cosA - sinA) * iso.scale
      const svy = (cosA + sinA) * iso.scale * 0.5
      const screenAngle = Math.atan2(svy, svx)

      const speedF = Math.min(1, ship.speed / 5)
      if (speedF > 0.08) {
        const bowX = ship.pos.x + cosA * dim.l * 0.50
        const bowY = ship.pos.y + sinA * dim.l * 0.50
        const [bsx, bsy] = w2s(bowX, bowY)
        const sprW = dim.l * iso.scale * 1.05
        const sprH = dim.w * iso.scale * 2.30

        ctx.save()
        ctx.translate(bsx, bsy)
        ctx.rotate(screenAngle)
        ctx.globalAlpha = speedF * 0.55
        ctx.drawImage(sp.bowWave, -sprW, -sprH / 2, sprW, sprH)
        ctx.globalAlpha = 1
        ctx.restore()
      }

      if (hist && hist.length >= 2) {
        const maxAge = WAKE_HISTORY * WAKE_RECORD_INTERVAL

        for (let i = 0; i < hist.length; i++) {
          const h = hist[i]!
          const age = tick - h.tick
          if (age <= 0 || age > maxAge) continue

          const sf = Math.min(1, Math.max(Math.abs(h.speed) / 5, h.speedRatio * 0.85))
          if (sf < 0.04) continue
          const speedProfile = wakeSpeedProfile(h.speedLevel, sf)
          if (speedProfile.alpha <= 0) continue

          const t = age / maxAge
          const phase = tick * 0.24 + i * 1.73 + ship.id.length
          const shimmer = 0.72 + Math.sin(phase) * 0.28
          const turnF = Math.min(1, Math.abs(h.turn) / 0.065)
          const outsideSign = h.turn === 0 ? 0 : -Math.sign(h.turn)
          const turnFalloff = Math.max(0, 1 - t * 1.35)
          const outsideDrift = outsideSign * turnF * dim.w * (0.65 + t * 1.35) * turnFalloff
          const alpha = (1 - t) * speedProfile.alpha * 0.46 * shimmer * (1 + turnF * 0.18)
          const spread = dim.w * (0.30 + t * 1.75 + Math.sin(phase * 0.7) * 0.08) * speedProfile.spread * (1 + turnF * 0.22 * turnFalloff)
          const drift = Math.sin(phase * 1.17) * dim.w * 0.16 * (1 - t)
          const aftDrift = Math.cos(phase * 0.83) * dim.w * 0.08 * (1 - t)

          const hCosA = Math.cos(h.angle)
          const hSinA = Math.sin(h.angle)
          const hSvx = (hCosA - hSinA) * iso.scale
          const hSvy = (hCosA + hSinA) * iso.scale * 0.5
          const hScreenAngle = Math.atan2(hSvy, hSvx)
          const centerDrift = drift + outsideDrift
          const sternX = h.x - hCosA * (dim.l * 0.48 + aftDrift) + hSinA * centerDrift
          const sternY = h.y - hSinA * (dim.l * 0.48 + aftDrift) - hCosA * centerDrift

          const [px, py] = w2s(sternX + hSinA * spread, sternY - hCosA * spread)
          const [sx, sy] = w2s(sternX - hSinA * spread, sternY + hCosA * spread)

          const foamSpr = t < 0.38 ? sp.foamLg : sp.foamSm
          const pulse = 0.86 + Math.sin(phase * 1.9) * 0.14
          const dotSize = Math.max(2, dim.w * iso.scale * (t < 0.38 ? 0.30 : 0.16) * (1 - t * 0.38) * pulse * speedProfile.size)
          const portAlpha = alpha * (outsideSign > 0 ? 1 + turnF * 0.38 : 1 - turnF * 0.18)
          const starboardAlpha = alpha * (outsideSign < 0 ? 1 + turnF * 0.38 : 1 - turnF * 0.18)

          ctx.save()
          ctx.globalAlpha = Math.max(0, portAlpha)
          ctx.drawImage(foamSpr, px - dotSize / 2, py - dotSize / 2, dotSize, dotSize)
          ctx.globalAlpha = Math.max(0, starboardAlpha)
          ctx.drawImage(foamSpr, sx - dotSize / 2, sy - dotSize / 2, dotSize, dotSize)

          if (t < 0.28) {
            const [cx2, cy2] = w2s(sternX, sternY)
            const ct = t / 0.28
            const washSize = Math.max(4, dim.w * iso.scale * (0.58 + Math.sin(phase * 2.1) * 0.08) * (1 - ct) * speedProfile.wash)
            ctx.globalAlpha = (1 - ct) * speedProfile.alpha * 0.44
            ctx.translate(cx2, cy2)
            ctx.rotate(hScreenAngle + Math.sin(phase) * 0.18 + outsideSign * turnF * 0.26)
            ctx.drawImage(sp.sternWash, -washSize / 2, -washSize / 2, washSize, washSize)
          }

          ctx.globalAlpha = 1
          ctx.restore()
        }
      }
    }
  }
}

function normalizeAngle(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function wakeSpeedProfile(level: SpeedLevel, speedRatio: number): { alpha: number; size: number; spread: number; wash: number } {
  const moving = Math.max(0, speedRatio)
  const levelProfile: Record<SpeedLevel, { alpha: number; size: number; spread: number; wash: number }> = {
    full:    { alpha: 1.34, size: 1.22, spread: 1.26, wash: 1.32 },
    cruise:  { alpha: 1.00, size: 1.00, spread: 1.00, wash: 1.00 },
    slow:    { alpha: 0.58, size: 0.82, spread: 0.72, wash: 0.62 },
    stop:    { alpha: 0.00, size: 0.00, spread: 0.00, wash: 0.00 },
    reverse: { alpha: 0.34, size: 0.72, spread: 0.64, wash: 0.48 },
  }
  const profile = levelProfile[level]
  const motion = 0.45 + moving * 0.65
  return {
    alpha: profile.alpha * motion,
    size: profile.size * (0.80 + moving * 0.28),
    spread: profile.spread * (0.82 + moving * 0.30),
    wash: profile.wash * (0.78 + moving * 0.36),
  }
}

function buildWakeSprites(): WakeSprites {
  const BW = 200, BH = 80
  const bowOC = new OffscreenCanvas(BW, BH)
  const bowCtx = bowOC.getContext('2d')!
  const apexX = BW, apexY = BH / 2

  for (const side of [-1, 1]) {
    const grad = bowCtx.createLinearGradient(apexX, apexY, 0, apexY + side * BH * 0.46)
    grad.addColorStop(0, 'rgba(255,255,255,0.64)')
    grad.addColorStop(0.35, 'rgba(230,248,255,0.40)')
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

    for (let i = 3; i <= 20; i += 2) {
      const t = i / 22
      const x = apexX - BW * t
      const y = apexY + side * BH * 0.34 * Math.pow(t, 1.45)
      const r = Math.max(0.5, BH * 0.018 * (1 - t * 0.5))
      bowCtx.beginPath()
      bowCtx.arc(x, y, r, 0, Math.PI * 2)
      bowCtx.fillStyle = `rgba(255,255,255,${0.36 * (1 - t * 0.6)})`
      bowCtx.fill()
    }
  }

  const apexGrad = bowCtx.createRadialGradient(apexX, apexY, 0, apexX, apexY, BH * 0.32)
  apexGrad.addColorStop(0, 'rgba(255,255,255,0.42)')
  apexGrad.addColorStop(0.5, 'rgba(230,248,255,0.18)')
  apexGrad.addColorStop(1, 'rgba(200,240,255,0)')
  bowCtx.beginPath()
  bowCtx.arc(apexX, apexY, BH * 0.32, 0, Math.PI * 2)
  bowCtx.fillStyle = apexGrad
  bowCtx.fill()

  const foamLgOC = new OffscreenCanvas(24, 24)
  const flCtx = foamLgOC.getContext('2d')!
  const flGrad = flCtx.createRadialGradient(12, 12, 0, 12, 12, 12)
  flGrad.addColorStop(0, 'rgba(255,255,255,0.90)')
  flGrad.addColorStop(0.45, 'rgba(220,245,255,0.60)')
  flGrad.addColorStop(1, 'rgba(200,240,255,0)')
  flCtx.beginPath(); flCtx.arc(12, 12, 12, 0, Math.PI * 2)
  flCtx.fillStyle = flGrad; flCtx.fill()

  const foamSmOC = new OffscreenCanvas(12, 12)
  const fsCtx = foamSmOC.getContext('2d')!
  const fsGrad = fsCtx.createRadialGradient(6, 6, 0, 6, 6, 6)
  fsGrad.addColorStop(0, 'rgba(255,255,255,0.88)')
  fsGrad.addColorStop(0.5, 'rgba(210,242,255,0.55)')
  fsGrad.addColorStop(1, 'rgba(200,240,255,0)')
  fsCtx.beginPath(); fsCtx.arc(6, 6, 6, 0, Math.PI * 2)
  fsCtx.fillStyle = fsGrad; fsCtx.fill()

  const sternOC = new OffscreenCanvas(56, 56)
  const stCtx = sternOC.getContext('2d')!
  const stGrad = stCtx.createRadialGradient(28, 28, 0, 28, 28, 28)
  stGrad.addColorStop(0, 'rgba(255,255,255,0.85)')
  stGrad.addColorStop(0.30, 'rgba(220,248,255,0.60)')
  stGrad.addColorStop(0.65, 'rgba(190,235,255,0.25)')
  stGrad.addColorStop(1, 'rgba(180,230,255,0)')
  stCtx.beginPath(); stCtx.arc(28, 28, 28, 0, Math.PI * 2)
  stCtx.fillStyle = stGrad; stCtx.fill()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    stCtx.beginPath()
    stCtx.moveTo(28, 28)
    stCtx.lineTo(28 + Math.cos(a) * 22, 28 + Math.sin(a) * 22)
    stCtx.strokeStyle = `rgba(255,255,255,${0.20 + (i % 3) * 0.06})`
    stCtx.lineWidth = 1.2
    stCtx.stroke()
  }

  return { bowWave: bowOC, foamLg: foamLgOC, foamSm: foamSmOC, sternWash: sternOC }
}
