import { isShip, type CombatState } from '../simulation/types'

/** Presentation-only director: no hidden contacts and no simulation mutations. */
export class CombatMusicDirector {
  private engagedUntil = -1
  private bossContact: { id: string, until: number } | null = null

  reset(): void { this.engagedUntil = -1; this.bossContact = null }

  update(state: CombatState): 'cruise' | 'normal' | 'boss' {
    const player = state.entities.get('ship.player')
    if (!player || !isShip(player) || player.destroyed) return 'cruise'
    let engaged = false
    for (const id of state.detectedByPlayer) {
      const enemy = state.entities.get(id)
      if (!enemy || !isShip(enemy) || enemy.team !== 'enemy' || enemy.destroyed) continue
      if (enemy.templateId === 'hull.enemy.boss.dreadnought') {
        this.bossContact = { id: enemy.id, until: state.tick + 180 }
        this.engagedUntil = state.tick + 360
      }
      if (Math.hypot(enemy.pos.x - player.pos.x, enemy.pos.y - player.pos.y) < 4500) engaged = true
    }
    const boss = this.bossContact && state.entities.get(this.bossContact.id)
    if (boss && isShip(boss) && !boss.destroyed && state.tick <= this.bossContact!.until) return 'boss'
    this.bossContact = null
    // Hold the combat track through reloads; do not restart it on every salvo.
    if (engaged || state.eventLog.some(event =>
      (event.type === 'weapon.fired' && event.sourceId === player.id) ||
      (event.type === 'weapon.hit' && event.targetId === player.id),
    )) this.engagedUntil = state.tick + 360
    return state.tick <= this.engagedUntil ? 'normal' : 'cruise'
  }
}
