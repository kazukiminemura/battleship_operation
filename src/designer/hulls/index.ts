import type { ReactElement } from 'react'
import type { PlayerShipType } from '../../game/data/masterdata'
import { DestroyerTop,  DestroyerSide  } from './destroyer'
import { CruiserTop,    CruiserSide    } from './cruiser'
import { BattleshipTop, BattleshipSide } from './battleship'

export interface HullComponents {
  TopView:  () => ReactElement
  SideView: () => ReactElement
}

/**
 * Registry of hull visual components keyed by ship type.
 * To add a new ship type: create hulls/<type>.tsx, export TopView + SideView,
 * then add an entry here.
 */
export const HULL_VIEWS: Record<PlayerShipType, HullComponents> = {
  destroyer:  { TopView: DestroyerTop,  SideView: DestroyerSide  },
  cruiser:    { TopView: CruiserTop,    SideView: CruiserSide    },
  battleship: { TopView: BattleshipTop, SideView: BattleshipSide },
}
