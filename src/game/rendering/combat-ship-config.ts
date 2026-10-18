import * as THREE from 'three'
import type { ShipEntity } from '../simulation/types'
import { SHIP_DIMS } from '../data/ship-dimensions'
import { HULL_CATALOG, type HullCatalogEntry } from '../data/hull-catalog'
import type { ShipDesignerPreviewConfig } from './three-ship-designer-renderer'

export function combatShipPreviewConfig(ship: ShipEntity): ShipDesignerPreviewConfig {
  const hull = hullEntryForShip(ship)
  return {
    hull,
    armorBonus: ship.armorBonus ?? 0,
    towerMount: ship.towerMount ?? bridgeMountForHull(hull),
    structures: ship.designLayout?.structures,
    weapons: ship.designLayout ? ship.designLayout.weapons.map(weapon => ({ ...weapon, selected: false })) : ship.weapons.flatMap((weapon, index) => weapon.mounts?.length ? weapon.mounts.map(mount => ({
      id: weapon.id,
      instanceId: mount.instanceId,
      name: weapon.name,
      type: weapon.type,
      mount: mount.mount ?? combatVisualMount(ship, weapon, index),
      barrels: mount.barrels ?? weapon.barrels,
      mountHeight: mount.mountHeight ?? weapon.mountHeight,
      selected: false,
    })) : [{
      id: weapon.id,
      name: weapon.name,
      type: weapon.type,
      mount: combatVisualMount(ship, weapon, index),
      barrels: weapon.barrels,
      mountHeight: weapon.mountHeight,
      selected: false,
    }]),
  }
}

function hullEntryForShip(ship: ShipEntity): HullCatalogEntry {
  const exact = HULL_CATALOG.find(hull => hull.templateId === ship.templateId)
  if (exact) return exact

  const shipType =
    ship.templateId.includes('cruiser') ? 'cruiser' :
      ship.templateId.includes('battleship') || ship.templateId.includes('boss') ? 'battleship' :
        'destroyer'
  const fallback = HULL_CATALOG.find(hull => hull.shipType === shipType)
  if (fallback) return { ...fallback, templateId: ship.templateId, shipType, name: ship.templateId, className: ship.team === 'enemy' ? '敵艦' : fallback.className }

  return {
    templateId: ship.templateId,
    shipType,
    name: ship.templateId,
    className: ship.team === 'enemy' ? '敵艦' : '艦船',
    minStage: 1,
    hp: ship.maxHp,
    armor: ship.armor,
    maxSpeed: ship.maxSpeed,
    turnRate: ship.turnRate,
    slots: [],
  }
}

function bridgeMountForHull(hull: HullCatalogEntry): { x: number; y: number } {
  if (hull.shipType === 'destroyer') return { x: 0, y: -0.12 }
  if (hull.shipType === 'cruiser') return { x: 0, y: -0.04 }
  return { x: 0, y: 0 }
}

function combatVisualMount(ship: ShipEntity, weapon: ShipEntity['weapons'][number], index: number): { x: number; y: number } {
  if (weapon.mount) return weapon.mount
  const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
  const offset = visualWeaponLocalOffset(weapon.id, index, dim)
  return {
    x: -offset.lat / (dim.w * 0.30),
    y: -offset.lon / (dim.l * 0.42),
  }
}

function visualWeaponLocalOffset(weaponId: string, weaponIdx: number, dim: { l: number; w: number }): { lon: number; lat: number } {
  if (weaponId.includes('forward')) return { lon: dim.l * 0.34, lat: 0 }
  if (weaponId.includes('center')) return { lon: dim.l * 0.10, lat: 0 }
  if (weaponId.includes('aft')) return { lon: -dim.l * 0.32, lat: 0 }
  if (weaponId.includes('port')) return { lon: -dim.l * 0.08, lat: dim.w * 0.28 }
  if (weaponId.includes('starboard')) return { lon: -dim.l * 0.08, lat: -dim.w * 0.28 }
  if (weaponId.includes('torpedo')) return { lon: -dim.l * 0.03, lat: weaponIdx % 2 === 0 ? dim.w * 0.36 : -dim.w * 0.36 }
  if (weaponId.includes('aa')) return { lon: -dim.l * 0.02, lat: 0 }
  if (weaponId.includes('missile')) return { lon: -dim.l * 0.18, lat: 0 }
  if (weaponIdx === 0) return { lon: dim.l * 0.26, lat: 0 }
  if (weaponIdx === 1) return { lon: -dim.l * 0.26, lat: 0 }
  const t = Math.max(0, Math.min(1, weaponIdx / 6))
  return {
    lon: THREE.MathUtils.lerp(dim.l * 0.22, -dim.l * 0.28, t),
    lat: 0,
  }
}

