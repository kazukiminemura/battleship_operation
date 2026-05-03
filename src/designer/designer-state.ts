import type { PlayerShipType } from '../game/data/masterdata'
import { getHullsByClass } from '../game/data/hull-catalog'
import { defaultHLGDesign, type HLGDesign } from './hlg-system'

export type PlacementSelection = { kind: 'component'; instanceId: string } | null

export function hullIndexForTemplate(shipType: PlayerShipType, templateId: string): number {
  const hulls = getHullsByClass(shipType)
  return Math.max(0, hulls.findIndex(h => h.templateId === templateId))
}

export function emptyLayoutForHull(): Record<string, never> {
  return {}
}

export function sanitizeDesignForHull(design: HLGDesign | null | undefined, shipType: PlayerShipType, templateId: string): HLGDesign {
  const hull = getHullsByClass(shipType).find(item => item.templateId === templateId) ?? getHullsByClass(shipType)[0]!
  return design?.hullTemplateId === hull.templateId ? design : defaultHLGDesign(hull)
}
