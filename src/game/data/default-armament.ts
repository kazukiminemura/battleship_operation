import type { PlayerShipType } from './masterdata'

export interface StandardMount { x: number; y: number; barrels: number }
const mount = (x: number, y: number, barrels: number): StandardMount => ({ x, y, barrels })
const pair = (y: number, barrels: number, x = .7) => [mount(-x, y, barrels), mount(x, y, barrels)]

/** Slot order matches WEAPON_CATALOG. Coordinates are shared with the designer.
 * More physical mounts, not more HUD slots or decorative non-firing guns.
 */
export const DEFAULT_ARMAMENT: Record<PlayerShipType, readonly StandardMount[][]> = {
  destroyer: [
    [mount(0, -.78, 2), mount(0, .64, 2), mount(0, .85, 2)],
    [mount(0, -.42, 3), mount(0, .45, 3)],
    [...pair(-.37, 1, .5), ...pair(.43, 1, .5)],
    [mount(0, .17, 1)],
  ],
  cruiser: [
    [mount(0, -.80, 2), mount(0, -.49, 2)],
    [mount(0, .78, 2)],
    pair(-.03, 2, .6),
    pair(.56, 3, .55),
    [...pair(-.34, 1, .65), ...pair(.16, 1, .65), ...pair(.61, 1, .55)],
    [mount(0, .42, 1)],
  ],
  battleship: [
    [mount(0, -.82, 3)],
    [mount(0, -.48, 3)],
    [mount(0, .79, 3)],
    [mount(.67, -.02, 2), mount(.67, .35, 2)],
    [mount(-.67, -.02, 2), mount(-.67, .35, 2)],
    [mount(0, .53, 3)],
    [...pair(-.32, 2), ...pair(.13, 2), ...pair(.48, 2), ...pair(.67, 2, .55)],
    [mount(0, -.29, 1)],
  ],
}
