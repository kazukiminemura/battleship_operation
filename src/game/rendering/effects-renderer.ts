import type { CombatEvent, Entity, ShipEntity, WeaponType } from '../simulation/types'
import { SHIP_DIMS } from './ship-rendering-data'

interface ProjectionContext {
  scale: number
}

type WorldToScreen = (wx: number, wy: number) => [number, number]

const EXPLOSION_TICKS = 50
const SINK_EXPLOSION_TICKS = 108

export function renderShipExplosions(
  ctx: CanvasRenderingContext2D,
  iso: ProjectionContext,
  w2s: WorldToScreen,
  events: CombatEvent[],
  tick: number,
  entities: Map<string, Entity>,
): void {
  const D = EXPLOSION_TICKS

  for (const ev of events) {
    if (ev.type !== 'entity.destroyed' || !ev.position || !ev.targetId) continue
    const target = entities.get(ev.targetId)
    if (target?.kind !== 'ship') continue

    const age = tick - ev.tick
    if (age < 0 || age >= SINK_EXPLOSION_TICKS) continue

    renderSinkingShipExplosion(ctx, iso, w2s, ev, target as ShipEntity, age)
  }

  for (const ev of events) {
    if (ev.type !== 'weapon.hit' || !ev.position || !ev.targetId) continue
    const target = entities.get(ev.targetId)
    if (target?.kind !== 'ship') continue

    const age = tick - ev.tick
    if (age < 0 || age >= D) continue

    const t = age / D
    const pos = ev.position
    const wtype = weaponTypeFromId(ev.weaponId)
    const s = iso.scale
    const [cx, cy] = w2s(pos.x, pos.y)
    const sinkingTarget = events.some(e => e.type === 'entity.destroyed' && e.tick === ev.tick && e.targetId === ev.targetId)
    const maxR = impactWorldRadius(wtype) * (wtype === 'torpedo' ? 0.95 : 0.72) * (sinkingTarget ? 0.70 : 1)

    if (t < 0.22) {
      const ft = t / 0.22
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1.5, 0.65)
      const flashR = maxR * s * (0.22 + ft * 1.10)
      const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR)
      flash.addColorStop(0,    `rgba(255,255,255,${(1 - ft) * 1.0})`)
      flash.addColorStop(0.20, `rgba(255,240,180,${(1 - ft) * 0.95})`)
      flash.addColorStop(0.50, `rgba(255,160,40,${(1 - ft) * 0.80})`)
      flash.addColorStop(0.80, `rgba(220,60,20,${(1 - ft) * 0.50})`)
      flash.addColorStop(1,    'rgba(180,40,10,0)')
      ctx.beginPath()
      ctx.arc(0, 0, flashR, 0, Math.PI * 2)
      ctx.fillStyle = flash
      ctx.fill()
      ctx.restore()
    }

    if (t < 0.50) {
      const bt = t / 0.50
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1.4, 0.60)
      const ballR = maxR * s * (0.55 + bt * 0.35) * (1 - bt * 0.25)
      const ball = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, ballR))
      ball.addColorStop(0,    `rgba(255,230,100,${(1 - bt) * 0.90})`)
      ball.addColorStop(0.40, `rgba(255,110,20,${(1 - bt) * 0.82})`)
      ball.addColorStop(0.78, `rgba(180,40,10,${(1 - bt) * 0.55})`)
      ball.addColorStop(1,    'rgba(100,20,5,0)')
      ctx.beginPath()
      ctx.arc(0, 0, Math.max(1, ballR), 0, Math.PI * 2)
      ctx.fillStyle = ball
      ctx.fill()
      ctx.restore()
    }

    const spikes = wtype === 'torpedo' ? 14 : wtype === 'secondary' ? 10 : 12
    if (t < 0.40) {
      const st = t / 0.40
      ctx.save()
      ctx.translate(cx, cy)
      ctx.beginPath()
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + signedNoise(pos.x, pos.y, i + 301) * 0.18
        const r1 = maxR * s * (0.18 + st * 0.22)
        const r2 = maxR * s * (0.42 + st * (0.60 + Math.abs(signedNoise(pos.y, pos.x, i + 313)) * 0.28))
        const x1 = Math.cos(a) * r1
        const y1 = Math.sin(a) * r1 * 0.58
        const x2 = Math.cos(a) * r2
        const y2 = Math.sin(a) * r2 * 0.58
        i === 0 ? ctx.moveTo(x1, y1) : ctx.lineTo(x1, y1)
        ctx.lineTo(x2, y2)
      }
      ctx.closePath()
      ctx.fillStyle = `rgba(255,140,40,${(1 - st) * 0.72})`
      ctx.fill()
      ctx.restore()
    }

    const smokeCount = wtype === 'torpedo' ? 24 : wtype === 'secondary' ? 16 : 20
    for (let i = 0; i < smokeCount; i++) {
      const n = Math.abs(signedNoise(pos.x, pos.y, i + 340))
      const a = (i / smokeCount) * Math.PI * 2 + signedNoise(pos.y, pos.x, i + 353) * 0.8
      const spread = maxR * (0.10 + n * 0.85) * Math.min(1, t * 1.8)
      const [px, pyBase] = w2s(pos.x + Math.cos(a) * spread, pos.y + Math.sin(a) * spread)
      const lift = maxR * s * (0.30 + n * 0.95) * Math.sin(Math.PI * Math.min(1, t * 1.1))
      const r = Math.max(2.0, maxR * s * (0.034 + n * 0.072) * (1 - t * 0.15))
      const alpha = Math.max(0, (1 - t) * (0.40 + n * 0.30))
      ctx.beginPath()
      ctx.arc(px, pyBase - lift, r, 0, Math.PI * 2)
      ctx.fillStyle = t < 0.35
        ? (i % 3 === 0 ? `rgba(200,120,30,${alpha})` : `rgba(160,80,20,${alpha * 0.85})`)
        : (i % 4 === 0 ? `rgba(34,31,28,${alpha})`   : `rgba(80,70,62,${alpha * 0.82})`)
      ctx.fill()
    }

    if (t < 0.90) {
      const rt = t / 0.90
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1.55, 0.62)
      ctx.beginPath()
      ctx.arc(0, 0, maxR * s * (0.20 + rt * 1.20), 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,200,100,${(1 - rt) * 0.55})`
      ctx.lineWidth = Math.max(0.8, maxR * s * 0.022 * (1 - rt))
      ctx.stroke()
      ctx.restore()
    }
  }
}

function renderSinkingShipExplosion(
  ctx: CanvasRenderingContext2D,
  iso: ProjectionContext,
  w2s: WorldToScreen,
  ev: CombatEvent,
  ship: ShipEntity,
  age: number,
): void {
  const t = age / SINK_EXPLOSION_TICKS
  const pos = ev.position!
  const dim = SHIP_DIMS[ship.templateId] ?? { l: 120, w: 28, h: 16 }
  const s = iso.scale
  const [cx, cy] = w2s(pos.x, pos.y)
  const shipScale = Math.max(0.85, Math.min(2.4, dim.l / 145))
  const blastR = Math.max(95, dim.l * 0.72) * shipScale
  const deckSpan = dim.l * 0.46
  const beamSpan = dim.w * 0.40
  const cosA = Math.cos(ship.angle)
  const sinA = Math.sin(ship.angle)

  const localPoint = (lon: number, lat: number): [number, number] => w2s(
    pos.x + cosA * lon + sinA * lat,
    pos.y + sinA * lon - cosA * lat,
  )

  if (t < 0.20) {
    const ft = t / 0.20
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.translate(cx, cy)
    ctx.scale(1.8, 0.68)
    const r = blastR * s * (0.26 + ft * 1.55)
    const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, r))
    flash.addColorStop(0, `rgba(255,255,255,${(1 - ft) * 1.0})`)
    flash.addColorStop(0.17, `rgba(255,244,185,${(1 - ft) * 0.95})`)
    flash.addColorStop(0.45, `rgba(255,125,24,${(1 - ft) * 0.72})`)
    flash.addColorStop(0.82, `rgba(215,35,12,${(1 - ft) * 0.42})`)
    flash.addColorStop(1, 'rgba(215,35,12,0)')
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = flash
    ctx.fill()
    ctx.restore()
  }

  const chainCount = ship.templateId === 'hull.enemy.boss.dreadnought' ? 7 : dim.l > 150 ? 5 : 4
  for (let i = 0; i < chainCount; i++) {
    const delay = i * 0.052
    const ct = (t - delay) / 0.34
    if (ct < 0 || ct > 1) continue

    const lon = deckSpan * signedNoise(pos.x, pos.y, i + 701)
    const lat = beamSpan * signedNoise(pos.y, pos.x, i + 719)
    const [px, py] = localPoint(lon, lat)
    const n = Math.abs(signedNoise(pos.x, pos.y, i + 733))
    const r = blastR * s * (0.10 + n * 0.12 + ct * 0.34) * (1 - ct * 0.18)
    const lift = blastR * s * (0.22 + n * 0.32) * Math.sin(Math.PI * ct)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.translate(px, py - lift)
    ctx.scale(1.25, 0.84)
    const fire = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, r))
    fire.addColorStop(0, `rgba(255,255,230,${(1 - ct) * 0.92})`)
    fire.addColorStop(0.28, `rgba(255,193,64,${(1 - ct) * 0.88})`)
    fire.addColorStop(0.62, `rgba(244,83,18,${(1 - ct) * 0.76})`)
    fire.addColorStop(1, 'rgba(92,20,8,0)')
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(1, r), 0, Math.PI * 2)
    ctx.fillStyle = fire
    ctx.fill()
    ctx.restore()
  }

  if (t < 0.56) {
    const st = t / 0.56
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1.68, 0.62)
    for (let ri = 0; ri < 3; ri++) {
      const rt = Math.max(0, (st - ri * 0.14) / (1 - ri * 0.14))
      if (rt <= 0) continue
      ctx.beginPath()
      ctx.arc(0, 0, blastR * s * (0.18 + rt * (1.18 + ri * 0.20)), 0, Math.PI * 2)
      ctx.strokeStyle = ri === 0
        ? `rgba(255,231,151,${(1 - rt) * 0.72})`
        : `rgba(255,117,46,${(1 - rt) * 0.36})`
      ctx.lineWidth = Math.max(0.7, blastR * s * (0.024 - ri * 0.004) * (1 - rt * 0.55))
      ctx.stroke()
    }
    ctx.restore()
  }

  if (t < 0.46) {
    const shardCount = ship.templateId === 'hull.enemy.boss.dreadnought' ? 34 : 24
    for (let i = 0; i < shardCount; i++) {
      const n = Math.abs(signedNoise(pos.x, pos.y, i + 811))
      const a = (i / shardCount) * Math.PI * 2 + signedNoise(pos.y, pos.x, i + 823) * 0.45
      const len = blastR * s * (0.12 + n * 0.20) * (1 - t * 1.4)
      const spread = blastR * (0.12 + n * 0.82) * Math.min(1, t * 2.6)
      const [px, pyBase] = w2s(pos.x + Math.cos(a) * spread, pos.y + Math.sin(a) * spread)
      const lift = blastR * s * (0.15 + n * 0.42) * Math.sin(Math.PI * Math.min(1, t * 1.55))
      ctx.beginPath()
      ctx.moveTo(px, pyBase - lift)
      ctx.lineTo(px - Math.cos(a) * len, pyBase - lift - Math.sin(a) * len * 0.55)
      ctx.strokeStyle = i % 3 === 0 ? `rgba(255,244,180,${(1 - t * 1.7) * 0.82})` : `rgba(255,124,36,${(1 - t * 1.7) * 0.62})`
      ctx.lineWidth = Math.max(0.7, blastR * s * 0.006)
      ctx.stroke()
    }
  }

  const smokeCount = ship.templateId === 'hull.enemy.boss.dreadnought' ? 42 : 30
  for (let i = 0; i < smokeCount; i++) {
    const n = Math.abs(signedNoise(pos.x, pos.y, i + 901))
    const a = (i / smokeCount) * Math.PI * 2 + signedNoise(pos.y, pos.x, i + 919) * 1.1
    const spread = blastR * (0.06 + n * 0.72) * Math.min(1, t * 1.55)
    const [px, pyBase] = w2s(pos.x + Math.cos(a) * spread, pos.y + Math.sin(a) * spread)
    const lift = blastR * s * (0.28 + n * 0.96) * Math.sin(Math.PI * Math.min(1, t * 0.95)) + blastR * s * t * (0.20 + n * 0.40)
    const r = Math.max(2.0, blastR * s * (0.020 + n * 0.046) * (1 + t * 0.82))
    const alpha = Math.max(0, (1 - t) * (0.36 + n * 0.30))
    ctx.beginPath()
    ctx.arc(px, pyBase - lift, r, 0, Math.PI * 2)
    ctx.fillStyle = t < 0.26 && i % 4 === 0
      ? `rgba(183,66,20,${alpha * 0.86})`
      : `rgba(28,25,23,${alpha})`
    ctx.fill()
  }

  if (t > 0.22) {
    const wt = (t - 0.22) / 0.78
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1.75, 0.62)
    const r = blastR * s * (0.32 + wt * 1.16)
    const soot = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, r))
    soot.addColorStop(0, `rgba(26,23,20,${(1 - wt) * 0.28})`)
    soot.addColorStop(0.62, `rgba(62,48,37,${(1 - wt) * 0.18})`)
    soot.addColorStop(1, 'rgba(62,48,37,0)')
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = soot
    ctx.fill()
    ctx.restore()
  }
}

function signedNoise(x: number, y: number, salt: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
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
