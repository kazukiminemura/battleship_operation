export function damageSmokeLevel(hp: number, maxHp: number, destroyed = false): number {
  if (destroyed) return 1
  if (maxHp <= 0 || hp >= maxHp) return 0
  return Math.min(1, 0.22 + Math.max(0, 1 - hp / maxHp) * 0.78)
}

export class DamageSmokeRenderer {
  private sprite: OffscreenCanvas | null = null

  render(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, severity: number, tick: number, seed: number): void {
    if (severity <= 0) return
    if (!this.sprite) {
      this.sprite = new OffscreenCanvas(64, 64)
      const c = this.sprite.getContext('2d')!
      const cloud = c.createRadialGradient(29, 27, 3, 32, 32, 30)
      cloud.addColorStop(0, 'rgba(23,25,25,0.80)')
      cloud.addColorStop(.4, 'rgba(40,42,40,0.65)')
      cloud.addColorStop(.75, 'rgba(61,62,57,0.30)')
      cloud.addColorStop(1, 'rgba(70,71,65,0)')
      c.fillStyle = cloud; c.fillRect(0, 0, 64, 64)
    }
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    const count = 8 + Math.round(severity * 8)
    for (let i = count - 1; i >= 0; i--) {
      const age = ((tick / 110) + i / count + seed * .137) % 1
      const radius = size * (.32 + age * 1.6)
      const drift = age * size * 1.8 + Math.sin(age * 8 + i) * size * .18
      const rise = age * size * (3 + severity * 2)
      ctx.globalAlpha = severity * (1 - age) * .72
      ctx.drawImage(this.sprite, x + drift - radius, y - rise - radius, radius * 2, radius * 2)
    }
    ctx.restore()
  }
}
