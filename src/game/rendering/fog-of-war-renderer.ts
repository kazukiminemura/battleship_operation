import type { CombatState, ShipEntity } from '../simulation/types'
import { effectiveDetectionRange, CONTACT_PERSIST_TICKS } from '../simulation/detection'

const HUD_TOP    = 134
const HUD_BOTTOM = 32

/** Minimal projection context required by the fog renderer. */
export interface FogRenderContext {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  isoScale: number
  w2s: (wx: number, wy: number) => [number, number]
}

/**
 * Renders the fog-of-war overlay and enemy ghost blips.
 * Extracted from CanvasRenderer to keep each class focused on one concern.
 */
export class FogOfWarRenderer {
  render(state: CombatState, cx: FogRenderContext): void {
    this.renderDetectionFog(state, cx)
    this.renderEnemyGhosts(state, cx)
  }

  private renderDetectionFog(state: CombatState, cx: FogRenderContext): void {
    const player = state.entities.get('ship.player') as ShipEntity | undefined
    if (!player || player.destroyed) return

    const { ctx, canvasWidth, canvasHeight, isoScale } = cx
    const [px, py] = cx.w2s(player.pos.x, player.pos.y)
    const R = effectiveDetectionRange(player.detectionRange, state.weather) * isoScale

    ctx.save()

    // Even-odd fill: the rect minus the ellipse hole = fog outside detection radius.
    ctx.beginPath()
    ctx.rect(0, HUD_TOP, canvasWidth, canvasHeight - HUD_TOP - HUD_BOTTOM)
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(1.0, 0.5)     // isometric: y-axis is compressed
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.restore()
    ctx.fillStyle = 'rgba(2,8,14,0.98)'
    ctx.fill('evenodd')

    // Soft gradient fade at the detection boundary edge.
    ctx.translate(px, py)
    ctx.scale(1.0, 0.5)
    const fade = ctx.createRadialGradient(0, 0, R * 0.72, 0, 0, R * 1.05)
    fade.addColorStop(0, 'rgba(4,14,26,0)')
    fade.addColorStop(1, 'rgba(4,14,26,0.88)')
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.08, 0, Math.PI * 2)
    ctx.fillStyle = fade
    ctx.fill()

    ctx.restore()

    // Dashed detection-boundary ring.
    ctx.save()
    ctx.translate(px, py)
    ctx.scale(1.0, 0.5)
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(20,200,160,0.20)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 5])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  private renderEnemyGhosts(state: CombatState, cx: FogRenderContext): void {
    const { ctx } = cx

    for (const [id, contact] of state.enemyContacts) {
      if (state.detectedByPlayer.has(id)) continue

      const age = state.tick - contact.tick
      if (age < 0 || age >= CONTACT_PERSIST_TICKS) continue

      const fade = 1 - age / CONTACT_PERSIST_TICKS
      const [sx, sy] = cx.w2s(contact.pos.x, contact.pos.y)

      ctx.save()
      ctx.globalAlpha = fade * 0.75
      ctx.translate(sx, sy)
      ctx.scale(1.55, 0.62)
      ctx.beginPath()
      ctx.arc(0, 0, 14, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,80,80,0.18)'
      ctx.fill()
      ctx.strokeStyle = `rgba(255,120,100,${0.7 * fade})`
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = fade * 0.85
      ctx.font = 'bold 11px monospace'
      ctx.fillStyle = `rgba(255,160,140,${fade})`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', sx, sy - 2)
      ctx.restore()
    }
  }
}
