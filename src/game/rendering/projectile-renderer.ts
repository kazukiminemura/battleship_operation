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
  if (proj.weaponId?.includes('yukimura.yukidaru')) {
    renderYukidaru(ctx, hx, hy, angle)
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
  sx: number, sy: number, hx: number, hy: number,
  thx: number, thy: number, angle: number, arcPx: number,
): void {
  if (arcPx > 3) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 2.8, 1, angle, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fill()
  }
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(angle)
  // Short motion blur; a ballistic shell has no rocket flame or fins.
  const blur = ctx.createLinearGradient(-10, 0, 0, 0)
  blur.addColorStop(0, 'rgba(195,189,156,0)')
  blur.addColorStop(1, 'rgba(195,189,156,0.32)')
  ctx.strokeStyle = blur
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-10, 0)
  ctx.lineTo(-2, 0)
  ctx.stroke()
  const steel = ctx.createLinearGradient(0, -1.2, 0, 1.2)
  steel.addColorStop(0, '#d0d0b7')
  steel.addColorStop(0.45, '#797e75')
  steel.addColorStop(1, '#252f31')
  ctx.fillStyle = steel
  ctx.beginPath()
  ctx.moveTo(-3.5, -1.2)
  ctx.lineTo(1, -1.2)
  ctx.quadraticCurveTo(3.2, -0.8, 4.2, 0)
  ctx.quadraticCurveTo(3.2, 0.8, 1, 1.2)
  ctx.lineTo(-3.5, 1.2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#a4874e'
  ctx.fillRect(-2.5, -1.2, 0.7, 2.4)
  ctx.restore()
}

function renderSecondary(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, hx: number, hy: number,
  thx: number, thy: number, angle: number, arcPx: number,
): void {
  ctx.save()
  ctx.translate(hx, hy)
  ctx.scale(0.72, 0.72)
  ctx.translate(-hx, -hy)
  renderGun(ctx, sx, sy, hx, hy, thx, thy, angle, arcPx)
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

function renderYukidaru(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  angle: number,
): void {
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(angle)

  // Water wake trail
  ctx.strokeStyle = 'rgba(160,215,255,0.50)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.lineTo(-14, 0)
  ctx.stroke()

  // Barrel body with wood grain gradient
  const grad = ctx.createLinearGradient(-7.5, 0, 7.5, 0)
  grad.addColorStop(0,   '#5C3317')
  grad.addColorStop(0.3, '#8B5E3C')
  grad.addColorStop(0.7, '#8B5E3C')
  grad.addColorStop(1,   '#5C3317')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(0, 0, 7.5, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Metal hoops
  ctx.strokeStyle = '#1e1828'
  ctx.lineWidth = 1.5
  for (const xPos of [-5, 0, 5] as const) {
    const ry = Math.sqrt(Math.max(0, 25 - (xPos * 5 / 7.5) ** 2)) * 0.82
    ctx.beginPath()
    ctx.ellipse(xPos, 0, 1.4, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Snow mound on top
  ctx.fillStyle = 'rgba(228,243,255,0.92)'
  ctx.beginPath()
  ctx.ellipse(-0.5, -2.1, 3.8, 1.5, -0.18, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function renderMissile(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, hx: number, hy: number,
  thx: number, thy: number, angle: number, arcPx: number, progress: number,
): void {
  ctx.save()
  // Exhaust disperses into smoke, rather than a luminous solid beam.
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    ctx.beginPath()
    ctx.ellipse(hx + (thx - hx) * t, hy + (thy - hy) * t, 1 + t * 3.5, 0.8 + t * 2, angle, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(184,183,171,${(1 - t) * 0.20})`
    ctx.fill()
  }
  ctx.translate(hx, hy)
  ctx.rotate(angle)
  const exhaust = 4 + missileLaunchPhase(progress) * 7
  const flame = ctx.createLinearGradient(-5, 0, -5 - exhaust, 0)
  flame.addColorStop(0, '#fff0bf')
  flame.addColorStop(0.3, 'rgba(234,166,80,0.8)')
  flame.addColorStop(1, 'rgba(196,116,54,0)')
  ctx.fillStyle = flame
  ctx.beginPath()
  ctx.moveTo(-4, -1)
  ctx.lineTo(-5 - exhaust, 0)
  ctx.lineTo(-4, 1)
  ctx.fill()
  ctx.fillStyle = '#adb1aa'
  ctx.fillRect(-4.5, -1.3, 7, 2.6)
  ctx.fillStyle = '#52605d'
  ctx.beginPath()
  ctx.moveTo(2.5, -1.3); ctx.lineTo(6, 0); ctx.lineTo(2.5, 1.3)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-3.5, 0); ctx.lineTo(-5, -3); ctx.lineTo(-1, 0); ctx.lineTo(-5, 3)
  ctx.fill()
  ctx.restore()
}

function renderTorpedo(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, thx: number, thy: number, angle: number,
): void {
  ctx.save()
  const dx = sx - thx, dy = sy - thy
  const length = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / length, ny = dx / length
  // A submerged body is identified chiefly by its widening bubble wake.
  const wake = ctx.createLinearGradient(thx, thy, sx, sy)
  wake.addColorStop(0, 'rgba(196,219,213,0)')
  wake.addColorStop(0.7, 'rgba(196,219,213,0.30)')
  wake.addColorStop(1, 'rgba(221,235,225,0.60)')
  ctx.fillStyle = wake
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(thx + nx * 3, thy + ny * 3)
  ctx.lineTo(thx - nx * 3, thy - ny * 3)
  ctx.closePath()
  ctx.fill()
  ctx.translate(sx, sy)
  ctx.rotate(angle)
  ctx.fillStyle = 'rgba(35,53,53,0.55)'
  ctx.beginPath()
  ctx.ellipse(0, 0, 5.5, 1.3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(210,228,215,0.55)'
  ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(-6, -1); ctx.lineTo(-9, -2.5); ctx.moveTo(-6, 1); ctx.lineTo(-9, 2.5); ctx.stroke()
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

export function projectileVisualPoint(
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
    : proj.weaponType === 'aa' && (proj.targetPos?.z ?? 0) > 0 ? proj.targetPos!.z * progress
    : proj.weaponId === 'weapon.aircraft.bomb' ? (proj.launchPos?.z ?? 150) * (1 - progress)
    : proj.maxHeight * 4 * progress * (1 - progress)
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
