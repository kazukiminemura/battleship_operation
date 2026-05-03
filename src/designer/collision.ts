import type { HLGDesign } from './hlg-system'

export function wouldInterfere(): boolean {
  return false
}

export function collidingIds(_design: HLGDesign): Set<string> {
  return new Set()
}
