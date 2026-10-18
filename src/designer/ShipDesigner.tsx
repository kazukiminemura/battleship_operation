import { previewDesignMove, COPY_PREVIEW_ID, type ComponentMovePreview } from './design-preview'
import { HullPlanOutline } from './HullPlanOutline'
import { PartPlanDrawing } from './PartDrawing'
import { GUN_MOUNT_HEIGHTS, isGunMount, normalizedMountHeight } from '../game/data/gun-mount-geometry'
import { barrelsInterfere, gunClearance } from './gun-clearance'
import { GunBarrelOverlay } from './GunBarrelOverlay'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Ship3DPreview } from './Ship3DPreview'
import { WeightGauge } from './WeightGauge'
import { ShipBlueprint, PartSymbol } from './ShipBlueprint'
import { useDesignHistory } from './design-history'
import { designerLayerForPart, makePlacementComponents, mirroredPlacementCell } from './design-placement'
import {
  calcStats,
  createDesignForHull,
  createDesignFromPrepResult,
  DESIGN_SAVE_SLOTS,
  type DesignSaveSlot,
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
  ARMOR_DEFENSE_OPTIONS,
  canPlaceHLGPart,
  cloneHLGDesign,
  componentRect,
  defaultHLGDesign,
  findNearestValidCell,
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
  type ArmorDefenseKey,
} from './hlg-system'
import type { PlayerShipType } from '../game/data/masterdata'
import type { HullCatalogEntry } from '../game/data/hull-catalog'
import { MAX_WEAPON_SLOTS } from '../game/simulation/types'
import type { PrepResult } from './types'
import { firingArcForWeapon, firingArcLabel, type FiringArc } from '../game/simulation/firing-arcs'
import './ShipDesigner.css'
import './ShipWorkbench.css'
import './CompactWorkbench.css'

interface Props {
  onClose?: () => void
  onConfirm?: (result: PrepResult) => void
  initialResult?: PrepResult | null
}

type Step = 'ship-select' | 'design'
type PaletteDragState = { partId: string; x: number; y: number }
type PaletteDropState = PaletteDragState & { id: number }

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

type Workshop = 'weapon' | 'engine' | 'equipment' | 'armor' | 'all'
const WORKSHOP_CATEGORIES: Record<Workshop, HLGComponentCategory[]> = {
  weapon: ['weapon'], engine: ['boiler', 'turbine', 'funnel'], equipment: ['bridge', 'aux'], armor: ['armor'],
  all: ['weapon', 'bridge', 'funnel', 'boiler', 'turbine', 'aux', 'armor'],
}

const WEAPON_TYPE_LABEL: Record<NonNullable<HLGPartDefinition['type']>, string> = {
  gun: '主砲',
  secondary: '副砲・速射砲',
  torpedo: '魚雷',
  aa: '対空兵装',
  missile: 'ミサイル・噴進砲',
}

function partSystemMeta(part: HLGPartDefinition): string {
  const notes: string[] = []
  if (part.provides?.power) {
    notes.push(part.category === 'turbine' ? `推進 +${part.provides.power}` : `出力 +${part.provides.power}`)
  }
  if (part.requires?.power) notes.push(`出力要求 ${part.requires.power}`)
  if (part.provides?.smokeExhaust) notes.push(`排煙 +${part.provides.smokeExhaust}`)
  if (part.requires?.funnelCapacity) notes.push(`排煙要求 ${part.requires.funnelCapacity}`)
  return notes.length ? ` / ${notes.join(' / ')}` : ''
}

export function ShipDesigner({ onClose, onConfirm, initialResult = null }: Props) {
  const initialShipType = initialResult?.shipType ?? 'battleship'
  const initialHulls = getHullsByClass(initialShipType)
  const initialHull = initialHulls[hullIndexForTemplate(initialShipType, initialResult?.templateId ?? initialHulls[0]!.templateId)] ?? initialHulls[0]!
  const initialDesign = createDesignFromPrepResult(initialResult) ?? loadDesignerState(initialHull).design

  const [step, setStep] = useState<Step>(() => initialResult ? 'design' : 'ship-select')
  const [shipType, setShipType] = useState<PlayerShipType>(initialShipType)
  const [hullIdx, setHullIdx] = useState(() => hullIndexForTemplate(initialShipType, initialHull.templateId))
  const { design, setDesign, resetDesign, undo, redo, canUndo, canRedo } = useDesignHistory(createDesignForHull(initialHull, initialDesign))
  const [workshop, setWorkshop] = useState<Workshop>('weapon')
  const [sideTab, setSideTab] = useState<'parts' | 'loadout' | 'stats' | 'armor'>('parts')
  const [partSearch, setPartSearch] = useState('')
  const [movePreview, setMovePreview] = useState<ComponentMovePreview | null>(null)
  const [drawingView, setDrawingView] = useState<'plan' | 'dock'>('plan')
  const [layer, setLayer] = useState<'deck' | 'internal'>('deck')
  const [mirrorPlacement, setMirrorPlacement] = useState(true)
  const [placementHeight, setPlacementHeight] = useState(0)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(() => defaultSelectedPart(initialHull.shipType))
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState<number | null>(null)
  const [partFilter, setPartFilter] = useState<HLGComponentCategory | 'all'>('all')
  const [collapsedPaletteGroups, setCollapsedPaletteGroups] = useState<Set<string>>(() => new Set())
  const [draggingPartId, setDraggingPartId] = useState<string | null>(null)
  const [paletteDrag, setPaletteDrag] = useState<PaletteDragState | null>(null)
  const [paletteDrop, setPaletteDrop] = useState<PaletteDropState | null>(null)
  const paletteDragRef = useRef<PaletteDragState | null>(null)
  const paletteDropIdRef = useRef(0)
  const [saveSlot, setSaveSlot] = useState<DesignSaveSlot>(1)

  const hulls = getHullsByClass(shipType)
  const hull = hulls[hullIdx] ?? hulls[0]!
  const spec = useMemo(() => hlgGridSpec(hull), [hull])
  const drawingDesign = useMemo(() => previewDesignMove(design, movePreview), [design, movePreview])
  const stats = useMemo(() => calcStats(design, hull), [design, hull])
  const visibleParts = useMemo(
    () => HLG_PARTS.filter(part => part.allowedShipClasses.includes(shipType) && (partFilter === 'all' || part.category === partFilter) &&
      WORKSHOP_CATEGORIES[workshop].includes(part.category) && part.name.toLocaleLowerCase().includes(partSearch.trim().toLocaleLowerCase())),
    [partFilter, shipType, workshop, partSearch],
  )
  const paletteGroups = useMemo(() => groupPaletteParts(visibleParts), [visibleParts])
  const selectedPart = selectedPartId ? HLG_PART_BY_ID[selectedPartId] : undefined
  const placementPart = draggingPartId ? HLG_PART_BY_ID[draggingPartId] ?? selectedPart : selectedPart
  const selectedComponent = design.components.find(component => component.instanceId === selectedComponentId) ?? null
  const selectedPlacementSlot = selectedPart?.type ? selectedWeaponSlot : null
  const togglePaletteGroup = (label: string) => {
    setCollapsedPaletteGroups(current => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  useEffect(() => {
    paletteDragRef.current = paletteDrag
  }, [paletteDrag])

  useEffect(() => {
    if (!paletteDrag) return
    const handlePointerMove = (event: PointerEvent) => {
      setPaletteDrag(current => current ? { ...current, x: event.clientX, y: event.clientY } : null)
    }
    const finishPaletteDrag = (event: PointerEvent) => {
      const current = paletteDragRef.current
      if (current) {
        setPaletteDrop({ partId: current.partId, x: event.clientX, y: event.clientY, id: ++paletteDropIdRef.current })
      }
      setPaletteDrag(null)
      setDraggingPartId(null)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishPaletteDrag, { once: true })
    window.addEventListener('pointercancel', finishPaletteDrag, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishPaletteDrag)
      window.removeEventListener('pointercancel', finishPaletteDrag)
    }
  }, [paletteDrag])

  const selectComponent = (instanceId: string | null) => {
    setSelectedComponentId(instanceId)
    setSelectedPartId(null)
    const component = instanceId ? design.components.find(item => item.instanceId === instanceId) : null
    if (!component) return
    const part = HLG_PART_BY_ID[component.partId]
    if (part) setLayer(designerLayerForPart(part))
    if (part?.type && component.weaponSlot != null) setSelectedWeaponSlot(component.weaponSlot)
  }

  const replaceDesign = useCallback((next: HLGDesign, clearHistory = false) => {
    setMovePreview(null)
    if (clearHistory) resetDesign(next)
    else setDesign(cloneHLGDesign(next))
    setSelectedComponentId(null)
    setSelectedWeaponSlot(null)
  }, [resetDesign, setDesign])

  const handleSelectShip = (type: PlayerShipType) => {
    const nextHull = getHullsByClass(type)[0]!
    setShipType(type)
    setHullIdx(0)
    replaceDesign(loadDesignerState(nextHull, saveSlot).design, true)
    setSelectedPartId(defaultSelectedPart(type))
    setLayer('deck')
    setWorkshop('weapon')
    setSideTab('parts')
    setStep('design')
  }

  const handleSelectHull = (index: number) => {
    const nextHull = hulls[index]!
    setHullIdx(index)
    replaceDesign(loadDesignerState(nextHull, saveSlot).design, true)
    setSelectedPartId(defaultSelectedPart(nextHull.shipType))
    setLayer('deck')
    setWorkshop('weapon')
    setSideTab('parts')
  }

  const handleGridClick = (cell: HLGCell) => {
    if (!selectedPart) {
      selectComponent(componentAtCell(design, cell, undefined, layer)?.instanceId ?? null)
      return
    }
    const rotation: HLGRotation = 0
    const weaponSlot = resolveWeaponSlotForPart(selectedPart)
    if (weaponSlot === null) return
    if (!canPlaceHLGPart(hull, design, selectedPart, cell, rotation, weaponSlot, placementHeight)) {
      const existing = componentAtCell(design, cell)
      if (existing) {
        selectComponent(existing.instanceId)
        return
      }
      showToast('配置不可：船体区画・重量・装備や砲身の干渉を確認してください')
      return
    }
    const components = makePlacementComponents(hull, design, selectedPart, cell, rotation, weaponSlot, mirrorPlacement, placementHeight)
    const component = components[0]
    if (!component) return
    setDesign(prev => ({
      ...prev,
      components: [...prev.components, ...components],
    }))
    setSelectedComponentId(component.instanceId)
    if (weaponSlot != null) setSelectedWeaponSlot(weaponSlot)
  }

  const handlePlacePart = (partId: string, cell: HLGCell): boolean => {
    const part = HLG_PART_BY_ID[partId]
    if (!part) return false
    setSelectedPartId(part.partId)
    setLayer(designerLayerForPart(part))
    const rotation: HLGRotation = 0
    const weaponSlot = resolveWeaponSlotForPart(part)
    if (weaponSlot === null) return false
    if (!canPlaceHLGPart(hull, design, part, cell, rotation, weaponSlot, placementHeight)) {
      showToast('配置不可：船体区画・重量・装備や砲身の干渉を確認してください')
      return false
    }
    const components = makePlacementComponents(hull, design, part, cell, rotation, weaponSlot, mirrorPlacement, placementHeight)
    const component = components[0]
    if (!component) return false
    setDesign(prev => ({
      ...prev,
      components: [...prev.components, ...components],
    }))
    setSelectedComponentId(component.instanceId)
    if (weaponSlot != null) setSelectedWeaponSlot(weaponSlot)
    return true
  }

  const resolveWeaponSlotForPart = (part: HLGPartDefinition): number | undefined | null => {
    if (!part.type) return undefined
    const slots = weaponSlotItems(design)
    if (selectedWeaponSlot != null) {
      const slot = slots[selectedWeaponSlot]
      if (!slot) return null
      if (slot.part && slot.part.partId !== part.partId) {
        showToast(`スロット${selectedWeaponSlot + 1}は${slot.part.name}用です`)
        return null
      }
      return selectedWeaponSlot
    }
    const sameSlot = slots.find(slot => slot.part?.partId === part.partId)
    if (sameSlot) return sameSlot.slot
    const emptySlot = slots.find(slot => !slot.part)
    if (!emptySlot) {
      showToast(`兵装スロットは${MAX_WEAPON_SLOTS}枠までです`)
      return null
    }
    return emptySlot.slot
  }

  const handlePartPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, part: HLGPartDefinition) => {
    if (event.button !== 0) return
    event.preventDefault()
    setSelectedPartId(part.partId)
    setSelectedComponentId(null)
    setLayer(designerLayerForPart(part))
    setDraggingPartId(part.partId)
    setPaletteDrop(null)
    setPaletteDrag({ partId: part.partId, x: event.clientX, y: event.clientY })
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
      if (!canPlaceHLGPart(hull, without, part, component.cell, rotation, component.weaponSlot, component.mountHeight, component.barrels)) {
        showToast('回転後の配置が不正です')
        return prev
      }
      next.components[index] = { ...component, rotation }
      return next
    })
  }

  const handleHeightChange = (value: number) => {
    if (!selectedComponent) return
    const part = HLG_PART_BY_ID[selectedComponent.partId]
    if (!part?.type || !isGunMount(part.type)) return
    const raised = { ...selectedComponent, mountHeight: normalizedMountHeight(value) }
    const clearance = gunClearance(raised, part)
    const blocked = design.components.some(other => {
      const otherPart = HLG_PART_BY_ID[other.partId]
      return other.instanceId !== raised.instanceId && otherPart && barrelsInterfere(clearance, gunClearance(other, otherPart))
    })
    if (blocked) { showToast('砲身が干渉するため、この高さには変更できません'); return }
    setDesign(prev => ({ ...prev, components: prev.components.map(item => item.instanceId === raised.instanceId ? raised : item) }))
  }

  const handleDelete = () => {
    if (!selectedComponent) return
    setDesign(prev => ({ ...prev, components: prev.components.filter(component => component.instanceId !== selectedComponent.instanceId) }))
    selectComponent(null)
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
      if (!canPlaceHLGPart(hull, without, part, moved.cell, moved.rotation, component.weaponSlot, component.mountHeight, component.barrels)) {
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
    if (!canPlaceHLGPart(hull, without, part, cell, component.rotation, component.weaponSlot, component.mountHeight, component.barrels)) return false
    setDesign(prev => ({
      ...prev,
      components: prev.components.map(item => item.instanceId === instanceId ? { ...item, cell } : item),
    }))
    selectComponent(instanceId)
    return true
  }

  const handleCopyComponent = (instanceId: string, cell: HLGCell): boolean => {
    const component = design.components.find(item => item.instanceId === instanceId)
    const part = component ? HLG_PART_BY_ID[component.partId] : undefined
    if (!component || !part) return false
    if (!canPlaceHLGPart(hull, design, part, cell, component.rotation, component.weaponSlot, component.mountHeight, component.barrels)) return false
    const copied = { ...makeComponent(part, cell, component.rotation, component.weaponSlot), barrels: component.barrels, mountHeight: component.mountHeight }
    setDesign(prev => ({
      ...prev,
      components: [...prev.components, copied],
    }))
    setSelectedComponentId(copied.instanceId)
    return true
  }

  const handleAddGroupedPart = (slotIndex: number) => {
    const slot = weaponSlotItems(design)[slotIndex]
    const partId = slot?.part?.partId
    if (!partId) return
    const part = HLG_PART_BY_ID[partId]
    if (!part) return
    const existing = design.components.filter(component => component.weaponSlot === slotIndex)
    const preferred = preferredCellForGroupedPart(hull, part, existing.at(-1))
    const rotation = existing.at(-1)?.rotation ?? 0
    const height = isGunMount(part.type) ? existing.at(-1)?.mountHeight ?? placementHeight : 0
    const cell = findNearestValidCell(hull, design, part, preferred, rotation, slotIndex, height)
    if (!cell) {
      showToast('追加できる空き位置がありません')
      return
    }
    const component = { ...makeComponent(part, cell, rotation, slotIndex), mountHeight: height }
    setDesign(prev => ({ ...prev, components: [...prev.components, component] }))
    setSelectedPartId(part.partId)
    setSelectedWeaponSlot(slotIndex)
    setSelectedComponentId(component.instanceId)
  }

  const handleRemoveGroupedPart = (slotIndex: number) => {
    const target = [...design.components].reverse().find(component => component.weaponSlot === slotIndex)
    if (!target) return
    setDesign(prev => ({ ...prev, components: prev.components.filter(component => component.instanceId !== target.instanceId) }))
    setSelectedComponentId(current => current === target.instanceId ? null : current)
  }

  const handleSelectGroupedPart = (slotIndex: number) => {
    const target = [...design.components].reverse().find(component => component.weaponSlot === slotIndex)
    const part = target ? HLG_PART_BY_ID[target.partId] : null
    setSelectedWeaponSlot(slotIndex)
    setLayer('deck')
    setSelectedPartId(part?.partId ?? null)
    setSelectedComponentId(target?.instanceId ?? null)
  }

  const handleSelectWeaponSlot = (slotIndex: number) => {
    const slot = weaponSlotItems(design)[slotIndex]
    setSelectedWeaponSlot(slotIndex)
    setLayer('deck')
    setSelectedPartId(slot?.part?.partId ?? null)
    setSelectedComponentId(slot?.components.at(-1)?.instanceId ?? null)
  }

  const handleReset = () => replaceDesign(defaultHLGDesign(hull))
  const handleArmorChange = (field: 'belt' | 'deck', value: ArmorDefenseKey) => {
    setDesign(prev => ({ ...prev, armorPlan: { ...prev.armorPlan, [field]: value } }))
  }
  const handleResetWeapons = () => {
    const weaponIds = new Set(HLG_PARTS.filter(part => part.type).map(part => part.partId))
    setDesign(prev => ({
      ...prev,
      components: prev.components.filter(component => !weaponIds.has(component.partId)),
    }))
    setSelectedComponentId(null)
    setSelectedPartId(null)
    setSelectedWeaponSlot(null)
    showToast('兵装をすべてリセットしました')
  }
  const handleSave = () => { saveDesign(design, saveSlot); showToast(`自由配置設計を保存しました: ${saveSlot}`) }
  const handleLoad = () => { replaceDesign(loadDesignerState(hull, saveSlot).design); showToast(`自由配置設計を読み込みました: ${saveSlot}`) }

  const handleDeploy = useCallback(() => {
    if (!onConfirm) return
    const latestStats = calcStats(design, hull)
    if (!latestStats.canDeploy) {
      showToast(latestStats.warnings[0] ?? '設計を確認してください')
      return
    }
    saveDesign(design, saveSlot)
    onConfirm({
      templateId: hull.templateId,
      shipType: hull.shipType,
      loadout: designToLoadout(design, hull),
      armorBonus: latestStats.armorDefense,
      hlgDesign: cloneHLGDesign(design),
      towerMount: designTowerMount(hull, design),
    })
  }, [design, hull, onConfirm, saveSlot])

  useEffect(() => {
    if (step !== 'design') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTextEntryTarget(event.target)) return
      if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyZ' || event.code === 'KeyY')) {
        event.preventDefault()
        if (event.code === 'KeyY' || event.shiftKey) redo()
        else undo()
        return
      }
      if (event.code === 'Escape') {
        event.preventDefault()
        setSelectedComponentId(null)
        setSelectedPartId(null)
        return
      }
      if (!onConfirm || event.code !== 'Space') return
      event.preventDefault()
      handleDeploy()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDeploy, onConfirm, step, undo, redo])

  if (step === 'ship-select') {
    return (
      <div className="sd-root">
        <header className="sd-header">
          <div className="sd-header-title">艦船設計局</div>
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
    <div className="sd-root sd-root--design">
      <header className="sd-header">
        <div className="sd-header-title">艦船設計局</div>
        <div className="sd-header-actions">
          <div className="sd-save-slots" aria-label="保存スロット">
            {DESIGN_SAVE_SLOTS.map(slot => (
              <button
                key={slot}
                className={`sd-save-slot${saveSlot === slot ? ' sd-save-slot--active' : ''}`}
                onClick={() => setSaveSlot(slot)}
                type="button"
              >
                {slot}
              </button>
            ))}
          </div>
          <button className="sd-btn" onClick={handleSave}>保存</button>
          <button className="sd-btn" onClick={handleLoad}>読込</button>
          <details className="sd-design-menu"><summary className="sd-btn">操作 ▾</summary><div>
            <button className="sd-btn sd-btn-danger" onClick={handleResetWeapons}>兵装リセット</button>
            <button className="sd-btn sd-btn-auto" onClick={handleReset}>標準配置に戻す</button>
            <button className="sd-btn sd-btn-back" onClick={() => setStep('ship-select')}>艦種を変更</button>
          </div></details>
          {onConfirm && <button className="sd-btn sd-btn-deploy" onClick={handleDeploy}>出撃</button>}
        </div>
      </header>

      <nav className="sd-workshop-nav" aria-label="設計区分">
        {([['weapon', '兵装'], ['engine', '機関'], ['equipment', '設備'], ['armor', '防御'], ['all', '全部品']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={workshop === key} className={workshop === key ? 'is-active' : ''} onClick={() => { setWorkshop(key); setPartFilter('all'); setPartSearch(''); setSideTab(key === 'armor' ? 'armor' : 'parts'); setSelectedPartId(null); setSelectedComponentId(null); setLayer(key === 'engine' ? 'internal' : 'deck') }}>{label}</button>
        ))}
        <span className="sd-workshop-nav-spacer" />
        <button type="button" onClick={undo} disabled={!canUndo}>↶ 取り消し</button>
        <button type="button" onClick={redo} disabled={!canRedo}>↷ やり直し</button>
      </nav>
      <div className="sd-body sd-workbench">

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

          <div className="sd-drawing-toolbar">
            <div role="group" aria-label="表示切替">
              <button type="button" aria-pressed={drawingView === 'plan'} onClick={() => setDrawingView('plan')}>配置図</button>
              <button type="button" aria-pressed={drawingView === 'dock'} onClick={() => setDrawingView('dock')}>3Dドック</button>
            </div>
            <div role="group" aria-label="配置レイヤー">
              <button type="button" aria-pressed={layer === 'deck'} onClick={() => { setLayer('deck'); setSelectedPartId(null); setSelectedComponentId(null) }}>上部構造</button>
              <button type="button" aria-pressed={layer === 'internal'} onClick={() => { setLayer('internal'); setSelectedPartId(null); setSelectedComponentId(null) }}>船内機関</button>
            </div>
            <label>新規砲台高 <select aria-label="新規砲台高" value={placementHeight} onChange={event => setPlacementHeight(Number(event.target.value))}>{GUN_MOUNT_HEIGHTS.map(height => <option key={height} value={height}>{height} m</option>)}</select></label>
            <label><input type="checkbox" checked={mirrorPlacement} onChange={event => setMirrorPlacement(event.target.checked)} /> 左右対称配置</label>
            <button type="button" onClick={() => { setSelectedPartId(null); setSelectedComponentId(null) }}>選択・移動</button>
          </div>
          <div className="sd-selection-toolbar" aria-label="選択部品の調整">
            {selectedComponent ? <>
              <strong>{HLG_PART_BY_ID[selectedComponent.partId]?.name}</strong>
              <div className="sd-selection-actions">
                <button type="button" onClick={handleRotate}>↻ 回転</button>
                <button type="button" onClick={() => handleNudge(0, -1)} aria-label="艦首へ移動">←</button>
                <button type="button" onClick={() => handleNudge(0, 1)} aria-label="艦尾へ移動">→</button>
                <button type="button" onClick={() => handleNudge(-1, 0)} aria-label="左舷へ移動">↑</button>
                <button type="button" onClick={() => handleNudge(1, 0)} aria-label="右舷へ移動">↓</button>
                {isGunMount(HLG_PART_BY_ID[selectedComponent.partId]?.type) && <label>高さ <select aria-label="選択砲台の高さ" value={normalizedMountHeight(selectedComponent.mountHeight)} onChange={event => handleHeightChange(Number(event.target.value))}>{GUN_MOUNT_HEIGHTS.map(height => <option key={height} value={height}>{height}m</option>)}</select></label>}
                <button type="button" className="sd-selection-delete" onClick={handleDelete}>削除</button>
              </div>
            </> : selectedPart ? <><strong>配置中：{selectedPart.name}</strong><span>艦上をクリック / ドラッグで配置</span><button type="button" onClick={() => setSelectedPartId(null)}>配置を終了</button></> : <><strong>選択・移動</strong><span>部品を選んで配置。艦上の部品をクリックして調整。</span></>}
          </div>
          <div className="sd-hlg-stage">
            {drawingView === 'dock' ? <Ship3DPreview hull={hull} design={drawingDesign} armorBonus={stats.armorDefense} /> : <ShipBlueprint hull={hull} design={drawingDesign} selectedId={movePreview?.copying ? COPY_PREVIEW_ID : selectedComponentId} onSelect={selectComponent} onMovePreview={setMovePreview} onMove={handleMoveComponent} />}
            <div className="sd-drawing-caption"><span>PLAN / {layer === 'deck' ? '上面・上部構造' : '上面・船内機関'}</span><span>← 艦首　左舷 ↑ / 右舷 ↓　艦尾 →</span></div>
            <div className="sd-plan-viewport"><HLGGrid
              hull={hull}
              design={design}
              drawingDesign={drawingDesign}
              layer={layer}
              mirrorPlacement={mirrorPlacement}
              placementHeight={placementHeight}
              selectedPart={placementPart && designerLayerForPart(placementPart) === layer ? placementPart : undefined}
              paletteDrag={paletteDrag}
              paletteDrop={paletteDrop}
              selectedWeaponSlot={selectedPlacementSlot}
              selectedComponentId={selectedComponentId}
              onCellClick={handleGridClick}
              onPartDrop={handlePlacePart}
              onSelectComponent={selectComponent}
              onMoveComponent={handleMoveComponent}
              onCopyComponent={handleCopyComponent}
              onDeleteComponent={handleDeleteComponent}
              onMovePreview={setMovePreview}
              onPaletteDropHandled={() => setPaletteDrop(null)}
            /></div>

          </div>
          <div className="sd-hull-hint">両図でドラッグ移動（側面図は前後） · Ctrl＋ドラッグでコピー · Escで中止 · 赤い砲身は干渉あり</div>
        </main>

        <aside className="sd-inspector" aria-label="設計パネル">
          <div className="sd-inspector-tabs" role="group" aria-label="設計パネル切替">
            {([['parts', '部品'], ['loadout', '搭載'], ['stats', '性能'], ['armor', '防御']] as const).map(([key, label]) => <button type="button" key={key} id={`sd-tab-${key}`} aria-pressed={sideTab === key} aria-controls="sd-inspector-content" onClick={() => setSideTab(key)}>{label}{key === 'stats' && stats.warnings.length > 0 ? ` (${stats.warnings.length})` : ''}</button>)}
          </div>
          <div className="sd-inspector-content" id="sd-inspector-content" role="region" aria-labelledby={`sd-tab-${sideTab}`}>
            {sideTab === 'parts' && (        <div className="sd-parts-pane">
          <label className="sd-part-search">部品を探す<input type="search" value={partSearch} onChange={event => setPartSearch(event.target.value)} placeholder="主砲・レーダーなど" /></label>
          <div className="sd-hlg-filter">
            {(Object.keys(CATEGORY_LABEL) as Array<HLGComponentCategory | 'all'>).filter(category => category === 'all' || WORKSHOP_CATEGORIES[workshop].includes(category)).map(category => (
              <button key={category} className={`sd-hlg-chip${partFilter === category ? ' sd-hlg-chip--active' : ''}`} onClick={() => setPartFilter(category)}>
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
          <div className="sd-hlg-part-list">{paletteGroups.length === 0 && <p>該当する部品はありません</p>}
            {paletteGroups.map(group => (
              <div className={`sd-hlg-part-group${collapsedPaletteGroups.has(group.label) ? ' sd-hlg-part-group--collapsed' : ''}`} key={group.label}>
                <button className="sd-hlg-part-group-title" type="button" onClick={() => togglePaletteGroup(group.label)}>
                  <span className="sd-hlg-tree-arrow">{collapsedPaletteGroups.has(group.label) ? '▶' : '▼'}</span>
                  <span>{group.label}</span>
                  <span className="sd-hlg-tree-count">{group.parts.length}</span>
                </button>
                {!collapsedPaletteGroups.has(group.label) && group.parts.map(part => (
                  <button
                    key={part.partId}
                    className={`sd-hlg-part${selectedPartId === part.partId ? ' sd-hlg-part--active' : ''}${draggingPartId === part.partId ? ' sd-hlg-part--dragging' : ''}`}
                    onPointerDown={(event) => handlePartPointerDown(event, part)}
                    onClick={() => { setSelectedPartId(part.partId); setSelectedComponentId(null); setLayer(designerLayerForPart(part)) }}
                  >
                    <PartSymbol part={part} />
                    <span className="sd-hlg-part-kind">{part.type ? WEAPON_TYPE_LABEL[part.type] : CATEGORY_LABEL[part.category]}</span>
                    <span className="sd-hlg-part-name">{part.name}</span>
                    <span className="sd-hlg-part-meta">{part.footprint.w}x{part.footprint.h} / {part.weight}t{partSystemMeta(part)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
)}
            {sideTab === 'loadout' && (        <section className="sd-equipment-dock" aria-label="搭載兵装表">
          <div className="sd-equipment-heading"><strong>{hull.name}</strong><span>搭載 {design.components.length} 基 ／ 重量 {Math.round(stats.totalWeight).toLocaleString()} / {stats.maxWeight.toLocaleString()} t ／ {stats.speed.toFixed(1)} kt</span></div>
            <GroupedLoadoutPanel
              design={design}
              selectedPartId={selectedComponent?.partId ?? selectedPart?.partId ?? null}
              selectedWeaponSlot={selectedWeaponSlot}
              onSelect={handleSelectGroupedPart}
              onSelectSlot={handleSelectWeaponSlot}
              onAdd={handleAddGroupedPart}
              onRemove={handleRemoveGroupedPart}
            />
        </section>
)}
            {sideTab === 'stats' && <><WeightGauge totalWeight={stats.totalWeight} maxWeight={stats.maxWeight} /><HLGStatsPanel stats={stats} /></>}
            {sideTab === 'armor' && <ArmorPlanPanel design={design} stats={stats} onChange={handleArmorChange} />}
          </div>
        </aside>
      </div>

      <footer className="sd-design-status"><span>{hull.name} · {design.components.length}基</span><span>重量 {Math.round(stats.totalWeight).toLocaleString()} / {stats.maxWeight.toLocaleString()}t</span><span>{stats.speed.toFixed(1)}kt · 火力 {stats.totalFirepower.toFixed(0)}</span><button type="button" className={stats.canDeploy ? 'is-ready' : 'has-warning'} onClick={() => setSideTab('stats')}>{stats.canDeploy ? '✓ 出撃可能' : `⚠ 設計を確認 (${stats.warnings.length})`}</button></footer>
      <div id="sd-toast" className="sd-toast" aria-live="polite" />
    </div>
  )
}

function HLGGrid({
  hull,
  design,
  drawingDesign,
  layer,
  mirrorPlacement,
  placementHeight,
  selectedPart,
  paletteDrag,
  paletteDrop,
  selectedWeaponSlot,
  selectedComponentId,
  onCellClick,
  onPartDrop,
  onSelectComponent,
  onMoveComponent,
  onCopyComponent,
  onDeleteComponent,
  onPaletteDropHandled,
  onMovePreview,
}: {
  hull: ReturnType<typeof getHullsByClass>[number]
  design: HLGDesign
  drawingDesign: HLGDesign
  layer: 'deck' | 'internal'
  mirrorPlacement: boolean
  placementHeight: number
  selectedPart?: HLGPartDefinition
  paletteDrag: PaletteDragState | null
  paletteDrop: PaletteDropState | null
  selectedWeaponSlot: number | null
  selectedComponentId: string | null
  onCellClick: (cell: HLGCell) => void
  onPartDrop: (partId: string, cell: HLGCell) => boolean
  onSelectComponent: (id: string) => void
  onMoveComponent: (id: string, cell: HLGCell) => boolean
  onCopyComponent: (id: string, cell: HLGCell) => boolean
  onDeleteComponent: (id: string) => void
  onPaletteDropHandled: () => void
  onMovePreview: (preview: ComponentMovePreview | null) => void
}) {
  const spec = hlgGridSpec(hull)
  const gridRef = useRef<HTMLDivElement | null>(null)
  type DragState = { id: string; offsetC: number; offsetR: number; cell: HLGCell; valid: boolean; moved: boolean; copying: boolean; deleteCandidate: boolean }
  const dragRef = useRef<DragState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ctrlCopyMode, setCtrlCopyMode] = useState(false)
  const [placementPreviewCell, setPlacementPreviewCell] = useState<HLGCell | null>(null)
  const handledPaletteDropRef = useRef<number | null>(null)

  const setDragState = (next: typeof drag) => {
    dragRef.current = next
    setDrag(next)
    onMovePreview(next?.moved ? { instanceId: next.id, cell: next.cell, copying: next.copying } : null)
  }

  useEffect(() => {
    const handleBlur = () => { setCtrlCopyMode(false); setDragState(null) }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDragState(null)
      if (event.key === 'Control') {
        setCtrlCopyMode(true)
        if (dragRef.current) setDragState({ ...dragRef.current, copying: true, valid: !dragRef.current.deleteCandidate && dragCellIsValid(dragRef.current.id, dragRef.current.cell, true) })
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
  }, [design, hull, onMovePreview])

  const cellFromClient = (clientX: number, clientY: number): { cell: HLGCell; outOfBounds: boolean } | null => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const r = Math.floor(((clientX - rect.left) / rect.width) * spec.rows)
    const c = Math.floor(((clientY - rect.top) / rect.height) * spec.cols)
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

  const cellFromPointer = (event: ReactPointerEvent): { cell: HLGCell; outOfBounds: boolean } | null => cellFromClient(event.clientX, event.clientY)

  useEffect(() => {
    if (!paletteDrag || !selectedPart) return
    const pointerCell = cellFromClient(paletteDrag.x, paletteDrag.y)
    if (!pointerCell || pointerCell.outOfBounds || !hlgCellIsInsideHull(hull, pointerCell.cell)) {
      setPlacementPreviewCell(null)
      return
    }
    setPlacementPreviewCell(pointerCell.cell)
  }, [paletteDrag?.x, paletteDrag?.y, paletteDrag?.partId, selectedPart?.partId, hull, spec.cols, spec.rows])

  useEffect(() => {
    if (!paletteDrop || handledPaletteDropRef.current === paletteDrop.id) return
    handledPaletteDropRef.current = paletteDrop.id
    const pointerCell = cellFromClient(paletteDrop.x, paletteDrop.y)
    if (pointerCell && !pointerCell.outOfBounds && hlgCellIsInsideHull(hull, pointerCell.cell)) {
      onPartDrop(paletteDrop.partId, pointerCell.cell)
    }
    setPlacementPreviewCell(null)
    onPaletteDropHandled()
  }, [paletteDrop, hull, onPartDrop, onPaletteDropHandled, spec.cols, spec.rows])

  const dragCellIsValid = (instanceId: string, cell: HLGCell, copying = false): boolean => {
    const component = design.components.find(item => item.instanceId === instanceId)
    const part = component ? HLG_PART_BY_ID[component.partId] : undefined
    if (!component || !part) return false
    const without = { ...design, components: design.components.filter(item => item.instanceId !== instanceId) }
    return canPlaceHLGPart(hull, copying ? design : without, part, cell, component.rotation, component.weaponSlot, component.mountHeight, component.barrels)
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
      valid: !deleteCandidate && dragCellIsValid(current.id, cell, event.ctrlKey || ctrlCopyMode),
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

  const dropPartOnCell = (event: ReactDragEvent<HTMLElement>, cell: HLGCell) => {
    const partId = event.dataTransfer.getData('application/x-battleship-part') || event.dataTransfer.getData('text/plain')
    if (!partId) return
    event.preventDefault()
    event.stopPropagation()
    setPlacementPreviewCell(null)
    onPartDrop(partId, cell)
  }

  const dragPartOverCell = (event: ReactDragEvent<HTMLElement>, cell: HLGCell) => {
    if (!hlgCellIsInsideHull(hull, cell)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setPlacementPreviewCell(cell)
  }

  const dragPartOverPointer = (event: ReactDragEvent<HTMLElement>) => {
    const pointerCell = cellFromClient(event.clientX, event.clientY)
    if (!pointerCell) return
    dragPartOverCell(event, pointerCell.cell)
  }

  const dragPartOverPointerCapture = (event: ReactDragEvent<HTMLElement>) => {
    if (!isPalettePartDrag(event)) return
    dragPartOverPointer(event)
    event.stopPropagation()
  }

  const dropPartAtPointer = (event: ReactDragEvent<HTMLElement>) => {
    const pointerCell = cellFromClient(event.clientX, event.clientY)
    if (!pointerCell) return
    dropPartOnCell(event, pointerCell.cell)
  }

  const dropPartAtPointerCapture = (event: ReactDragEvent<HTMLElement>) => {
    if (!isPalettePartDrag(event)) return
    dropPartAtPointer(event)
  }

  const updatePlacementPreviewFromPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (!selectedPart || dragRef.current || paletteDrag) return
    const pointerCell = cellFromClient(event.clientX, event.clientY)
    if (!pointerCell || pointerCell.outOfBounds || !hlgCellIsInsideHull(hull, pointerCell.cell)) {
      setPlacementPreviewCell(null)
      return
    }
    setPlacementPreviewCell(pointerCell.cell)
  }

  const placeSelectedPartAtPointer = (event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement>): boolean => {
    if (!selectedPart) return false
    const pointerCell = cellFromClient(event.clientX, event.clientY)
    if (!pointerCell || pointerCell.outOfBounds || !hlgCellIsInsideHull(hull, pointerCell.cell)) return false
    if (componentAtCell(design, pointerCell.cell, selectedPart)) return false
    onCellClick(pointerCell.cell)
    return true
  }

  const overlayDesign = drawingDesign
  const cells = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const cell = { c, r }
      const inside = hlgCellIsInsideHull(hull, cell)
      const zones = hlgCellZones(hull, cell)
      const canPlace = inside && selectedPart ? canPlaceHLGPart(hull, design, selectedPart, cell, 0, selectedWeaponSlot ?? undefined, placementHeight) : false
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
          onMouseEnter={() => setPlacementPreviewCell(cell)}
          onFocus={() => setPlacementPreviewCell(cell)}
          onClick={() => {
            setPlacementPreviewCell(cell)
            onCellClick(cell)
          }}
          onDragOver={(event) => {
            if (inside) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setPlacementPreviewCell(cell)
            }
          }}
          onDrop={(event) => dropPartOnCell(event, cell)}
          type="button"
          aria-label={`${c},${r}`}
        />,
      )
    }
  }

  return (
    <div className="sd-hlg-grid-wrap" style={{ width: `min(100cqw, ${100 * spec.rows / spec.cols}cqh)` }}>
      <div
        ref={gridRef}
        className="sd-hlg-grid"
        style={{
          gridTemplateColumns: `repeat(${spec.rows}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${spec.cols}, minmax(0, 1fr))`,
          aspectRatio: `${spec.rows} / ${spec.cols}`,
        }}
        onMouseLeave={() => setPlacementPreviewCell(null)}
        onDragOverCapture={dragPartOverPointerCapture}
        onDropCapture={dropPartAtPointerCapture}
        onDragOver={dragPartOverPointer}
        onDrop={dropPartAtPointer}
        onPointerMove={updatePlacementPreviewFromPointer}
      >
        <HullPlanOutline hull={hull} design={overlayDesign} showMachinery={layer === 'deck'} />
        {cells}
        {layer === 'deck' && <GunBarrelOverlay hull={hull} design={overlayDesign} selectedId={selectedComponentId}
          preview={selectedPart && placementPreviewCell && !componentAtCell(design, placementPreviewCell, selectedPart) ? { partId: selectedPart.partId, category: selectedPart.category, cell: placementPreviewCell, rotation: 0, barrels: selectedPart.barrels, instanceId: 'barrel-preview', mountHeight: placementHeight } : undefined} />}
        <div
          className="sd-hlg-centerline"
          style={{ gridColumn: `1 / span ${spec.rows}`, gridRow: `${spec.centerC + 1}` }}
        />
        {selectedPart && placementPreviewCell && !componentAtCell(design, placementPreviewCell, selectedPart) && (() => {
          const rotation: HLGRotation = 0
          const footprint = rotateFootprint(selectedPart.footprint, rotation)
          const previewComponent: HLGComponentInstance = {
            instanceId: 'placement-preview',
            mountHeight: placementHeight,
            partId: selectedPart.partId,
            category: selectedPart.category,
            cell: placementPreviewCell,
            rotation,
            barrels: selectedPart.barrels,
            weaponSlot: selectedPart.type ? selectedWeaponSlot ?? undefined : undefined,
          }
          const rect = componentRect(previewComponent, selectedPart)
          const valid = canPlaceHLGPart(hull, design, selectedPart, placementPreviewCell, rotation, selectedWeaponSlot ?? undefined, placementHeight)
          const mirroredCell = mirrorPlacement ? mirroredPlacementCell(hull, placementPreviewCell) : null
          const mirrorPreview = mirroredCell && valid ? (() => {
            const withOriginal = { ...design, components: [...design.components, previewComponent] }
            const mirrorValid = canPlaceHLGPart(hull, withOriginal, selectedPart, mirroredCell, rotation, selectedWeaponSlot ?? undefined, placementHeight)
            const mirroredComponent = { ...previewComponent, instanceId: 'placement-preview-mirror', cell: mirroredCell }
            return { rect: componentRect(mirroredComponent, selectedPart), valid: mirrorValid }
          })() : null
          return (
            <>
              <div
                className={`sd-hlg-placement-ghost sd-hlg-component--${selectedPart.category}${valid ? ' sd-hlg-placement-ghost--valid' : ' sd-hlg-placement-ghost--invalid'}`}
                style={{
                  gridColumn: `${Math.floor(rect.top) + 1} / span ${Math.ceil(footprint.h)}`,
                  gridRow: `${Math.floor(rect.left) + 1} / span ${Math.ceil(footprint.w)}`,
                }}
              >
                <PartPlanDrawing part={selectedPart} /><span className="sd-plan-part-label">{shortPartName(selectedPart)}</span>
              </div>
              {mirrorPreview && (
                <div
                  className={`sd-hlg-placement-ghost sd-hlg-placement-ghost--mirror sd-hlg-component--${selectedPart.category}${mirrorPreview.valid ? ' sd-hlg-placement-ghost--valid' : ' sd-hlg-placement-ghost--invalid'}`}
                  style={{
                    gridColumn: `${Math.floor(mirrorPreview.rect.top) + 1} / span ${Math.ceil(footprint.h)}`,
                    gridRow: `${Math.floor(mirrorPreview.rect.left) + 1} / span ${Math.ceil(footprint.w)}`,
                  }}
                >
                  <PartPlanDrawing part={selectedPart} /><span className="sd-plan-part-label">対称</span>
                </div>
              )}
            </>
          )
        })()}
        {design.components.map(component => {
          const part = HLG_PART_BY_ID[component.partId]
          if (!part || designerLayerForPart(part) !== layer) return null
          const footprint = rotateFootprint(part.footprint, component.rotation)
          const displayedComponent = drawingDesign.components.find(item => item.instanceId === component.instanceId) ?? component
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
              onPointerCancel={() => setDragState(null)}
              onLostPointerCapture={() => setDragState(null)}
              onClick={(event) => {
                event.stopPropagation()
                if (placeSelectedPartAtPointer(event)) return
                onSelectComponent(component.instanceId)
              }}
              type="button"
              aria-label={`${part.name}、砲台高${normalizedMountHeight(component.mountHeight)}m、${component.rotation}度`}
              title={`${part.name} / ${component.rotation}°${isGunMount(part.type) ? ` / 砲台高 ${normalizedMountHeight(component.mountHeight)}m` : ''}`}
            >
              <PartPlanDrawing part={part} rotation={component.rotation} barrels={component.barrels} /><span className="sd-plan-part-label">{shortPartName(part)}</span>
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
              <PartPlanDrawing part={part} rotation={source.rotation} barrels={source.barrels} /><span className="sd-plan-part-label">コピー</span>
            </div>
          )
        })()}
        {selectedComponentId && (() => {
          const component = drawingDesign.components.find(item => item.instanceId === selectedComponentId)
          const part = component ? HLG_PART_BY_ID[component.partId] : undefined
          return component && part?.type
            ? <FiringArcOverlay component={component} part={part} spec={spec} />
            : null
        })()}
        <div className="sd-hlg-bow-marker">艦首</div>
        <div className="sd-hlg-stern-marker">艦尾</div>
        {(ctrlCopyMode || drag?.copying) && <div className="sd-hlg-copy-mode">COPY MODE</div>}
      </div>
    </div>
  )
}

function FiringArcOverlay({
  component,
  part,
  spec,
}: {
  component: HLGComponentInstance
  part: HLGPartDefinition
  spec: ReturnType<typeof hlgGridSpec>
}) {
  const mount = {
    x: Math.max(-1, Math.min(1, (component.cell.c + 0.5 - (spec.centerC + 0.5)) / (spec.beamCells / 2))),
    y: Math.max(-1, Math.min(1, ((component.cell.r + 0.5 - spec.topR) / Math.max(1, spec.lengthCells - 1)) * 2 - 1)),
  }
  const arc = firingArcForWeapon(part.type!, mount)
  const displayArc = { ...arc, center: arc.center + Math.PI }
  const cx = ((component.cell.r + 0.5) / spec.rows) * 100
  const cy = ((component.cell.c + 0.5) / spec.cols) * 100
  const arcRadius = 38
  const safePath = arcPath(cx, cy, arcRadius, displayArc)
  const dangerPath = circlePath(cx, cy, arcRadius)
  return (
    <svg className="sd-hlg-arc-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={dangerPath} className="sd-hlg-arc-danger" />
      <path d={safePath} className="sd-hlg-arc-safe" />
      <path d={safePath} className="sd-hlg-arc-line" />
      <circle cx={cx} cy={cy} r="0.55" className="sd-hlg-arc-origin" />
      <text x={Math.min(96, cx + 1.4)} y={Math.max(4, cy - 1.8)} className="sd-hlg-arc-label">{firingArcLabel(arc)}</text>
    </svg>
  )
}

function arcPath(cx: number, cy: number, radius: number, arc: FiringArc): string {
  if (arc.width >= Math.PI * 2 - 0.001) {
    return circlePath(cx, cy, radius)
  }
  const start = arc.center - arc.width / 2
  const end = arc.center + arc.width / 2
  const p1 = arcPoint(cx, cy, radius, start)
  const p2 = arcPoint(cx, cy, radius, end)
  const large = arc.width > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${large} 1 ${p2.x} ${p2.y} Z`
}

function circlePath(cx: number, cy: number, radius: number): string {
  return [
    `M ${cx} ${cy}`,
    `m ${-radius} 0`,
    `a ${radius} ${radius} 0 1 0 ${radius * 2} 0`,
    `a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`,
    'Z',
  ].join(' ')
}

function arcPoint(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  }
}

function HLGStatsPanel({ stats }: { stats: ReturnType<typeof calcStats> }) {
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
        <StatRow label="装甲防御" value={`${stats.armorDefense}%`} color="#facc15" />
        <StatRow label="水中防御" value={`${stats.underwaterDefense}%`} color="#38bdf8" />
      </div>

      <EngineBalancePanel stats={stats} />

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

function ArmorPlanPanel({
  design,
  stats,
  onChange,
}: {
  design: HLGDesign
  stats: ReturnType<typeof calcStats>
  onChange: (field: 'belt' | 'deck', value: ArmorDefenseKey) => void
}) {
  return (
    <div className="sd-armor-panel">
      <div className="sd-section-title">防御設定</div>
      <label className="sd-armor-field">
        <span>舷側防御</span>
        <select value={armorSelectValue(design.armorPlan.belt)} onChange={event => onChange('belt', event.target.value as ArmorDefenseKey)}>
          {ARMOR_DEFENSE_OPTIONS.map(option => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="sd-armor-field">
        <span>甲板防御</span>
        <select value={armorSelectValue(design.armorPlan.deck)} onChange={event => onChange('deck', event.target.value as ArmorDefenseKey)}>
          {ARMOR_DEFENSE_OPTIONS.map(option => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="sd-armor-summary">
        <div><span>VP</span><strong>{stats.vitalPartRatio.toFixed(1)}%</strong></div>
        <div><span>形式</span><strong>{stats.defenseScheme}</strong></div>
        <div><span>装甲重量</span><strong>{stats.armorWeight.toLocaleString()}t</strong></div>
        <div><span>甲板</span><strong>{stats.deckDefense}%</strong></div>
      </div>
      <div className="sd-armor-note">
        VPは重要部品の最前端から最後端まで。54%未満なら集中防御になります。
      </div>
    </div>
  )
}

function armorSelectValue(value: HLGDesign['armorPlan']['belt']): ArmorDefenseKey {
  if (typeof value === 'string') return value
  if (value <= 0) return 'none'
  if (value <= 3) return '10cm'
  if (value <= 6) return '12cm'
  if (value <= 8) return '14cm'
  if (value <= 10) return '15cm'
  if (value <= 15) return '20cm'
  if (value <= 20) return '25cm'
  if (value <= 25) return '31cm'
  if (value <= 30) return '36cm'
  if (value <= 38) return '38cm'
  if (value <= 47) return '41cm'
  if (value <= 58) return '43cm'
  if (value <= 70) return '46cm'
  if (value <= 77) return '51cm'
  if (value <= 83) return '56cm'
  return '61cm'
}

function EngineBalancePanel({ stats }: { stats: ReturnType<typeof calcStats> }) {
  const boilerBalance = stats.boilerPowerProvided - stats.turbinePowerRequired - stats.auxPowerRequired
  const smokeBalance = stats.smokeProvided - stats.smokeRequired
  const boilerDemand = Math.max(1, stats.turbinePowerRequired + stats.auxPowerRequired)
  const smokeDemand = Math.max(1, stats.smokeRequired)
  return (
    <div className="sd-engine-balance">
      <div className="sd-section-title">機関バランス</div>
      <EngineBalanceRow
        label="主缶出力"
        value={`${stats.boilerPowerProvided} / 要求 ${stats.turbinePowerRequired + stats.auxPowerRequired}`}
        balance={boilerBalance}
        ratio={stats.boilerPowerProvided / boilerDemand}
      />
      <EngineBalanceRow
        label="主機"
        value={`要求 ${stats.turbinePowerRequired} / 推進 +${stats.turbinePowerProvided}`}
        balance={stats.boilerPowerProvided - stats.turbinePowerRequired}
        ratio={stats.turbinePowerRequired ? stats.boilerPowerProvided / stats.turbinePowerRequired : 1}
      />
      <EngineBalanceRow
        label="煙突排煙"
        value={`${stats.smokeProvided} / 要求 ${stats.smokeRequired}`}
        balance={smokeBalance}
        ratio={stats.smokeProvided / smokeDemand}
      />
      <div className="sd-engine-note">
        主缶は出力を作り排煙を要求、主機は出力を使って推進力を出します。
      </div>
    </div>
  )
}

function EngineBalanceRow({
  label,
  value,
  balance,
  ratio,
}: {
  label: string
  value: string
  balance: number
  ratio: number
}) {
  const ok = balance >= 0
  return (
    <div className={`sd-engine-row${ok ? ' sd-engine-row--ok' : ' sd-engine-row--bad'}`}>
      <div className="sd-engine-head">
        <span className="sd-engine-label">{label}</span>
        <span className="sd-engine-value">{value}</span>
      </div>
      <div className="sd-engine-bar" aria-hidden="true">
        <div className="sd-engine-fill" style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
      </div>
      <div className="sd-engine-balance-text">{ok ? `余裕 +${balance}` : `不足 ${Math.abs(balance)}`}</div>
    </div>
  )
}

function GroupedLoadoutPanel({
  design,
  selectedPartId,
  selectedWeaponSlot,
  onSelect,
  onSelectSlot,
  onAdd,
  onRemove,
}: {
  design: HLGDesign
  selectedPartId: string | null
  selectedWeaponSlot: number | null
  onSelect: (slotIndex: number) => void
  onSelectSlot: (slotIndex: number) => void
  onAdd: (slotIndex: number) => void
  onRemove: (slotIndex: number) => void
}) {
  const groups = useMemo(() => groupedLoadout(design), [design])
  const weaponSlots = useMemo(() => weaponSlotItems(design), [design])
  const armaments = groups.filter(group => group.kind === 'armament')
  const auxArmaments = groups.filter(group => group.kind === 'aux')
  return (
    <section className="sd-loadout-panel">
      <WeaponSlotStrip slots={weaponSlots} selectedPartId={selectedPartId} selectedWeaponSlot={selectedWeaponSlot} onSelect={onSelectSlot} />
      <div className="sd-loadout-groups">
        <GroupedLoadoutColumn title="兵装" groups={armaments} selectedPartId={selectedPartId} onSelect={onSelect} onAdd={onAdd} onRemove={onRemove} />
        <GroupedLoadoutColumn title="補助兵装" groups={auxArmaments} selectedPartId={selectedPartId} onSelect={onSelect} onAdd={onAdd} onRemove={onRemove} />
      </div>
    </section>
  )
}

function WeaponSlotStrip({
  slots,
  selectedPartId,
  selectedWeaponSlot,
  onSelect,
}: {
  slots: WeaponSlotItem[]
  selectedPartId: string | null
  selectedWeaponSlot: number | null
  onSelect: (slotIndex: number) => void
}) {
  const used = slots.filter(slot => !!slot.part).length
  return (
    <div className="sd-loadout-slots">
      <div className="sd-loadout-slots-title">兵装スロット {used}/{MAX_WEAPON_SLOTS}</div>
      <div className="sd-loadout-slot-grid">
        {slots.map((part, index) => {
          const selected = selectedWeaponSlot === index || part.part?.partId === selectedPartId && part.slot === selectedWeaponSlot
          return (
            <button
              key={index}
              className={`sd-loadout-slot-cell${part.part ? ' sd-loadout-slot-cell--filled' : ''}${selected ? ' sd-loadout-slot-cell--selected' : ''}`}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`兵装スロット${index + 1}${part.part ? ` ${part.part.name}` : ' 空'}`}
            >
              <span className="sd-loadout-slot-index">{index + 1}</span>
              <span className="sd-loadout-slot-name">{part.part ? `${shortSlotPartName(part.part)} x${part.count}` : '空'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GroupedLoadoutColumn({
  title,
  groups,
  selectedPartId,
  onSelect,
  onAdd,
  onRemove,
}: {
  title: string
  groups: LoadoutGroup[]
  selectedPartId: string | null
  onSelect: (slotIndex: number) => void
  onAdd: (slotIndex: number) => void
  onRemove: (slotIndex: number) => void
}) {
  return (
    <div className="sd-loadout-group-column">
      <div className="sd-loadout-group-title">{title}</div>
      {groups.length === 0 ? (
        <div className="sd-loadout-group-empty">未配置</div>
      ) : groups.map(group => (
        <div
          key={`${group.slot}:${group.part.partId}`}
          className={`sd-loadout-group-row${group.part.partId === selectedPartId ? ' sd-loadout-group-row--selected' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(group.slot)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(group.slot)
            }
          }}
        >
          <div className="sd-loadout-group-main">
            <span className="sd-loadout-group-name">{group.part.name}</span>
            <span className="sd-loadout-group-meta">
              {group.part.footprint.w}x{group.part.footprint.h}
              {group.part.weight ? ` / ${group.part.weight}t` : ''}
            </span>
          </div>
          <div className="sd-loadout-group-count">{group.kind === 'aux' ? `${group.count}基` : `S${group.slot + 1} / ${group.count}基`}</div>
          {group.kind === 'armament' ? (
            <div className="sd-loadout-group-actions">
              <button
                className="sd-loadout-group-btn"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(group.slot)
                }}
                aria-label={`${group.part.name}を減らす`}
              >
                -
              </button>
              <button
                className="sd-loadout-group-btn"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onAdd(group.slot)
                }}
                aria-label={`${group.part.name}を増やす`}
              >
                +
              </button>
            </div>
          ) : <div className="sd-loadout-group-actions" />}
        </div>
      ))}
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

interface PalettePartGroup {
  label: string
  order: number
  parts: HLGPartDefinition[]
}

interface LoadoutGroup {
  slot: number
  part: HLGPartDefinition
  count: number
  kind: 'armament' | 'aux'
}

interface WeaponSlotItem {
  slot: number
  part: HLGPartDefinition | null
  count: number
  components: HLGComponentInstance[]
}

function groupPaletteParts(parts: HLGPartDefinition[]): PalettePartGroup[] {
  const groups = new Map<string, PalettePartGroup>()
  for (const part of parts) {
    const label = paletteGroupLabel(part)
    const order = paletteGroupOrder(part)
    const group = groups.get(label)
    if (group) group.parts.push(part)
    else groups.set(label, { label, order, parts: [part] })
  }
  return [...groups.values()]
    .map(group => ({ ...group, parts: group.parts.sort((a, b) => palettePartSort(a) - palettePartSort(b) || a.weight - b.weight || a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
}

function paletteGroupLabel(part: HLGPartDefinition): string {
  if (part.type) return WEAPON_TYPE_LABEL[part.type]
  return CATEGORY_LABEL[part.category]
}

function paletteGroupOrder(part: HLGPartDefinition): number {
  if (part.type === 'gun') return 10
  if (part.type === 'secondary') return 20
  if (part.type === 'torpedo') return 30
  if (part.type === 'aa') return 40
  if (part.type === 'missile') return 50
  if (part.category === 'bridge') return 60
  if (part.category === 'funnel') return 70
  if (part.category === 'boiler') return 80
  if (part.category === 'turbine') return 90
  if (part.category === 'aux') return 100
  if (part.category === 'armor') return 110
  return 999
}

function palettePartSort(part: HLGPartDefinition): number {
  if (part.type) return part.cost
  return part.weight
}

function groupedLoadout(design: HLGDesign): LoadoutGroup[] {
  const armaments = weaponSlotItems(design)
    .filter((slot): slot is WeaponSlotItem & { part: HLGPartDefinition } => !!slot.part)
    .map(slot => ({ slot: slot.slot, part: slot.part, count: slot.count, kind: loadoutGroupKind(slot.part) }))
  const auxGroups = [...design.components
    .filter(component => HLG_PART_BY_ID[component.partId]?.category === 'aux')
    .reduce((groups, component) => {
      const part = HLG_PART_BY_ID[component.partId]
      if (!part) return groups
      const group = groups.get(component.partId)
      if (group) group.count += 1
      else groups.set(component.partId, { slot: -1, part, count: 1, kind: 'aux' as const })
      return groups
    }, new Map<string, LoadoutGroup>())
    .values()]
  return [...armaments, ...auxGroups]
    .sort((a, b) => loadoutGroupSort(a.part) - loadoutGroupSort(b.part) || a.slot - b.slot || a.part.name.localeCompare(b.part.name))
}

function weaponSlotItems(design: HLGDesign): WeaponSlotItem[] {
  return Array.from({ length: MAX_WEAPON_SLOTS }, (_, slot) => {
    const components = design.components.filter(component => component.weaponSlot === slot && !!HLG_PART_BY_ID[component.partId]?.type)
    const part = components[0] ? HLG_PART_BY_ID[components[0].partId] ?? null : null
    return { slot, part, count: components.length, components }
  })
}

function isGroupedLoadoutPart(part: HLGPartDefinition): boolean {
  return part.category === 'weapon' || part.category === 'aux'
}

function loadoutGroupKind(part: HLGPartDefinition): LoadoutGroup['kind'] {
  if (part.category === 'aux') return 'aux'
  return 'armament'
}

function loadoutGroupSort(part: HLGPartDefinition): number {
  if (part.type === 'gun') return 10
  if (part.type === 'torpedo') return 20
  if (part.type === 'missile') return 30
  if (part.type === 'secondary') return 40
  if (part.type === 'aa') return 50
  return 60
}

function componentAtCell(design: HLGDesign, cell: HLGCell, placingPart?: HLGPartDefinition, layer?: 'deck' | 'internal'): HLGComponentInstance | null {
  return design.components.find(component => {
    const part = HLG_PART_BY_ID[component.partId]
    if (!part) return false
    if (layer && designerLayerForPart(part) !== layer) return false
    if (placingPart && !componentsShareDesignerLayer(part, placingPart)) return false
    const rect = componentRect(component, part)
    return cell.c >= Math.floor(rect.left) && cell.c < Math.ceil(rect.left + rect.w) && cell.r >= Math.floor(rect.top) && cell.r < Math.ceil(rect.top + rect.h)
  }) ?? null
}

function componentsShareDesignerLayer(a: HLGPartDefinition, b: HLGPartDefinition): boolean {
  return designerLayerForPart(a) === designerLayerForPart(b)
}

function isPalettePartDrag(event: ReactDragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).some(type => type === 'application/x-battleship-part' || type === 'text/plain')
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

function shortSlotPartName(part: HLGPartDefinition): string {
  return part.name
    .replace('連装砲', '連砲')
    .replace('重砲', '重')
    .replace('速射副砲', '速副')
    .replace('対空砲', '対空')
    .replace('ミサイル', 'MSL')
    .slice(0, 6)
}

function preferredCellForGroupedPart(
  hull: ReturnType<typeof getHullsByClass>[number],
  part: HLGPartDefinition,
  previous?: HLGComponentInstance,
): HLGCell {
  const spec = hlgGridSpec(hull)
  if (previous) {
    const footprint = rotateFootprint(part.footprint, previous.rotation)
    return { c: previous.cell.c, r: previous.cell.r + Math.ceil(footprint.h) + 2 }
  }
  const r =
    part.category === 'aux' ? spec.topR + Math.round(spec.lengthCells * 0.42)
      : part.type === 'torpedo' ? spec.topR + Math.round(spec.lengthCells * 0.55)
        : part.type === 'missile' || part.type === 'aa' ? spec.topR + Math.round(spec.lengthCells * 0.62)
          : spec.topR + Math.round(spec.lengthCells * 0.25)
  const c = part.type === 'torpedo' ? spec.centerC + Math.max(2, Math.round(spec.beamCells * 0.26)) : spec.centerC
  return { c, r }
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
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
