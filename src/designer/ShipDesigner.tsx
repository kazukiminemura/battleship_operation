import { useState, useCallback, useMemo, useEffect } from 'react'
import { WeaponPalette } from './WeaponPalette'
import { HullView } from './HullView'
import { HullSideView } from './HullSideView'
import { WeightGauge } from './WeightGauge'
import { StatsPanel } from './StatsPanel'
import {
  getHullsByClass, calcStats, saveDesign, loadDesign,
  getDesignerSlots, designToLoadout, WEAPONS,
} from './data'
import type { Design } from './types'
import type { PlayerShipType } from '../game/data/masterdata'
import type { PrepResult } from '../game/ui/prepscreen'
import './ShipDesigner.css'

interface Props {
  onClose?: () => void
  onConfirm?: (result: PrepResult) => void
}

type Step = 'ship-select' | 'design'

const SHIP_OPTIONS: { type: PlayerShipType; name: string; desc: string; hpLabel: string; speedLabel: string }[] = [
  { type: 'destroyer',  name: '駆逐艦', desc: '高速・軽装甲\n魚雷・速射砲搭載',    hpLabel: '低',   speedLabel: '高速' },
  { type: 'cruiser',    name: '巡洋艦', desc: '均衡型・多目的\n副砲・ミサイル搭載', hpLabel: '中',   speedLabel: '中速' },
  { type: 'battleship', name: '戦艦',   desc: '重装甲・低速\n超重砲・圧倒的火力',  hpLabel: '最大', speedLabel: '低速' },
]

export function ShipDesigner({ onClose, onConfirm }: Props) {
  const [step, setStep]     = useState<Step>('ship-select')
  const [shipType, setShipType] = useState<PlayerShipType>('battleship')
  const [hullIdx, setHullIdx]   = useState(0)
  const [design, setDesign]     = useState<Design>(() => loadDesign())
  const [draggingWeaponId, setDraggingWeaponId] = useState<string | null>(null)
  const [armorBonus, setArmorBonus] = useState(0)
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null)

  const ARMOR_STEP = 5
  const ARMOR_MAX  = 100

  const hulls = getHullsByClass(shipType)
  const hull  = hulls[hullIdx] ?? hulls[0]!
  const slots = useMemo(() => getDesignerSlots(hull), [hull])
  const stats = useMemo(() => calcStats(design, hull, slots), [design, hull, slots])

  const handleDrop   = useCallback((slotId: string, weaponId: string) =>
    setDesign(prev => ({ ...prev, [slotId]: weaponId })), [])
  const handleRemove = useCallback((slotId: string) =>
    setDesign(prev => { const n = { ...prev }; delete n[slotId]; return n }), [])

  const handleSave  = () => { saveDesign(design); showToast('設計を保存しました') }
  const handleLoad  = () => { setDesign(loadDesign()); showToast('設計を読み込みました') }
  const handleReset = () => setDesign({})
  const handleAutoPlace = () => {
    const next: Design = {}
    for (const slot of slots) {
      const weapon = WEAPONS
        .filter(w => slot.compatibleTypes.includes(w.type))
        .sort((a, b) => weaponScore(b) - weaponScore(a) || b.weight - a.weight || a.name.localeCompare(b.name))[0]
      if (weapon) next[slot.id] = weapon.id
    }
    setDesign(next)
    showToast('兵装を自動配置しました')
  }

  const handleSelectShip = (type: PlayerShipType) => {
    setShipType(type)
    setHullIdx(0)
    setDesign({})
    setStep('design')
  }

  const handleDeploy = useCallback(() => {
    if (!onConfirm) return
    saveDesign(design)
    onConfirm({
      templateId: hull.templateId,
      shipType:   hull.shipType,
      loadout:    designToLoadout(design, hull),
      armorBonus,
    })
  }, [design, hull, armorBonus, onConfirm])

  useEffect(() => {
    if (step !== 'design' || !onConfirm) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      handleDeploy()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDeploy, onConfirm, step])

  /* ── Step 1: ship type selection ─────────────────────────────────────────── */
  if (step === 'ship-select') {
    return (
      <div className="sd-root">
        <header className="sd-header">
          <div className="sd-header-title"><span className="sd-header-icon">⚙</span>艦船設計システム</div>
          {onClose && (
            <button className="sd-btn sd-btn-back" onClick={onClose}>← タイトルへ</button>
          )}
        </header>
        <div className="sd-ship-select">
          <div className="sd-ship-select-title">艦種を選択</div>
          <div className="sd-ship-cards">
            {SHIP_OPTIONS.map(opt => (
              <button key={opt.type} className="sd-ship-card" onClick={() => handleSelectShip(opt.type)}>
                <div className="sd-ship-card-class">{opt.name}</div>
                <div className="sd-ship-card-desc">{opt.desc}</div>
                <div className="sd-ship-card-badges">
                  <span className="sd-ship-badge sd-ship-badge--hp">耐久 {opt.hpLabel}</span>
                  <span className="sd-ship-badge sd-ship-badge--spd">速力 {opt.speedLabel}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Step 2: weapon design ───────────────────────────────────────────────── */
  return (
    <div className="sd-root">
      <header className="sd-header">
        <div className="sd-header-title"><span className="sd-header-icon">⚙</span>艦船設計システム</div>
        <div className="sd-header-actions">
          <button className="sd-btn" onClick={handleSave}>💾 保存</button>
          <button className="sd-btn" onClick={handleLoad}>📂 読込</button>
          <button className="sd-btn sd-btn-auto" onClick={handleAutoPlace}>自動配置</button>
          <button className="sd-btn sd-btn-danger" onClick={handleReset}>🗑 リセット</button>
          <button className="sd-btn sd-btn-back" onClick={() => { setStep('ship-select'); setDesign({}) }}>
            ← 艦種変更
          </button>
          {onConfirm && (
            <button className="sd-btn sd-btn-deploy" onClick={handleDeploy}>⚓ 出撃</button>
          )}
        </div>
      </header>

      <div className="sd-body">
        {/* Left: weapon palette filtered by hull slot types */}
        <aside className="sd-panel sd-panel-left">
          <WeaponPalette
            hull={hull}
            onDragStart={setDraggingWeaponId}
            onDragEnd={() => setDraggingWeaponId(null)}
          />
        </aside>

        {/* Center: hull selector tabs + top-down + side views */}
        <main className="sd-center">
          {hulls.length > 1 && (
            <div className="sd-hull-tabs">
              {hulls.map((h, i) => (
                <button
                  key={h.templateId}
                  className={`sd-hull-tab${i === hullIdx ? ' sd-hull-tab--active' : ''}`}
                  onClick={() => { setHullIdx(i); setDesign({}) }}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}

          {/* Side view on top, top-down view rotated below — both at matching scale */}
          {(() => {
            const sideScale = 1 + hullIdx * 0.1
            const topScale  = sideScale * (480 / 700)
            const topW      = Math.round(160 * topScale)
            const topH      = Math.round(700 * topScale)
            return (
              <div className="sd-views-stack">
                {/* Side view */}
                <div className="sd-view-col">
                  <div className="sd-hull-label">{hull.className} — 側面図</div>
                  <HullSideView
                      shipType={shipType}
                      scale={sideScale}
                      slots={slots}
                      design={design}
                      draggingWeaponId={draggingWeaponId}
                      hoveredSlotId={hoveredSlotId}
                      onDrop={handleDrop}
                      onRemove={handleRemove}
                      onSlotHover={setHoveredSlotId}
                    />
                </div>

                {/* Top-down view rotated 90° CW so bow faces left, matching side view */}
                <div className="sd-view-col">
                  <div className="sd-hull-label">{hull.className} — 上面図</div>
                  <div style={{ width: topH, height: topW, position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      width: topW,
                      height: topH,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transformOrigin: '0 0',
                      transform: `translateY(${topW}px) rotate(-90deg)`,
                    }}>
                      <HullView
                        slots={slots}
                        design={design}
                        draggingWeaponId={draggingWeaponId}
                        scale={topScale}
                        shipType={shipType}
                        hoveredSlotId={hoveredSlotId}
                        onDrop={handleDrop}
                        onRemove={handleRemove}
                        onSlotHover={setHoveredSlotId}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="sd-hull-hint">スロットに兵装をドロップ ／ クリックで取り外し</div>
        </main>

        {/* Right: weight gauge + stats + armor grade */}
        <aside className="sd-panel sd-panel-right">
          <WeightGauge totalWeight={stats.totalWeight} maxWeight={stats.maxWeight} />
          <StatsPanel stats={stats} />
          <div className="sd-armor-grade">
            <div className="sd-section-title">装甲グレード</div>
            <div className="sd-armor-grade-row">
              <button
                className="sd-btn sd-armor-btn"
                disabled={armorBonus <= 0}
                onClick={() => setArmorBonus(v => Math.max(0, v - ARMOR_STEP))}
              >－</button>
              <div className="sd-armor-grade-bar-wrap">
                <div
                  className="sd-armor-grade-bar-fill"
                  style={{ width: `${(armorBonus / ARMOR_MAX) * 100}%` }}
                />
                <span className="sd-armor-grade-label">
                  {armorBonus > 0 ? `+${armorBonus}` : '0'}
                </span>
              </div>
              <button
                className="sd-btn sd-armor-btn"
                disabled={armorBonus >= ARMOR_MAX}
                onClick={() => setArmorBonus(v => Math.min(ARMOR_MAX, v + ARMOR_STEP))}
              >＋</button>
            </div>
            <div className="sd-armor-grade-hint">装甲増加 / 速力・機動性低下 / 船体大型化</div>
          </div>
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

function weaponScore(weapon: { firepower?: number; antiAir?: number; accuracy: number; reload: number }): number {
  const firepower = weapon.firepower ?? 0
  const antiAir = weapon.antiAir ?? 0
  return (firepower * 2.2 + antiAir * 1.6) * weapon.accuracy / Math.max(0.3, weapon.reload)
}
