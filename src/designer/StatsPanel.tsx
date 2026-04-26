import type { ShipStats } from './types'

interface Props {
  stats: ShipStats
}

export function StatsPanel({ stats }: Props) {
  const { totalFirepower, totalAntiAir, avgAccuracy, speed, turnRate, weaponList } = stats

  return (
    <div className="sd-stats">
      <div className="sd-section-title">性能パラメータ</div>

      <div className="sd-stats-grid">
        <StatRow label="総火力"   value={totalFirepower.toFixed(0)} color="#f97316" icon="🔥" />
        <StatRow label="対空力"   value={totalAntiAir.toFixed(0)}   color="#4ade80" icon="✈" />
        <StatRow label="平均命中" value={`${(avgAccuracy * 100).toFixed(1)}%`} color="#38bdf8" icon="◎" />
        <StatRow label="推定速力" value={`${speed.toFixed(1)} kt`}  color="#a78bfa" icon="⇒" />
        <StatRow label="旋回性能" value={`${turnRate.toFixed(1)}`}  color="#fb923c" icon="↻" />
      </div>

      <div className="sd-section-title" style={{ marginTop: 16 }}>搭載兵装</div>
      {weaponList.length === 0 ? (
        <div className="sd-stats-empty">兵装未搭載</div>
      ) : (
        <ul className="sd-loadout-list">
          {weaponList.map(({ slotId, slotLabel, weapon }) => (
            <li key={slotId} className="sd-loadout-item">
              <span className="sd-loadout-slot">{slotLabel}</span>
              <span className="sd-loadout-weapon">{weapon.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatRow({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="sd-stat-row">
      <span className="sd-stat-icon" style={{ color }}>{icon}</span>
      <span className="sd-stat-label">{label}</span>
      <span className="sd-stat-value" style={{ color }}>{value}</span>
    </div>
  )
}
