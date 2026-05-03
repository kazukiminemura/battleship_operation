import { beforeEach, describe, expect, it } from 'vitest'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { defaultHLGDesign } from '../../src/designer/hlg-system'
import { LEGACY_STORAGE_KEY, loadDesignerState, PREVIOUS_STORAGE_KEY, saveDesign, STORAGE_KEY } from '../../src/designer/data'

const battleship = HULL_CATALOG.find(hull => hull.templateId === 'hull.battleship.basic')!

describe('designer save slots', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size },
    } as Storage
  })

  it('keeps four save slots isolated', () => {
    const slotTwoDesign = {
      ...defaultHLGDesign(battleship),
      armorPlan: { belt: 7, deck: 3, bulkhead: 2 },
    }
    saveDesign(slotTwoDesign, 2)

    expect(loadDesignerState(battleship, 2).design.armorPlan).toEqual({ belt: '14cm', deck: '10cm', bulkhead: 2 })
    expect(loadDesignerState(battleship, 1).design.armorPlan).not.toEqual(slotTwoDesign.armorPlan)
  })

  it('keeps the old single-save key readable as slot one', () => {
    const previousDesign = {
      ...defaultHLGDesign(battleship),
      armorPlan: { belt: 4, deck: 4, bulkhead: 1 },
    }
    localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify({ design: previousDesign }))

    expect(loadDesignerState(battleship, 1).design.armorPlan).toEqual({ belt: '12cm', deck: '12cm', bulkhead: 1 })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
  })
})
