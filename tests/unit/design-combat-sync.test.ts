import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { HULL_CATALOG } from '../../src/game/data/hull-catalog'
import { createInitialState } from '../../src/game/data/masterdata'
import { defaultHLGDesign, designLayoutFromHLG, hlgDesignToLoadout, hlgGridSpec, HLG_PART_BY_ID, makeComponent, towerMountFromHLG } from '../../src/designer/hlg-system'
import type { ShipEntity } from '../../src/game/simulation/types'
import { buildShip } from '../../src/game/rendering/three-ship-designer-renderer'
import { combatShipPreviewConfig } from '../../src/game/rendering/three-battlefield-renderer'

const hull = HULL_CATALOG.find(h => h.templateId === 'hull.battleship.basic')!
function fixture() {
  const grid = hlgGridSpec(hull)
  const part = (id: string, r: number, rotation: 0 | 90 | 180 = 0) => makeComponent(HLG_PART_BY_ID[id]!, { c: grid.centerC, r }, rotation, 0)
  return { ...defaultHLGDesign(hull), components: [
    part('part.weapon.weapon.gun.406mm.twin', 35),
    { ...part('part.weapon.weapon.gun.406mm.twin', 70, 180), barrels: 3 },
    part('part.bridge.bb', 100, 90),
    part('part.bridge.bb', 150, 180),
    part('part.funnel.large', 120),
    part('part.funnel.large', 170, 90),
    part('part.boiler.heavy', 120),
    part('part.aux.radar', 185),
  ] }
}
function signature(model: THREE.Group) {
  const result: unknown[] = []
  model.traverse(part => {
    if (part.userData['designInstanceId']) result.push({
      id: part.userData['designInstanceId'], position: part.position.toArray(), rotation: part.rotation.toArray(),
      scale: part.scale.toArray(), visible: part.visible, children: part.children.length,
    })
  })
  return result
}

describe('designer to combat appearance', () => {
  it('carries every grouped turret and placed structure through launch with matching transforms', () => {
    const design = fixture(), layout = designLayoutFromHLG(hull, design)
    const loadout = hlgDesignToLoadout(hull, design), towerMount = towerMountFromHLG(hull, design)
    expect(loadout).toHaveLength(1)
    expect(loadout[0]!.mounts).toHaveLength(2)
    const state = createInitialState('battleship', 1, loadout, hull.templateId, 25, towerMount, layout)
    const entity = state.entities.get('ship.player') as ShipEntity
    const combat = combatShipPreviewConfig(entity)
    expect(combat.weapons).toHaveLength(2)
    expect(combat.weapons.map(w => w.barrels)).toEqual([2, 3])
    expect(combat.structures).toEqual(layout.structures)
    expect(signature(buildShip(combat))).toEqual(signature(buildShip({ hull, armorBonus: 25, towerMount, ...layout })))
    expect(signature(buildShip(combat))).toHaveLength(design.components.length)
  })

  it('does not retain mutable references to the designer after departure', () => {
    const design = fixture(), layout = designLayoutFromHLG(hull, design)
    const state = createInitialState('battleship', 1, hlgDesignToLoadout(hull, design), hull.templateId, 0, undefined, layout)
    const entity = state.entities.get('ship.player') as ShipEntity
    const before = JSON.stringify(entity.designLayout)
    layout.structures[0]!.mount.x = 0.9
    layout.weapons[0]!.rotation = 90
    expect(JSON.stringify(entity.designLayout)).toBe(before)
  })

  it('expands legacy grouped weapons even without a full design snapshot', () => {
    const design = fixture()
    const state = createInitialState('battleship', 1, hlgDesignToLoadout(hull, design), hull.templateId)
    expect(combatShipPreviewConfig(state.entities.get('ship.player') as ShipEntity).weapons).toHaveLength(2)
  })

  it('does not restore automatic bridges or funnels after they are removed from a design', () => {
    const model = buildShip({ hull, armorBonus: 0, towerMount: { x: 0, y: 0 }, weapons: [], structures: [] })
    expect(model.getObjectByName('historical-battleship')).toBeUndefined()
    expect(signature(model)).toEqual([])
  })
})
