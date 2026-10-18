import type { AircraftEntity } from '../simulation/types'

export function renderAircraft(ctx: CanvasRenderingContext2D, plane: AircraftEntity, scale: number, w2s: (x: number, y: number) => [number, number], tick: number): void {
  if (plane.phase === 'crashed') return
  const [x, groundY] = w2s(plane.pos.x, plane.pos.y)
  const [forwardX, forwardY] = w2s(plane.pos.x + Math.cos(plane.angle), plane.pos.y + Math.sin(plane.angle))
  const angle = Math.atan2(forwardY - groundY, forwardX - x)
  const size = Math.max(4, scale * 38)
  const silhouette = (): void => {
    ctx.beginPath()
    ctx.moveTo(size, 0); ctx.lineTo(size * .3, -size * .13)
    ctx.lineTo(0, -size * 1.2); ctx.lineTo(-size * .32, -size * 1.1)
    ctx.lineTo(-size * .2, -size * .12); ctx.lineTo(-size * .8, -size * .12)
    ctx.lineTo(-size, -size * .48); ctx.lineTo(-size * 1.15, -size * .4)
    ctx.lineTo(-size, 0); ctx.lineTo(-size * 1.15, size * .4)
    ctx.lineTo(-size, size * .48); ctx.lineTo(-size * .8, size * .12)
    ctx.lineTo(-size * .2, size * .12); ctx.lineTo(-size * .32, size * 1.1)
    ctx.lineTo(0, size * 1.2); ctx.lineTo(size * .3, size * .13)
    ctx.closePath()
  }
  ctx.save()
  ctx.translate(x + plane.pos.z * scale * .15, groundY + plane.pos.z * scale * .08)
  ctx.rotate(angle)
  ctx.fillStyle = 'rgba(0,0,0,0.23)'
  silhouette(); ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.translate(x, groundY - plane.pos.z * scale)
  ctx.rotate(angle)
  if (plane.phase === 'crashing') {
    const age = tick - (plane.crashTick ?? tick)
    ctx.scale(1, .55 + .35 * Math.cos(age * .16))
    ctx.rotate(.2 * Math.sin(age * .12))
  }
  ctx.fillStyle = plane.phase === 'crashing' ? '#4c5046' : '#8d9684'
  ctx.strokeStyle = '#2d3936'
  ctx.lineWidth = .75
  silhouette(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#263c43'
  ctx.fillRect(size * .15, -size * .1, size * .35, size * .2)
  if (plane.phase !== 'crashing') {
    ctx.strokeStyle = `rgba(221,225,208,${.3 + .15 * Math.sin(tick)})`
    ctx.beginPath(); ctx.moveTo(size * .9, -size * .4); ctx.lineTo(size * .9, size * .4); ctx.stroke()
  }
  ctx.fillStyle = '#d2b679'
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(-size * .05, side * size * .7, size * .12, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}
