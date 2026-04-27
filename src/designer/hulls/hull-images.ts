import destroyerI   from './ship_svg/destroyer_I.png'
import destroyerII  from './ship_svg/destroyer_II.png'
import destroyerIII from './ship_svg/destroyer_III.png'

/**
 * Maps hull templateId to a PNG image URL.
 * The PNG contains both the top-down view (upper half) and side view (lower half).
 */
export const HULL_PNG: Record<string, string> = {
  'hull.destroyer.basic': destroyerI,
  'hull.dd.improved':     destroyerII,
  'hull.dd.elite':        destroyerIII,
}
