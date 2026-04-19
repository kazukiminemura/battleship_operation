import type { CombatState, Command } from '../../game/simulation/types'
import type { RngStreams } from '../../game/simulation/random'
import type { StaticData } from '../../game/data/masterdata'
import { combatStep } from '../../game/simulation/combat'

export interface RunOptions {
  maxTicks: number
  commands?: Command[]
  onTick?: (state: CombatState) => Command[]
}

export interface RunResult {
  finalState: CombatState
  ticksRun: number
}

export function runSimulation(
  initialState: CombatState,
  rng: RngStreams,
  staticData: StaticData,
  options: RunOptions
): RunResult {
  let state = initialState
  let ticksRun = 0

  while (ticksRun < options.maxTicks && state.missionResult === 'none') {
    const cmds = options.onTick ? options.onTick(state) : (options.commands ?? [])
    state = combatStep(state, cmds, rng, staticData)
    ticksRun++
  }

  return { finalState: state, ticksRun }
}
