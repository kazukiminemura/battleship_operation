import { useState, useCallback } from 'react'
import { WeaponPalette } from './WeaponPalette'
import { HullView } from './HullView'
import { WeightGauge } from './WeightGauge'
import { StatsPanel } from './StatsPanel'
import { HULL_SLOTS, calcStats, saveDesign, loadDesign, MAX_WEIGHT } from './data'
import type { Design } from './types'
import './ShipDesigner.css'

interface Props {
  onClose?: () => void
}

export function ShipDesigner({ onClose }: Props) {
  const [design, setDesign] = useState<Design>(() => loadDesign())
  const [draggingWeaponId, setDraggingWeaponId] = useState<string | null>(null)

  const stats = calcStats(design)

  const handleDrop = useCallback((slotId: string, weaponId: string) => {
    setDesign(prev => ({ ...prev, [slotId]: weaponId }))
  }, [])

  const handleRemove = useCallback((slotId: string) => {
    setDesign(prev => {
      const next = { ...prev }
      delete next[slotId]
      return next
    })
  }, [])

  const handleSave = () => {
    saveDesign(design)
    showToast('設計を保存しました')
  }

  const handleLoad = () => {
    setDesign(loadDesign())
    showToast('設計を読み込みました')
  }

  const handleReset = () => {
    setDesign({})
  }

  return (
    <div className="sd-root">
      {/* Header */}
      <header className="sd-header">
        <div className="sd-header-title">
          <span className="sd-header-icon">⚙</span>
          艦船設計システム
        </div>
        <div className="sd-header-actions">
          <button className="sd-btn" onClick={handleSave}>💾 設計を保存</button>
          <button className="sd-btn" onClick={handleLoad}>📂 設計を読み込み</button>
          <button className="sd-btn sd-btn-danger" onClick={handleReset}>🗑 リセット</button>
          <button className="sd-btn sd-btn-back" onClick={onClose ?? (() => { window.location.href = '/' })}>← ゲームに戻る</button>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="sd-body">
        {/* Left: weapon palette */}
        <aside className="sd-panel sd-panel-left">
          <WeaponPalette
            onDragStart={setDraggingWeaponId}
            onDragEnd={() => setDraggingWeaponId(null)}
          />
        </aside>

        {/* Center: hull view */}
        <main className="sd-center">
          <div className="sd-hull-label">戦艦 上面図</div>
          <HullView
            slots={HULL_SLOTS}
            design={design}
            draggingWeaponId={draggingWeaponId}
            onDrop={handleDrop}
            onRemove={handleRemove}
          />
          <div className="sd-hull-hint">
            スロットに兵装をドロップ ／ スロットをクリックで取り外し
          </div>
        </main>

        {/* Right: weight + stats */}
        <aside className="sd-panel sd-panel-right">
          <WeightGauge totalWeight={stats.totalWeight} maxWeight={MAX_WEIGHT} />
          <StatsPanel stats={stats} />
        </aside>
      </div>

      <div id="sd-toast" className="sd-toast" aria-live="polite" />
    </div>
  )
}

function showToast(msg: string) {
  const el = document.getElementById('sd-toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('sd-toast--visible')
  setTimeout(() => el.classList.remove('sd-toast--visible'), 2000)
}
