import type { AircraftEntity, Vec3 } from '../simulation/types'
import type { WorldToScreen } from './ship-projection'
import { damageSmokeLevel } from './damage-smoke'

interface SmokePuff { pos: Vec3; tick: number; severity: number }
const SMOKE_LIFETIME = 60

/** Aircraft exhaust trails use recorded world positions, including altitude. */
export class AircraftEffectsRenderer {
  private readonly trails = new Map<string, SmokePuff[]>()
  private lastTick = -1

  render(ctx: CanvasRenderingContext2D, planes: readonly AircraftEntity[], scale: number, w2s: WorldToScreen, tick: number): void {
    if (tick < this.lastTick) this.trails.clear()
    if (tick !== this.lastTick) {
      this.lastTick = tick
      for (const [id, puffs] of this.trails) {
        const alive = puffs.filter(puff => tick - puff.tick < SMOKE_LIFETIME)
        if (alive.length) this.trails.set(id, alive)
        else this.trails.delete(id)
      }
      if (tick % 2 === 0) for (const plane of planes) {
        if (plane.phase === 'crashed' || plane.hp >= plane.maxHp) continue
        const puffs = this.trails.get(plane.id) ?? []
        puffs.push({ pos: { ...plane.pos }, tick, severity: damageSmokeLevel(plane.hp, plane.maxHp, plane.destroyed) })
        this.trails.set(plane.id, puffs)
      }
    }
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    for (const puffs of this.trails.values()) for (const puff of puffs) {
      const age = tick - puff.tick
      const [x, y] = w2s(puff.pos.x + age * .5, puff.pos.y)
      const radius = Math.max(2, scale * (5 + age * .65) * (.6 + puff.severity * .4))
      const cy = y - (puff.pos.z + age * .7) * scale
      const smoke = ctx.createRadialGradient(x, cy, 0, x, cy, radius)
      smoke.addColorStop(0, 'rgba(18,20,19,.85)')
      smoke.addColorStop(.5, 'rgba(39,41,38,.6)')
      smoke.addColorStop(1, 'rgba(60,62,57,0)')
      ctx.globalAlpha = (1 - age / SMOKE_LIFETIME) * (.4 + puff.severity * .4)
      ctx.fillStyle = smoke
      ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    for (const plane of planes) {
      const [x, y] = w2s(plane.pos.x, plane.pos.y)
      if (plane.phase === 'crashing') {
        const radius = scale * (9 + 3 * Math.sin(tick * 2))
        const cy = y - plane.pos.z * scale
        const fire = ctx.createRadialGradient(x, cy, 0, x, cy, radius)
        fire.addColorStop(0, '#fff2b0'); fire.addColorStop(.35, '#ff9429'); fire.addColorStop(1, 'rgba(231,53,10,0)')
        ctx.fillStyle = fire
        ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.fill()
      } else if (plane.phase === 'crashed') {
        renderAircraftImpact(ctx, plane, x, y, scale, tick)
      }
    }
    ctx.restore()
  }
}

function renderAircraftImpact(ctx: CanvasRenderingContext2D, plane: AircraftEntity, x: number, y: number, scale: number, tick: number): void {
  const t = Math.min(1, Math.max(0, (tick - (plane.impactTick ?? tick)) / 60))
  const radius = Math.max(1, scale * (14 + 85 * t))
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = 1 - t
  const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
  flash.addColorStop(0, plane.impactOnLand ? '#ffe6a2' : '#e5f7ff')
  flash.addColorStop(.3, plane.impactOnLand ? '#e87728' : 'rgba(176,220,235,.8)')
  flash.addColorStop(1, plane.impactOnLand ? 'rgba(68,51,35,0)' : 'rgba(173,216,235,0)')
  ctx.fillStyle = flash
  ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * .48, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = plane.impactOnLand ? '#806a4d' : '#d7edf2'
  ctx.lineWidth = Math.max(1, scale * 2 * (1 - t))
  ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.25, radius * .5, 0, 0, Math.PI * 2); ctx.stroke()
  // Seeded radial debris / spray with a ballistic rise and fall.
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI * 2 / 12
    const reach = scale * 90 * t
    const lift = scale * 90 * Math.sin(Math.PI * t) * (.5 + (i % 3) * .2)
    ctx.fillStyle = plane.impactOnLand ? '#5c4d38' : '#d9edf5'
    ctx.beginPath(); ctx.arc(Math.cos(a) * reach, Math.sin(a) * reach * .4 - lift, Math.max(1, scale * 3 * (1 - t)), 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}
