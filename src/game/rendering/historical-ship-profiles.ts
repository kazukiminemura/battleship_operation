import type { ShipShapeClass } from './ship-rendering-data'

export interface HistoricalShipProfile {
  kind: 'destroyer' | 'cruiser' | 'battleship'
  inspiration: string
  lengthToBeam: number
  freeboard: number
  gunScale: number
  funnelPositions: readonly number[]
  funnelHeight: number
  bridgeHeight: number
  timberDeck: boolean
}

const PROFILES: Record<HistoricalShipProfile['kind'], HistoricalShipProfile> = {
  destroyer: {
    kind: 'destroyer', inspiration: 'Fubuki-era destroyer', lengthToBeam: 10.2,
    freeboard: 0.032, gunScale: 0.47, funnelPositions: [-0.01, -0.135],
    funnelHeight: 0.062, bridgeHeight: 0.09, timberDeck: false,
  },
  cruiser: {
    kind: 'cruiser', inspiration: 'Takao-era cruiser', lengthToBeam: 9.0,
    freeboard: 0.035, gunScale: 0.70, funnelPositions: [-0.035, -0.14],
    funnelHeight: 0.061, bridgeHeight: 0.13, timberDeck: true,
  },
  battleship: {
    kind: 'battleship', inspiration: 'Yamato-era battleship', lengthToBeam: 7.3,
    freeboard: 0.028, gunScale: 1.13, funnelPositions: [-0.055],
    funnelHeight: 0.074, bridgeHeight: 0.14, timberDeck: true,
  },
}

/** Appearance only: never changes simulation size, armor, speed or installed weapons. */
export function historicalProfile(shape: ShipShapeClass): HistoricalShipProfile {
  return PROFILES[shape === 'destroyer' || shape === 'cruiser' ? shape : 'battleship']
}
