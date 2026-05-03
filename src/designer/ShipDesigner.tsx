import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Ship3DPreview } from './Ship3DPreview'
import { WeightGauge } from './WeightGauge'
import {
  calcStats,
  createDesignForHull,
  createDesignFromPrepResult,
  designToLoadout,
  designTowerMount,
  getHullsByClass,
  hullIndexForTemplate,
  loadDesignerState,
  saveDesign,
} from './data'
import {
  HLG_PARTS,
  HLG_PART_BY_ID,
  canPlaceHLGPart,
  cloneHLGDesign,
  componentRect,
  defaultHLGDesign,
  hlgCellIsInsideHull,
  hlgCellZones,
  hlgGridSpec,
  makeComponent,
  rotateFootprint,
  type HLGCell,
  type HLGComponentCategory,
  type HLGComponentInstance,
  type HLGDesign,
  type HLGPartDefinition,
  type HLGRotation,
} from './hlg-system'
import type { PlayerShipType } from '../game/data/masterdata'
import type { PrepResult } from '../game/ui/prepscreen'
import './ShipDesigner.css'

interface Props {
  onClose?: () => void
  onConfirm?: (result: PrepResult) => void
  initialResult?: PrepResult | null
}

type Step = 'ship-select' | 'design'

const SHIP_OPTIONS: { type: PlayerShipType; name: string; desc: string; hpLabel: string; speedLabel: string }[] = [
  { type: 'destroyer', name: '駆逐艦', desc: '高速・小型船体\n軽兵装と魚雷を密に配置', hpLabel: '低', speedLabel: '高速' },
  { type: 'cruiser', name: '巡洋艦', desc: '中型船体\n砲・魚雷・誘導兵器を両立', hpLabel: '中', speedLabel: '中速' },
  { type: 'battleship', name: '戦艦', desc: '大型船体\n重砲・装甲・大出力機関', hpLabel: '最大', speedLabel: '低速' },
]

const CATEGORY_LABEL: Record<HLGComponentCategory | 'all', string> = {
  all: '全パーツ',
  weapon: '兵装',
  bridge: '艦橋',
  funnel: '煙突',
  boiler: '主缶',
  turbine: '主機',
  aux: '補助',
  armor: '装甲',
}

export function ShipDesigner({ onClose, onConfirm, initialResult = null }: Props) {
  const initialShipType = initialResult?.shipType ?? 'battleship'
  const initialHulls = getHullsByClass(initialShipType)
  const initialHull = initialHulls[hullIndexForTemplate(initialShipType, initialResult?.templateId ?? initialHulls[0]!.templateId)] ?? initialHulls[0]!
  const initialDesign = createDesignFromPrepResult(initialResult) ?? loadDesignerState(initialHull).design

  const [step, setStep] = useState<Step>(() => initialResult ? 'design' : 'ship-select')
  const [shipType, setShipType] = useState<PlayerShipType>(initialShipType)
  const [hullIdx, setHullIdx] = useState(() => hullIndexForTemplate(initialShipType, initialHull.templateId))
  const [design, setDesign] = useState<HLGDesign>(() => createDesignForHull(initialHull, initialDesign))
  const [selectedPartId, setSelectedPartId] = useState<string>(() => defaultSelectedPart(initialHull.shipType))
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [partFilter, setPartFilter] = useState<HLGComponentCategory | 'all'>('all')

  const hulls = getHullsByClass(shipType)
  const hull = hulls[hullIdx] ?? hulls[0]!
  const spec = useMemo(() => hlgGridSpec(hull), [hull])
  const stats = useMemo(() => calcStats(design, hull), [design, hull])
  const visibleParts = useMemo(
    () => HLG_PARTS.filter(part => part.allowedShipClasses.includes(shipType) && (partFilter === 'all' || part.category === partFilter)),
    [partFilter, shipType],
  )
  const selectedPart = HLG_PART_BY_ID[selectedPartId] ?? visibleParts[0]
  const selectedComponent = design.components.find(component => component.instanceId === selectedComponentId) ?? null

  const replaceDesign = useCallback((next: HLGDesign) => {
    setDesign(cloneHLGDesign(next))
    setSelectedComponentId(null)
  }, [])

  const handleSelectShip = (type: PlayerShipType) => {
    const nextHull = getHullsByClass(type)[0]!
    setShipType(type)
    setHullIdx(0)
    replaceDesign(loadDesignerState(nextHull).design)
    setSelectedPartId(defaultSelectedPart(type))
    setStep('design')
  }

  const handleSelectHull = (index: number) => {
    const nextHull = hulls[index]!
    setHullIdx(index)
    replaceDesign(loadDesignerState(nextHull).design)
    setSelectedPartId(defaultSelectedPart(nextHull.shipType))
  }

  const handleGridClick = (cell: HLGCell) => {
    const existing = componentAtCell(design, cell)
    if (existing) {
      setSelectedComponentId(existing.instanceId)
      return
    }
    if (!selectedPart) return
    const rotation: HLGRotation = 0
    if (!canPlaceHLGPart(hull, design, selectedPart, cell, rotation)) {
      showToast('この位置には配置できません')
      return
    }
    setDesign(prev => ({
      ...prev,
      components: [...prev.components, makeComponent(selectedPart, cell, rotation)],
    }))
  }

  const handleRotate = () => {
    if (!selectedComponent) return
    setDesign(prev => {
      const next = cloneHLGDesign(prev)
      const index = next.components.findIndex(component => component.instanceId === selectedComponent.instanceId)
      const component = next.components[index]
      const part = component ? HLG_PART_BY_ID[component.partId] : undefined
      if (!component || !part) return prev
      const rotation = nextRotation(component.rotation)
      const without = { ...next, components: next.components.filter(c => c.instanceId !== component.instanceId) }
      if (!canPlaceHLGPart(hull, without, part, component.cell, rotation)) {
        showToast('回転後の配置が不正です')
        return prev
      }
      next.components[index] = { ...component, rotation }
      return next
    })
  }

  const handleDelete = () => {
    if (!selectedComponent) return
    setDesign(prev => ({ ...prev, components: prev.components.filter(component => component.instanceId !== selectedComponent.instanceId) }))
    setSelectedComponentId(null)
  }

  const handleDeleteComponent = (instanceId: string) => {
    setDesign(prev => ({ ...prev, components: prev.components.filter(component => component.instanceId !== instanceId) }))
    setSelectedComponentId(current => current === instanceId ? null : current)
    showToast('船体外へ移動したパーツを削除しました')
  }

  const handleNudge = (dc: number, dr: number) => {
    if (!selectedComponent) return
    setDesign(prev => {
      const next = cloneHLGDesign(prev)
      const index = next.components.findIndex(component => component.instanceId === selectedComponent.instanceId)
      const component = next.components[index]
      const part = component ? HLG_PART_BY_ID[component.partId] : undefined
      if (!component || !part) return prev
      const moved = { ...component, cell: { c: component.cell.c + dc, r: component.cell.r + dr } }
      const without = { ...next, components: next.components.filter(c => c.instanceId !== component.instanceId) }
      if (!canPlaceHLGPart(hull, without, part, moved.cell, moved.rotation)) {
        showToast('移動先には配置できません')
        return prev
      }
      next.components[index] = moved
      return next
    })
  }

  const handleMoveComponent = (instanceId: string, cell: HLGCell): boolean => {
    const component = design.components.find(item => item.instanceId === instanceId)
    const part = component ? HLG_PART_BY_ID[component.partId] : undefined
    if (!component || !part) return false
    const without = { ...design, components: design.components.filter(item => item.instanceId !== instanceId) }
    if (!canPlaceHLGPart(hull, without, part, cell, component.rotation)) return false
    setDesign(prev => ({
      ...prev,
      components: prev.components.map(item => item.instanceId === instanceId ? { ...item, cell } : item),
    }))
    setSelectedComponentId(instanceId)
    return true
  }

  const handleCopyComponent = (instanceId: string, cell: HLGCell): boolean => {
    const component = design.components.find(item => item.instanceId === instanceId)
    const part = component ? HLG_PART_BY_ID[component.partId] : undefined
    if (!component || !part) return false
    if (!canPlaceHLGPart(hull, design, part, cell, component.rotation)) return false
    const copied = { ...makeComponent(part, cell, component.rotation), barrels: component.barrels }
    setDesign(prev => ({
      ...prev,
      components: [...prev.components, copied],
    }))
    setSelectedComponentId(copied.instanceId)
    return true
  }

  const handleReset = () => replaceDesign(defaultHLGDesign(hull))
  const handleSave = () => { saveDesign(design); showToast('自由配置設計を保存しました') }
  const handleLoad = () => { replaceDesign(loadDesignerState(hull).design); showToast('自由配置設計を読み込みました') }

  const handleDeploy = () => {
    if (!onConfirm) return
    const latestStats = calcStats(design, hull)
    if (!latestStats.canDeploy) {
      showToast(latestStats.warnings[0] ?? '設計を確認してください')
      return
    }
    saveDesign(design)
    onConfirm({
      templateId: hull.templateId,
      shipType: hull.shipType,
      loadout: designToLoadout(design, hull),
      armorBonus: design.armorPlan.belt,
      hlgDesign: cloneHLGDesign(design),
      towerMount: designTowerMount(hull, design),
    })
  }

  if (step === 'ship-select') {
    return (
      <div className="sd-root">
        <header className="sd-header">
          <div className="sd-header-title">艦船設計システム 自由配置</div>
          {onClose && <button className="sd-btn sd-btn-back" onClick={onClose}>タイトルへ</button>}
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

  return (
    <div className="sd-root">
      <header className="sd-header">
        <div className="sd-header-title">艦船設計システム 自由配置</div>
        <div className="sd-header-actions">
          <button className="sd-btn" onClick={handleSave}>保存</button>
          <button className="sd-btn" onClick={handleLoad}>読込</button>
          <button className="sd-btn sd-btn-auto" onClick={handleReset}>標準配置</button>
          <button className="sd-btn sd-btn-back" onClick={() => setStep('ship-select')}>艦種変更</button>
          {onConfirm && <button className="sd-btn sd-btn-deploy" onClick={handleDeploy}>出撃</button>}
        </div>
      </header>

      <div className="sd-body">
        <aside className="sd-panel sd-panel-left">
          <div className="sd-palette-title">配置パーツ</div>
          <div className="sd-hlg-filter">
            {(Object.keys(CATEGORY_LABEL) as Array<HLGComponentCategory | 'all'>).map(category => (
              <button key={category} className={`sd-hlg-chip${partFilter === category ? ' sd-hlg-chip--active' : ''}`} onClick={() => setPartFilter(category)}>
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
          <div className="sd-hlg-part-list">
            {visibleParts.map(part => (
              <button
                key={part.partId}
                className={`sd-hlg-part${selectedPartId === part.partId ? ' sd-hlg-part--active' : ''}`}
                onClick={() => setSelectedPartId(part.partId)}
              >
                <span className="sd-hlg-part-kind">{CATEGORY_LABEL[part.category]}</span>
                <span className="sd-hlg-part-name">{part.name}</span>
                <span className="sd-hlg-part-meta">{part.footprint.w}x{part.footprint.h} / {part.weight}t</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="sd-center">
          {hulls.length > 1 && (
            <div className="sd-hull-tabs">
              {hulls.map((item, index) => (
                <button key={item.templateId} className={`sd-hull-tab${index === hullIdx ? ' sd-hull-tab--active' : ''}`} onClick={() => handleSelectHull(index)}>
                  {item.name}
                </button>
              ))}
            </div>
          )}

          <div className="sd-hlg-stage">
            <Ship3DPreview hull={hull} design={design} armorBonus={design.armorPlan.belt} />
            <HLGGrid
              hull={hull}
              design={design}
              selectedPart={selectedPart}
              selectedComponentId={selectedComponentId}
              onCellClick={handleGridClick}
              onSelectComponent={setSelectedComponentId}
              onMoveComponent={handleMoveComponent}
              onCopyComponent={handleCopyComponent}
              onDeleteComponent={handleDeleteComponent}
            />
          </div>
          <div className="sd-hull-hint">パーツを選び配置。ドラッグで移動、Ctrl+ドラッグでコピー、船体外へドロップで削除。</div>
        </main>

        <aside className="sd-panel sd-panel-right">
          <WeightGauge totalWeight={stats.totalWeight} maxWeight={stats.maxWeight} />
          <HLGStatsPanel stats={stats} selectedComponent={selectedComponent} onRotate={handleRotate} onDelete={handleDelete} onNudge={handleNudge} />
          <div className="sd-section-title" style={{ marginTop: 16 }}>設計情報</div>
          <div className="sd-hlg-info">
            <div>船体: {hull.name}</div>
            <div>格子: {spec.cols} x {spec.rows}</div>
            <div>配置: {design.components.length} パーツ</div>
            <div>選択: {selectedPart?.name ?? 'なし'}</div>
          </div>
        </aside>
      </div>

      <div id="sd-toast" className="sd-toast" aria-live="polite" />
    </div>
  )
}

function HLGGrid({
  hull,
  design,
  selectedPart,
  selectedComponentId,
  onCellClick,
  onSelectComponent,
  onMoveComponent,
  onCopyComponent,
  onDeleteComponent,
}: {
  hull: ReturnType<typeof getHullsByClass>[number]
  design: HLGDesign
  selectedPart?: HLGPartDefinition
  selectedComponentId: string | null
  onCellClick: (cell: HLGCell) => void
  onSelectComponent: (id: string) => void
  onMoveComponent: (id: string, cell: HLGCell) => boolean
  onCopyComponent: (id: string, cell: HLGCell) => boolean
  onDeleteComponent: (id: string) => void
}) {
  const spec = hlgGridSpec(hull)
  const gridRef = useRef<HTMLDivElement | null>(null)
  type DragState = { id: string; offsetC: number; offsetR: number; cell: HLGCell; valid: boolean; moved: boolean; copying: boolean; deleteCandidate: boolean }
  const dragRef = useRef<DragState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ctrlCopyMode, setCtrlCopyMode] = useState(false)

  const setDragState = (next: typeof drag) => {
    dragRef.current = next
    setDrag(next)
  }

  useEffect(() => {
    const handleBlur = () => setCtrlCopyMode(false)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlCopyMode(true)
        if (dragRef.current) setDragState({ ...dragRef.current, copying: true })
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlCopyMode(false)
        if (dragRef.current) {
          const current = dragRef.current
          setDragState({ ...current, copying: false, valid: !current.deleteCandidate && dragCellIsValid(current.id, current.cell) })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const cellFromPointer = (event: ReactPointerEvent): { cell: HLGCell; outOfBounds: boolean } | null => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const r = Math.floor(((event.clientX - rect.left) / rect.width) * spec.rows)
    const c = Math.floor(((event.clientY - rect.top) / rect.height) * spec.cols)
    if (!Number.isFinite(c) || !Number.isFinite(r)) return null
    const outOfBounds = c < 0 || c >= spec.cols || r < 0 || r >= spec.rows
    return {
      cell: {
        c: clamp(c, 0, spec.cols - 1),
        r: clamp(r, 0, spec.rows - 1),
      },
      outOfBounds,
    }
  }

  const dragCellIsValid = (instanceId: string, cell: HLGCell): boolean => {
    const component = design.components.find(item => item.instanceId === instanceId)
    const part = component ? HLG_PART_BY_ID[component.partId] : undefined
    if (!component || !part) return false
    const without = { ...design, components: design.components.filter(item => item.instanceId !== instanceId) }
    return canPlaceHLGPart(hull, without, part, cell, component.rotation)
  }

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, component: HLGComponentInstance) => {
    const pointerCell = cellFromPointer(event)
    if (!pointerCell) return
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
    onSelectComponent(component.instanceId)
    setDragState({
      id: component.instanceId,
      offsetC: component.cell.c - pointerCell.cell.c,
      offsetR: component.cell.r - pointerCell.cell.r,
      cell: component.cell,
      valid: true,
      moved: false,
      copying: event.ctrlKey || ctrlCopyMode,
      deleteCandidate: false,
    })
  }

  const updateDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current) return
    const pointerCell = cellFromPointer(event)
    if (!pointerCell) return
    const cell = {
      c: clamp(pointerCell.cell.c + current.offsetC, 0, spec.cols - 1),
      r: clamp(pointerCell.cell.r + current.offsetR, 0, spec.rows - 1),
    }
    const deleteCandidate = pointerCell.outOfBounds || !hlgCellIsInsideHull(hull, cell)
    setDragState({
      ...current,
      cell,
      valid: !deleteCandidate && dragCellIsValid(current.id, cell),
      moved: current.moved || cell.c !== current.cell.c || cell.r !== current.cell.r,
      copying: event.ctrlKey || ctrlCopyMode,
      deleteCandidate,
    })
  }

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
    if (current.deleteCandidate && current.moved && !current.copying) {
      onDeleteComponent(current.id)
    } else if (current.valid && current.moved) {
      if (current.copying) onCopyComponent(current.id, current.cell)
      else onMoveComponent(current.id, current.cell)
    }
    setDragState(null)
  }

  const cells = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const cell = { c, r }
      const inside = hlgCellIsInsideHull(hull, cell)
      const zones = hlgCellZones(hull, cell)
      const canPlace = inside && selectedPart ? canPlaceHLGPart(hull, design, selectedPart, cell, 0) : false
      const edgeClass = inside ? [
        !hlgCellIsInsideHull(hull, { c, r: r - 1 }) ? ' sd-hlg-cell--edge-fore' : '',
        !hlgCellIsInsideHull(hull, { c, r: r + 1 }) ? ' sd-hlg-cell--edge-aft' : '',
        !hlgCellIsInsideHull(hull, { c: c - 1, r }) ? ' sd-hlg-cell--edge-port' : '',
        !hlgCellIsInsideHull(hull, { c: c + 1, r }) ? ' sd-hlg-cell--edge-starboard' : '',
      ].join('') : ''
      cells.push(
        <button
          key={`${c},${r}`}
          className={`sd-hlg-cell${inside ? ' sd-hlg-cell--inside' : ''}${zones.includes('side') ? ' sd-hlg-cell--side' : ''}${canPlace ? ' sd-hlg-cell--valid' : ''}${edgeClass}`}
          style={{ gridColumn: r + 1, gridRow: c + 1 }}
          onClick={() => onCellClick(cell)}
          type="button"
          aria-label={`${c},${r}`}
        />,
      )
    }
  }

  return (
    <div className="sd-hlg-grid-wrap">
      <div
        ref={gridRef}
        className="sd-hlg-grid"
        style={{
          gridTemplateColumns: `repeat(${spec.rows}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${spec.cols}, minmax(0, 1fr))`,
          aspectRatio: `${spec.rows} / ${spec.cols}`,
        }}
      >
        {cells}
        <div
          className="sd-hlg-centerline"
          style={{ gridColumn: `1 / span ${spec.rows}`, gridRow: `${spec.centerC + 1}` }}
        />
        {design.components.map(component => {
          const part = HLG_PART_BY_ID[component.partId]
          if (!part) return null
          const footprint = rotateFootprint(part.footprint, component.rotation)
          const displayedComponent = drag?.id === component.instanceId && !drag.copying ? { ...component, cell: drag.cell } : component
          const rect = componentRect(displayedComponent, part)
          return (
            <button
              key={component.instanceId}
              className={`sd-hlg-component sd-hlg-component--${component.category}${selectedComponentId === component.instanceId ? ' sd-hlg-component--selected' : ''}${drag?.id === component.instanceId ? ' sd-hlg-component--dragging' : ''}${drag?.id === component.instanceId && drag.copying ? ' sd-hlg-component--copying' : ''}${drag?.id === component.instanceId && drag.deleteCandidate ? ' sd-hlg-component--delete' : ''}${drag?.id === component.instanceId && !drag.valid && !drag.deleteCandidate ? ' sd-hlg-component--invalid' : ''}`}
              style={{
                gridColumn: `${Math.floor(rect.top) + 1} / span ${Math.ceil(footprint.h)}`,
                gridRow: `${Math.floor(rect.left) + 1} / span ${Math.ceil(footprint.w)}`,
              }}
              onPointerDown={(event) => beginDrag(event, component)}
              onPointerMove={updateDrag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onClick={(event) => {
                event.stopPropagation()
                onSelectComponent(component.instanceId)
              }}
              type="button"
            >
              <span>{shortPartName(part)}</span>
            </button>
          )
        })}
        {drag?.copying && (() => {
          const source = design.components.find(component => component.instanceId === drag.id)
          const part = source ? HLG_PART_BY_ID[source.partId] : undefined
          if (!source || !part) return null
          const footprint = rotateFootprint(part.footprint, source.rotation)
          const rect = componentRect({ ...source, cell: drag.cell }, part)
          return (
            <div
              className={`sd-hlg-copy-ghost sd-hlg-component--${source.category}${drag.deleteCandidate ? ' sd-hlg-copy-ghost--delete' : ''}${!drag.valid && !drag.deleteCandidate ? ' sd-hlg-copy-ghost--invalid' : ''}`}
              style={{
                gridColumn: `${Math.floor(rect.top) + 1} / span ${Math.ceil(footprint.h)}`,
                gridRow: `${Math.floor(rect.left) + 1} / span ${Math.ceil(footprint.w)}`,
              }}
            >
              <span>コピー</span>
            </div>
          )
        })()}
        {(ctrlCopyMode || drag?.copying) && <div className="sd-hlg-copy-mode">COPY MODE</div>}
      </div>
    </div>
  )
}

function HLGStatsPanel({
  stats,
  selectedComponent,
  onRotate,
  onDelete,
  onNudge,
}: {
  stats: ReturnType<typeof calcStats>
  selectedComponent: HLGComponentInstance | null
  onRotate: () => void
  onDelete: () => void
  onNudge: (dc: number, dr: number) => void
}) {
  const selectedPart = selectedComponent ? HLG_PART_BY_ID[selectedComponent.partId] : null
  return (
    <div className="sd-stats">
      <div className="sd-section-title">性能パラメータ</div>
      <div className="sd-stats-grid">
        <StatRow label="総火力" value={stats.totalFirepower.toFixed(0)} color="#f97316" />
        <StatRow label="対空力" value={stats.totalAntiAir.toFixed(0)} color="#4ade80" />
        <StatRow label="平均命中" value={`${(stats.avgAccuracy * 100).toFixed(1)}%`} color="#38bdf8" />
        <StatRow label="推定速力" value={`${stats.speed.toFixed(1)} kt`} color="#a78bfa" />
        <StatRow label="旋回性能" value={stats.turnRate.toFixed(1)} color="#fb923c" />
        <StatRow label="機関出力" value={`${stats.powerProvided}/${stats.powerRequired}`} color="#22c55e" />
        <StatRow label="排煙能力" value={`${stats.smokeProvided}/${stats.smokeRequired}`} color="#eab308" />
      </div>

      <div className="sd-section-title" style={{ marginTop: 16 }}>選択パーツ</div>
      {selectedPart ? (
        <div className="sd-hlg-selected">
          <strong>{selectedPart.name}</strong>
          <span>{CATEGORY_LABEL[selectedPart.category]} / {selectedPart.weight}t</span>
          <div className="sd-hlg-nudge" aria-label="微調整">
            <span />
            <button className="sd-btn sd-hlg-nudge-btn" onClick={() => onNudge(0, -1)}>前</button>
            <span />
            <button className="sd-btn sd-hlg-nudge-btn" onClick={() => onNudge(-1, 0)}>左舷</button>
            <button className="sd-btn sd-hlg-nudge-btn" onClick={() => onNudge(0, 1)}>後</button>
            <button className="sd-btn sd-hlg-nudge-btn" onClick={() => onNudge(1, 0)}>右舷</button>
          </div>
          <div className="sd-hlg-selected-actions">
            <button className="sd-btn" onClick={onRotate}>回転</button>
            <button className="sd-btn sd-btn-danger" onClick={onDelete}>削除</button>
          </div>
        </div>
      ) : (
        <div className="sd-stats-empty">パーツ未選択</div>
      )}

      <div className="sd-section-title" style={{ marginTop: 16 }}>検証</div>
      {stats.warnings.length === 0 ? (
        <div className="sd-hlg-ok">出撃可能</div>
      ) : (
        <ul className="sd-hlg-warnings">
          {stats.warnings.slice(0, 8).map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="sd-stat-row">
      <span className="sd-stat-label">{label}</span>
      <span className="sd-stat-value" style={{ color }}>{value}</span>
    </div>
  )
}

function componentAtCell(design: HLGDesign, cell: HLGCell): HLGComponentInstance | null {
  return design.components.find(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part) return false
    const rect = componentRect(component, part)
    return cell.c >= Math.floor(rect.left) && cell.c < Math.ceil(rect.left + rect.w) && cell.r >= Math.floor(rect.top) && cell.r < Math.ceil(rect.top + rect.h)
  }) ?? null
}

function nextRotation(rotation: HLGRotation): HLGRotation {
  return rotation === 0 ? 90 : rotation === 90 ? 180 : rotation === 180 ? 270 : 0
}

function defaultSelectedPart(shipType: PlayerShipType): string {
  return shipType === 'battleship' ? 'part.weapon.weapon.gun.406mm.twin' : shipType === 'cruiser' ? 'part.weapon.weapon.gun.203mm' : 'part.weapon.weapon.gun.127mm.twin'
}

function shortPartName(part: HLGPartDefinition): string {
  if (part.category === 'bridge') return '艦橋'
  if (part.category === 'funnel') return '煙'
  if (part.category === 'boiler') return '缶'
  if (part.category === 'turbine') return '機'
  if (part.category === 'aux') return '補'
  if (part.category === 'armor') return '装'
  if (part.type === 'gun') return '砲'
  if (part.type === 'torpedo') return '雷'
  if (part.type === 'aa') return '対'
  if (part.type === 'missile') return '誘'
  return '兵'
}

function showToast(msg: string) {
  const el = document.getElementById('sd-toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('sd-toast--visible')
  setTimeout(() => el.classList.remove('sd-toast--visible'), 2000)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
