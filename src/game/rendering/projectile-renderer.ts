import type { ProjectileEntity, WeaponType } from '../simulation/types'

export interface ProjectionContext {
  scale: number
}

export type WorldToScreen = (wx: number, wy: number) => [number, number]

interface ProjectileRenderFrame {
  sx: number
  sy: number
  hx: number
  hy: number
  thx: number
  thy: number
  angle: number
  arcPx: number
  progress: number
}

type ProjectileRenderStrategy = (
  ctx: CanvasRenderingContext2D,
  frame: ProjectileRenderFrame,
) => void

const PROJECTILE_RENDERERS: Record<WeaponType, ProjectileRenderStrategy> = {
  aa: (ctx, f) => renderAa(ctx, f.hx, f.hy, f.thx, f.thy, f.angle),
  gun: (ctx, f) => renderGun(ctx, f.sx, f.sy, f.hx, f.hy, f.thx, f.thy, f.angle, f.arcPx),
  secondary: (ctx, f) => renderSecondary(ctx, f.sx, f.sy, f.hx, f.hy, f.thx, f.thy, f.angle, f.arcPx),
  missile: (ctx, f) => renderMissile(ctx, f.sx, f.sy, f.hx, f.hy, f.thx, f.thy, f.angle, f.arcPx, f.progress),
  torpedo: (ctx, f) => renderTorpedo(ctx, f.sx, f.sy, f.thx, f.thy, f.angle),
}

export function renderProjectile(
  ctx: CanvasRenderingContext2D,
  iso: ProjectionContext,
  w2s: WorldToScreen,
  proj: ProjectileEntity,
): void {
  const progress = proj.initialLifetime > 0
    ? (proj.initialLifetime - proj.lifetime) / proj.initialLifetime
    : 0
  const p = clamp01(progress)
  const head = projectileVisualPoint(iso, w2s, proj, p)
  const sx = head.sx
  const sy = head.sy
  const arcPx = head.heightPx
  const hx = head.hx
  const hy = head.hy

  const tSteps = proj.weaponType === 'torpedo' ? 8 : proj.weaponType === 'missile' ? 7 : 5
  const [flatTx, flatTy] = w2s(
    proj.pos.x - proj.vel.x * tSteps,
    proj.pos.y - proj.vel.y * tSteps,
  )
  const trailProgress = Math.max(0, p - (proj.weaponType === 'missile' ? 0.045 : 0.10))
  const trail = projectileVisualPoint(iso, w2s, proj, trailProgress)
  const thx = proj.weaponType === 'torpedo' ? flatTx : trail.hx
  const thy = proj.weaponType === 'torpedo' ? flatTy : trail.hy
  const angle = Math.atan2(hy - thy, hx - thx)

  if (proj.weaponId?.includes('yukimura.snowball')) {
    renderSnowball(ctx, sx, sy, hx, hy, thx, thy, angle, arcPx)
    return
  }
  if (proj.weaponId?.includes('yukimura.marshmallow')) {
    renderMarshmallow(ctx, sx, sy, hx, hy, thx, thy, angle, arcPx)
    return
  }

  PROJECTILE_RENDERERS[proj.weaponType](ctx, { sx, sy, hx, hy, thx, thy, angle, arcPx, progress: p })
}

function renderAa(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  thx: number,
  thy: number,
  angle: number,
): void {
  ctx.save()
  ctx.translate(hx, hy); ctx.rotate(angle)
  ctx.beginPath()
  ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,250,200,0.30)'
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, 0, 4, 1.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#f0eecc'
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0.6, 0, 2.2, 0.7, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
}

function renderGun(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  thx: number,
  thy: number,
  angle: number,
  arcPx: number,
): void {
  if (arcPx > 3) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 5, 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.fill()
  }

  ctx.save()
  ctx.translate(hx, hy); ctx.rotate(angle)
  ctx.fillStyle = '#a06818'
  ctx.beginPath()
  ctx.ellipse(-1, 0, 5.5, 2.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c08428'
  ctx.beginPath()
  ctx.moveTo(3.5, -2.4); ctx.lineTo(9.5, 0); ctx.lineTo(3.5, 2.4)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#5a3008'
  ctx.fillRect(-6.5, -2.4, 2.5, 4.8)
  ctx.fillStyle = 'rgba(255,215,110,0.38)'
  ctx.beginPath()
  ctx.ellipse(0.5, -0.9, 3.5, 0.9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function renderSecondary(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  thx: number,
  thy: number,
  angle: number,
  arcPx: number,
): void {
  if (arcPx > 3) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 4, 1.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fill()
  }

  ctx.save()
  ctx.translate(hx, hy); ctx.rotate(angle)
  ctx.fillStyle = '#c03018'
  ctx.beginPath()
  ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d84028'
  ctx.beginPath()
  ctx.moveTo(3.5, -2.2); ctx.lineTo(8.5, 0); ctx.lineTo(3.5, 2.2)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#7a1a08'
  ctx.beginPath()
  ctx.moveTo(-5, 0); ctx.lineTo(-8, -5); ctx.lineTo(-6, 0)
  ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-5, 0); ctx.lineTo(-8,  5); ctx.lineTo(-6, 0)
  ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-7.5, 0, 3.5, 1.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,190,50,0.78)'
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-6, 0, 2, 0.9, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#fff0a0'
  ctx.fill()
  ctx.restore()
}

function renderSnowball(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  thx: number,
  thy: number,
  angle: number,
  arcPx: number,
): void {
  if (arcPx > 3) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 5.5, 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fill()
  }

  ctx.beginPath()
  ctx.moveTo(thx, thy)
  ctx.lineTo(hx, hy)
  ctx.strokeStyle = 'rgba(226,242,255,0.34)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.save()
  ctx.translate(hx, hy); ctx.rotate(angle)
  const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.62, '#f8fafc')
  grad.addColorStop(1, '#cbd5e1')
  ctx.beginPath()
  ctx.arc(0, 0, 6.2, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.stroke()
  for (const [dx, dy, r] of [[-2.6, 1.3, 1.1], [1.8, -1.6, 0.9], [2.7, 1.7, 0.7]] as const) {
    ctx.beginPath()
    ctx.arc(dx, dy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(148,163,184,0.28)'
    ctx.fill()
  }
  ctx.restore()
}

function renderMarshmallow(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  thx: number,
  thy: number,
  angle: number,
  arcPx: number,
): void {
  if (arcPx > 3) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 4.5, 1.6, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fill()
  }

  ctx.beginPath()
  ctx.moveTo(thx, thy)
  ctx.lineTo(hx, hy)
  ctx.strokeStyle = 'rgba(255,255,255,0.36)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.save()
  ctx.translate(hx, hy); ctx.rotate(angle)
  ctx.fillStyle = '#fff7ed'
  roundRectPath(ctx, -6.5, -3.6, 13, 7.2, 3.4)
  ctx.fill()
  ctx.strokeStyle = '#fed7aa'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(-2.2, -1.1, 2.4, 0.8, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fill()
  ctx.restore()
}

function renderMissile(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  thx: number,
  thy: number,
  angle: number,
  arcPx: number,
  progress: number,
): void {
  const launchT = missileLaunchPhase(progress)
  if (arcPx > 3) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 6, 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fill()
  }

  ctx.save()
  ctx.translate(hx, hy); ctx.rotate(angle)
  ctx.fillStyle = '#b8bcd4'
  ctx.beginPath()
  ctx.ellipse(0, 0, 7, 1.8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d4d8ec'
  ctx.beginPath()
  ctx.moveTo(4.5, -1.8); ctx.lineTo(12, 0); ctx.lineTo(4.5, 1.8)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#7880a0'
  ctx.beginPath()
  ctx.moveTo(-7, 0); ctx.lineTo(-11, -5.5); ctx.lineTo(-8.5, -1)
  ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-7, 0); ctx.lineTo(-11,  5.5); ctx.lineTo(-8.5,  1)
  ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-10, 0, 4.5, 1.8, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(140,200,255,0.72)'
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-8, 0, 2.8, 1.1, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#dff0ff'
  ctx.fill()
  ctx.restore()

  if (launchT > 0.02) {
    const flameLen = 18 * launchT
    ctx.save()
    ctx.translate(hx, hy)
    ctx.rotate(angle + Math.PI)
    const flame = ctx.createLinearGradient(0, 0, flameLen, 0)
    flame.addColorStop(0, `rgba(255,245,180,${0.92 * launchT})`)
    flame.addColorStop(0.45, `rgba(120,200,255,${0.55 * launchT})`)
    flame.addColorStop(1, 'rgba(120,200,255,0)')
    ctx.beginPath()
    ctx.moveTo(0, -2.5)
    ctx.lineTo(flameLen, 0)
    ctx.lineTo(0, 2.5)
    ctx.closePath()
    ctx.fillStyle = flame
    ctx.fill()
    ctx.restore()
  }
}

function renderTorpedo(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  thx: number,
  thy: number,
  angle: number,
): void {
  ctx.beginPath()
  ctx.moveTo(thx, thy); ctx.lineTo(sx, sy)
  ctx.strokeStyle = 'rgba(160,215,255,0.50)'
  ctx.lineWidth = 5; ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(thx, thy); ctx.lineTo(sx, sy)
  ctx.strokeStyle = 'rgba(245,214,75,0.28)'
  ctx.lineWidth = 2; ctx.stroke()

  ctx.save()
  ctx.translate(sx, sy); ctx.rotate(angle)
  ctx.fillStyle = '#485a68'
  ctx.beginPath()
  ctx.ellipse(0, 0, 9, 3.8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#607888'
  ctx.beginPath()
  ctx.moveTo(6, -3.8); ctx.lineTo(12, 0); ctx.lineTo(6, 3.8)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#28383f'
  ctx.fillRect(-3, -3.8, 3.5, 7.6)
  ctx.strokeStyle = '#6a8898'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-9, -4); ctx.lineTo(-12, 0); ctx.lineTo(-9, 4)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-9, 0); ctx.lineTo(-12, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(12, 0, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(160,220,255,0.60)'
  ctx.fill()
  ctx.restore()
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function projectileVisualPoint(
  iso: ProjectionContext,
  w2s: WorldToScreen,
  proj: ProjectileEntity,
  progress: number,
): { sx: number; sy: number; hx: number; hy: number; heightPx: number } {
  if (proj.weaponType === 'torpedo') {
    const [sx, sy] = w2s(proj.pos.x, proj.pos.y)
    return { sx, sy, hx: sx, hy: sy, heightPx: 0 }
  }

  const elapsed = proj.initialLifetime - proj.lifetime
  const launch = proj.launchPos ?? {
    x: proj.pos.x - proj.vel.x * elapsed,
    y: proj.pos.y - proj.vel.y * elapsed,
    z: 0,
  }
  const ballisticTarget = {
    x: launch.x + proj.vel.x * proj.initialLifetime,
    y: launch.y + proj.vel.y * proj.initialLifetime,
    z: 0,
  }
  const target = proj.weaponType === 'missile'
    ? (proj.targetPos ?? ballisticTarget)
    : ballisticTarget
  const pathT = proj.weaponType === 'missile'
    ? missilePathProgress(progress)
    : progress
  const worldX = launch.x + (target.x - launch.x) * pathT
  const worldY = launch.y + (target.y - launch.y) * pathT
  const height = proj.weaponType === 'missile'
    ? missileArcHeight(proj.maxHeight, progress)
    : proj.maxHeight * Math.sin(Math.PI * progress)
  const [sx, sy] = w2s(worldX, worldY)
  const heightPx = height * iso.scale
  return { sx, sy, hx: sx, hy: sy - heightPx, heightPx }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function missileLaunchPhase(progress: number): number {
  return 1 - smoothstep(progress / 0.24)
}

function missilePathProgress(progress: number): number {
  return smoothstep((progress - 0.22) / 0.78)
}

function missileArcHeight(maxHeight: number, progress: number): number {
  const p = clamp01(progress)
  if (p < 0.24) {
    return maxHeight * 0.72 * smoothstep(p / 0.24)
  }
  const cruiseT = (p - 0.24) / 0.76
  const highCruise = maxHeight * (0.72 + 0.28 * Math.sin(Math.PI * clamp01(cruiseT)))
  const descent = 1 - smoothstep((p - 0.72) / 0.28)
  return highCruise * Math.max(0, descent)
}
