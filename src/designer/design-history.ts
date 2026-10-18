import { useCallback, useReducer, type SetStateAction } from 'react'
import { cloneHLGDesign, type HLGDesign } from './hlg-system'

export interface DesignHistory { past: HLGDesign[]; present: HLGDesign; future: HLGDesign[] }
type HistoryAction = { type: 'edit'; update: SetStateAction<HLGDesign> } | { type: 'reset'; design: HLGDesign } | { type: 'undo' | 'redo' }
const HISTORY_LIMIT = 40

export function initialDesignHistory(design: HLGDesign): DesignHistory {
  return { past: [], present: cloneHLGDesign(design), future: [] }
}

export function reduceDesignHistory(history: DesignHistory, action: HistoryAction): DesignHistory {
  if (action.type === 'reset') return initialDesignHistory(action.design)
  if (action.type === 'undo') {
    const previous = history.past.at(-1)
    return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history
  }
  if (action.type === 'redo') {
    const next = history.future[0]
    return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) } : history
  }
  if (action.type !== 'edit') return history
  const next = typeof action.update === 'function' ? action.update(history.present) : action.update
  if (next === history.present || JSON.stringify(next) === JSON.stringify(history.present)) return history
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: cloneHLGDesign(next), future: [] }
}

export function useDesignHistory(initial: HLGDesign) {
  const [history, dispatch] = useReducer(reduceDesignHistory, initial, initialDesignHistory)
  return {
    design: history.present,
    setDesign: useCallback((update: SetStateAction<HLGDesign>) => dispatch({ type: 'edit', update }), []),
    resetDesign: useCallback((design: HLGDesign) => dispatch({ type: 'reset', design }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
