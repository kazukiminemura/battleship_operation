import type { CombatState, Command } from '../../game/simulation/types'
import { createInitialState } from '../../game/data/masterdata'

export interface GunneryFixture {
  name: string
  seed: number
  initialState: CombatState
  commands: Command[]
  maxTicks: number
}

// Simple fixture: player fires gun at nearest enemy for up to 300 ticks
export const mvpGunneryBasic: GunneryFixture = {
  name: 'mvp-gunnery-basic',
  seed: 42,
  initialState: createInitialState(),
  commands: [],
  maxTicks: 300,
}
