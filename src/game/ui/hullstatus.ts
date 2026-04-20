import type { ShipEntity } from '../simulation/types'

export const HULL_SECTION_ORDER = ['bow', 'stern', 'superstructure', 'deck'] as const

export type HullSection = typeof HULL_SECTION_ORDER[number]

export const HULL_SECTION_LABELS: Record<HullSection, string> = {
  bow: '船首',
  stern: '船尾',
  superstructure: '船楼',
  deck: '甲板',
}

export function estimateHullSections(ship: ShipEntity): Record<HullSection, number> {
  const hpRatio = clamp01(ship.hp / ship.maxHp)
  return {
    bow: clamp01(hpRatio * 1.08 - 0.04),
    stern: clamp01(hpRatio * 1.02 - 0.02),
    superstructure: clamp01(hpRatio * 0.94 + 0.03),
    deck: clamp01(hpRatio * 0.98),
  }
}

export function durabilityColor(ratio: number): string {
  return ratio > 0.55 ? '#22c55e' : ratio > 0.28 ? '#eab308' : '#ef4444'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
