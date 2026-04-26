interface Props {
  totalWeight: number
  maxWeight: number
}

export function WeightGauge({ totalWeight, maxWeight }: Props) {
  const ratio   = Math.min(1, totalWeight / maxWeight)
  const pct     = (ratio * 100).toFixed(1)
  const over    = totalWeight > maxWeight
  const warning = !over && ratio >= 0.8

  const barColor = over ? '#ef4444' : warning ? '#eab308' : '#16a34a'

  return (
    <div className="sd-weight">
      <div className="sd-section-title">重量ゲージ</div>

      <div className={`sd-weight-value ${over ? 'sd-weight-value--over' : warning ? 'sd-weight-value--warn' : ''}`}>
        {totalWeight.toLocaleString()} <span className="sd-weight-unit">t</span>
        <span className="sd-weight-sep">/</span>
        {maxWeight.toLocaleString()} <span className="sd-weight-unit">t</span>
      </div>

      <div className="sd-weight-bar-bg">
        <div
          className="sd-weight-bar-fill"
          style={{ width: `${ratio * 100}%`, background: barColor }}
        />
        {/* 80% threshold marker */}
        <div className="sd-weight-marker" style={{ left: '80%' }} />
      </div>

      <div className={`sd-weight-pct ${over ? 'sd-weight-pct--over' : ''}`}>
        {pct}%
      </div>

      {over && (
        <div className="sd-weight-alert sd-weight-alert--danger">
          ⚠ 重量超過！ 艦の機動力が著しく低下します
        </div>
      )}
      {warning && !over && (
        <div className="sd-weight-alert sd-weight-alert--warn">
          ⚠ 重量が80%を超えています
        </div>
      )}
    </div>
  )
}
