import type { WeaponType } from './types'

export interface FiringArc {
  center: number
  width: number
}

export function firingArcForWeapon(type: WeaponType, mount?: { x: number; y: number }): FiringArc {
  const x = mount?.x ?? 0
  const y = mount?.y ?? 0
  const side = x < -0.18 ? -1 : x > 0.18 ? 1 : 0

  if (type === 'aa' || type === 'missile') return fullArc()

  if (type === 'torpedo') {
    if (side < 0) return degreesArc(-90, 86)
    if (side > 0) return degreesArc(90, 86)
    return y > 0.50 ? degreesArc(180, 70) : degreesArc(0, 70)
  }

  if (type === 'secondary') {
    if (side < 0) return degreesArc(-90, 190)
    if (side > 0) return degreesArc(90, 190)
    return y > 0.50 ? degreesArc(180, 280) : degreesArc(0, 280)
  }

  if (y < -0.48) return degreesArc(0, 270)
  if (y > 0.48) return degreesArc(180, 270)
  if (side < 0) return degreesArc(-65, 250)
  if (side > 0) return degreesArc(65, 250)
  return degreesArc(0, 320)
}

export function isDirectionWithinFiringArc(relativeAngle: number, arc: FiringArc): boolean {
  if (arc.width >= Math.PI * 2 - 0.001) return true
  return Math.abs(normalizeAngle(relativeAngle - arc.center)) <= arc.width / 2
}

export function firingArcLabel(arc: FiringArc): string {
  if (arc.width >= Math.PI * 2 - 0.001) return '全周'
  const deg = Math.round(normalizeDegrees(arc.center * 180 / Math.PI))
  const width = Math.round(arc.width * 180 / Math.PI)
  const direction = deg === 0 ? '前方'
    : deg === 180 ? '後方'
      : deg === 90 ? '右舷'
        : deg === 270 ? '左舷'
          : `${deg}°`
  return `${direction} ${width}°`
}

function degreesArc(centerDegrees: number, widthDegrees: number): FiringArc {
  return {
    center: centerDegrees * Math.PI / 180,
    width: Math.min(Math.PI * 2, Math.max(0, widthDegrees * Math.PI / 180)),
  }
}

function fullArc(): FiringArc {
  return { center: 0, width: Math.PI * 2 }
}

function normalizeAngle(angle: number): number {
  let a = angle
  while (a <= -Math.PI) a += Math.PI * 2
  while (a > Math.PI) a -= Math.PI * 2
  return a
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}
