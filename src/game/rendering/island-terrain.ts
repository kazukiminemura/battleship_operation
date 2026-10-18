import type { MapObstacle } from '../simulation/types'

type Point = { x: number; y: number }

function noise(x: number, y: number): number {
  const hash = (a: number, b: number): number => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
    (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
}

export function islandCoast(obstacle: MapObstacle): Point[] {
  return obstacle.points && obstacle.points.length >= 3 ? obstacle.points :
    Array.from({ length: 72 }, (_, i) => ({
      x: obstacle.x + Math.cos(i * Math.PI / 36) * obstacle.rx,
      y: obstacle.y + Math.sin(i * Math.PI / 36) * obstacle.ry,
    }))
}

/** Bake world-anchored relief and surface detail once, without changing collision geometry. */
export function createIslandSurface(obstacle: MapObstacle, size = 256) {
  const coast = islandCoast(obstacle)
  const minX = Math.min(...coast.map(p => p.x)) - 2
  const minY = Math.min(...coast.map(p => p.y)) - 2
  const spanX = Math.max(...coast.map(p => p.x)) - minX + 2
  const spanY = Math.max(...coast.map(p => p.y)) - minY + 2
  const heights = new Float32Array(size * size)
  const depths = new Float32Array(size * size).fill(-1)
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = minX + (px + 0.5) * spanX / size
    const y = minY + (py + 0.5) * spanY / size
    let inside = false, distance = Infinity
    for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {
      const a = coast[j]!, b = coast[i]!
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
      const dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(1, dx * dx + dy * dy)))
      distance = Math.min(distance, Math.hypot(x - a.x - t * dx, y - a.y - t * dy))
    }
    if (!inside) continue
    const i = py * size + px
    depths[i] = distance
    const broad = noise(x / 190, y / 190)
    const ridge = 1 - Math.abs(noise(x / 90 + 23, y / 90) * 2 - 1)
    heights[i] = Math.min(1, distance / 90) * (12 + broad * 95 + ridge * 28 + noise(x / 32, y / 32) * 7)
  }
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let py = 1; py < size - 1; py++) for (let px = 1; px < size - 1; px++) {
    const i = py * size + px
    if (depths[i]! < 0) continue
    const x = minX + px * spanX / size, y = minY + py * spanY / size
    const dx = (heights[i + 1]! - heights[i - 1]!) / (2 * spanX / size)
    const dy = (heights[i + size]! - heights[i - size]!) / (2 * spanY / size)
    const light = Math.max(0.30, Math.min(1.15, (0.85 - dx * 0.65 - dy * 0.45) / Math.sqrt(1 + dx * dx + dy * dy)))
    const grain = noise(x / 7, y / 7)
    const forest = noise(x / 40, y / 40)
    const beach = depths[i]! < 6 + noise(x / 60, y / 60) * 12
    const rock = !beach && (Math.hypot(dx, dy) > 0.85 || heights[i]! > 109)
    const color = beach ? [147, 139, 110] : rock ? [106, 110, 99] : [46 + forest * 24, 65 + forest * 25, 40 + forest * 16]
    for (let c = 0; c < 3; c++) pixels[i * 4 + c] = color[c]! * light + (grain - 0.5) * 22
    pixels[i * 4 + 3] = 255
  }
  return { pixels, size, minX, minY, spanX, spanY }
}

export class IslandTerrainRenderer {
  private readonly surfaces = new WeakMap<MapObstacle, { canvas: HTMLCanvasElement; surface: ReturnType<typeof createIslandSurface> }>()

  render(ctx: CanvasRenderingContext2D, obstacle: MapObstacle, w2s: (x: number, y: number) => [number, number], tick: number): void {
    const coast = islandCoast(obstacle).map(p => w2s(p.x, p.y))
    const xs = coast.map(p => p[0]), ys = coast.map(p => p[1])
    if (Math.max(...xs) < -30 || Math.min(...xs) > ctx.canvas.width + 30 || Math.max(...ys) < -30 || Math.min(...ys) > ctx.canvas.height + 30) return
    let cached = this.surfaces.get(obstacle)
    if (!cached) {
      const surface = createIslandSurface(obstacle)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = surface.size
      const context = canvas.getContext('2d')!
      const data = context.createImageData(surface.size, surface.size)
      data.data.set(surface.pixels)
      context.putImageData(data, 0, 0)
      cached = { canvas, surface }
      this.surfaces.set(obstacle, cached)
    }
    ctx.save()
    ctx.beginPath()
    coast.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    // Submerged shelf and wet coastal margin, not an extruded slab.
    const [cx, cy] = w2s(obstacle.x, obstacle.y)
    const [ex, ey] = w2s(obstacle.x + 1, obstacle.y)
    const scale = Math.hypot(ex - cx, ey - cy)
    ctx.strokeStyle = 'rgba(80,139,130,0.23)'
    ctx.lineWidth = Math.max(3, scale * 30)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(152,177,151,0.22)'
    ctx.lineWidth = Math.max(1, scale * 10)
    ctx.stroke()
    const { minX, minY, spanX, spanY, size } = cached.surface
    const [ox, oy] = w2s(minX, minY)
    const [xx, xy] = w2s(minX + spanX, minY)
    const [yx, yy] = w2s(minX, minY + spanY)
    ctx.save()
    ctx.transform((xx - ox) / size, (xy - oy) / size, (yx - ox) / size, (yy - oy) / size, ox, oy)
    ctx.drawImage(cached.canvas, 0, 0)
    ctx.restore()
    // Broken shore foam avoids a uniform white outline around the island.
    ctx.lineWidth = Math.max(0.65, scale * 2)
    for (let i = 0; i < coast.length; i++) {
      const a = coast[i]!, b = coast[(i + 1) % coast.length]!
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.035 + i * 1.7)
      ctx.strokeStyle = `rgba(218,232,217,${0.08 + pulse * 0.27})`
      ctx.beginPath()
      ctx.moveTo(a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12)
      ctx.lineTo(a[0] + (b[0] - a[0]) * 0.65, a[1] + (b[1] - a[1]) * 0.65)
      ctx.stroke()
    }
    ctx.restore()
  }
}
