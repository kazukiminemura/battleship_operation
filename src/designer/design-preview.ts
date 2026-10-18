import type { HLGCell, HLGDesign } from './hlg-system'
import { normalizedMountHeight } from '../game/data/gun-mount-geometry'

export interface ComponentMovePreview { instanceId: string; cell: HLGCell; copying?: boolean; mountHeight?: number }
export const COPY_PREVIEW_ID = 'design-copy-preview'

/** A shared drawing snapshot only; never writes to saved design or undo history. */
export function previewDesignMove(design: HLGDesign, preview: ComponentMovePreview | null): HLGDesign {
  if (!preview) return design
  const source = design.components.find(component => component.instanceId === preview.instanceId)
  if (!source) return design
  const moved = { ...source, cell: { ...preview.cell }, ...(preview.mountHeight === undefined ? {} : { mountHeight: normalizedMountHeight(preview.mountHeight) }) }
  return { ...design, components: preview.copying
    ? [...design.components, { ...moved, instanceId: COPY_PREVIEW_ID }]
    : design.components.map(component => component.instanceId === source.instanceId ? moved : component) }
}

/** Side elevation uses five SVG units per metre, including SVG letterboxing. */
export function sideDragHeight(origin: number, deltaPixels: number, svgWidth: number, svgHeight: number): number {
  const scale = Math.min(svgWidth / 1000, svgHeight / 175)
  return scale > 0 && Number.isFinite(scale) ? normalizedMountHeight(origin - deltaPixels / scale / 5) : origin
}

/** Preserve lateral position and height when dragging the longitudinal side view. */
export function sideDragCell(origin: HLGCell, deltaPixels: number, svgWidth: number, svgHeight: number, rows: number): HLGCell {
  const scale = Math.min(svgWidth / 1000, svgHeight / 175)
  if (scale <= 0 || !Number.isFinite(scale)) return { ...origin }
  return { c: origin.c, r: Math.max(0, Math.min(rows - 1, origin.r + Math.round(deltaPixels / scale * rows / 1000))) }
}
