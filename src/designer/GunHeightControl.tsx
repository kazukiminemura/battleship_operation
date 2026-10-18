import { GUN_MOUNT_HEIGHTS } from '../game/data/gun-mount-geometry'

/** Uses the same stepped heights as placement and clearance checks. */
export function GunHeightControl({ label, value, onChange }: {
  label: string; value: number; onChange: (height: number) => void
}) {
  const min = GUN_MOUNT_HEIGHTS[0], max = GUN_MOUNT_HEIGHTS.at(-1)!
  return <div className="sd-gun-height" role="group" aria-label={label}>
    <span>{label} <output>{value} m</output></span>
    <div className="sd-gun-height-track">
      <button type="button" aria-label={`${label}を下げる`} disabled={value <= min} onClick={() => onChange(value - 2)}>↓</button>
      <label><span>低い</span><input type="range" aria-label={label} aria-valuetext={`甲板から ${value} メートル`} min={min} max={max} step={2} value={value} onChange={event => onChange(Number(event.target.value))} /><span>高い</span></label>
      <button type="button" aria-label={`${label}を上げる`} disabled={value >= max} onClick={() => onChange(value + 2)}>↑</button>
    </div>
  </div>
}
