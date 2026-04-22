import type { WeaponTemplate, PlayerShipType } from '../data/masterdata'
import { getHullsByClass, type HullCatalogEntry, type HullSlot } from '../data/hull-catalog'
import { WEAPON_SHOP, TYPE_COLOR, TYPE_JP, type ShopWeapon } from '../data/weapon-shop'
import type { WeaponType } from '../simulation/types'

export interface PrepResult {
  templateId: string
  shipType: PlayerShipType
  loadout: WeaponTemplate[]
}

// ── Grid constants ────────────────────────────────────────────────────────
const GRID_COLS = 15   // 0..14, centerline = col 7
const GRID_ROWS = 28   // 0..27, bow = row 0, stern = row 27
const MAX_SLOT_MOVE_CELLS = 5

/** Map a hull slot's normalized (x, y) to a grid cell */
function slotCell(slot: HullSlot): { c: number; r: number } {
  const c = Math.round(((slot.x + 1) / 2) * (GRID_COLS - 1))
  const r = Math.round(((slot.y + 1) / 2) * (GRID_ROWS - 1))
  return {
    c: Math.max(0, Math.min(GRID_COLS - 1, c)),
    r: Math.max(0, Math.min(GRID_ROWS - 1, r)),
  }
}

function cellToMount(c: number, r: number): { x: number; y: number } {
  return {
    x: (c / (GRID_COLS - 1)) * 2 - 1,
    y: (r / (GRID_ROWS - 1)) * 2 - 1,
  }
}

type ScreenTab = 'hull' | 'armament'
type WeaponFilter = WeaponType | 'all'
type ComponentKind = 'weapon' | 'tower'
type Footprint = { w: number; h: number }
type GridCell = { c: number; r: number }
type Placement = {
  id: string
  kind: ComponentKind
  label: string
  cell: GridCell
  footprint: Footprint
  color: string
  slot?: HullSlot
  weapon?: ShopWeapon
}

type Region =
  | { tag: 'class-tab';   shipType: PlayerShipType;   x: number; y: number; w: number; h: number }
  | { tag: 'hull-card';   index: number;               x: number; y: number; w: number; h: number }
  | { tag: 'main-tab';    tab: ScreenTab;              x: number; y: number; w: number; h: number }
  | { tag: 'type-tab';    filter: WeaponFilter;        x: number; y: number; w: number; h: number }
  | { tag: 'grid-slot';   slotId: string;              x: number; y: number; w: number; h: number }
  | { tag: 'grid-tower';                                x: number; y: number; w: number; h: number }
  | { tag: 'grid-empty';  c: number; r: number;        x: number; y: number; w: number; h: number }
  | { tag: 'weapon-card'; weaponId: string;            x: number; y: number; w: number; h: number }
  | { tag: 'deploy';                                    x: number; y: number; w: number; h: number }
  | { tag: 'back';                                      x: number; y: number; w: number; h: number }

const CLASS_TABS: { type: PlayerShipType; label: string }[] = [
  { type: 'destroyer',  label: '駆逐艦' },
  { type: 'cruiser',    label: '巡洋艦' },
  { type: 'battleship', label: '戦艦'   },
]

const TYPE_TABS: { filter: WeaponFilter; label: string }[] = [
  { filter: 'all',       label: '全種' },
  { filter: 'gun',       label: '主砲' },
  { filter: 'secondary', label: '副砲' },
  { filter: 'torpedo',   label: '魚雷' },
  { filter: 'aa',        label: '対空' },
  { filter: 'missile',   label: 'ミサイル' },
]

const BG     = '#0a1410'
const PANEL  = '#0d1e14'
const BORDER = '#264a2e'
const TEXT   = '#a0c8a0'
const DIM    = '#3a5840'
const ACCENT = '#1a6a2a'
const GREEN  = '#16a34a'
const YELLOW = '#b89420'
const LOCKED = '#090f0a'
const SEL    = '#0a3018'

export class PrepScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions: Region[] = []
  private hovered: Region | null = null
  private onMoveRef: (e: MouseEvent) => void

  private stage = 1
  private tab: ScreenTab = 'hull'
  private selectedClass: PlayerShipType = 'destroyer'
  private selectedHullIdx = 0
  private selectedSlotId: string | null = null
  private selectedTower = false
  private weaponFilter: WeaponFilter = 'all'
  private slotWeapons = new Map<string, ShopWeapon>()  // slotId → weapon
  private slotCells = new Map<string, { c: number; r: number }>()
  private towerCell: GridCell | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onMoveRef = (e) => this.onMouseMove(e)
  }

  attach(stage: number): void {
    this.stage = stage
    this.tab = 'hull'
    this.selectedClass = 'destroyer'
    this.selectedHullIdx = 0
    this.selectedSlotId = null
    this.selectedTower = false
    this.weaponFilter = 'all'
    this.slotWeapons = new Map()
    this.slotCells = new Map()
    this.towerCell = null
    this.canvas.addEventListener('mousemove', this.onMoveRef)
  }

  detach(): void {
    this.canvas.removeEventListener('mousemove', this.onMoveRef)
    this.hovered = null
  }

  checkClick(e: MouseEvent): PrepResult | null {
    const r = this.hitRegion(e)
    if (!r) return null

    switch (r.tag) {
      case 'main-tab':
        if (r.tab === 'armament' && !this.selectedHull()) break
        this.tab = r.tab
        this.selectedSlotId = null
        this.selectedTower = false
        break

      case 'class-tab':
        this.selectedClass = r.shipType
        this.selectedHullIdx = 0
        this.slotWeapons = new Map()
        this.slotCells = new Map()
        this.towerCell = null
        this.selectedSlotId = null
        this.selectedTower = false
        break

      case 'hull-card': {
        const hull = getHullsByClass(this.selectedClass)[r.index]
        if (!hull || hull.minStage > this.stage) break
        if (this.selectedHullIdx !== r.index) {
          this.selectedHullIdx = r.index
          this.slotWeapons = new Map()
          this.slotCells = new Map()
          this.towerCell = null
          this.selectedSlotId = null
          this.selectedTower = false
        }
        break
      }

      case 'type-tab':
        this.weaponFilter = r.filter
        break

      case 'grid-slot':
        // Toggle selection; clicking again deselects
        this.selectedSlotId = this.selectedSlotId === r.slotId ? null : r.slotId
        this.selectedTower = false
        break

      case 'grid-tower':
        this.selectedTower = !this.selectedTower
        this.selectedSlotId = null
        break

      case 'grid-empty': {
        const hull = this.selectedHull()
        if (!hull) break
        if (this.selectedTower) {
          if (this.canMoveTowerTo(r.c, r.r, hull)) this.towerCell = { c: r.c, r: r.r }
          break
        }
        if (!this.selectedSlotId) break
        const slot = hull?.slots.find(s => s.id === this.selectedSlotId)
        if (!slot || !this.canMoveSlotTo(slot, r.c, r.r, hull)) break
        this.slotCells.set(slot.id, { c: r.c, r: r.r })
        break
      }

      case 'weapon-card': {
        // Assign the weapon to the selected slot (if compatible), or remove it
        if (!this.selectedSlotId) break
        const hull = this.selectedHull()
        const slot = hull?.slots.find(s => s.id === this.selectedSlotId)
        if (!slot) break
        const w = WEAPON_SHOP.find(x => x.id === r.weaponId)
        if (!w || !slot.compatibleTypes.includes(w.type)) break
        if (this.slotWeapons.get(slot.id)?.id === w.id) {
          this.slotWeapons.delete(slot.id)   // clicking current weapon removes it
        } else {
          this.slotWeapons.set(slot.id, w)
          this.selectedSlotId = null
        }
        break
      }

      case 'deploy':
        return this.buildResult()

      case 'back':
        if (this.tab === 'armament') this.tab = 'hull'
        break
    }
    return null
  }

  render(): void {
    const { width: cw, height: ch } = this.canvas
    this.regions = []
    this.drawBackground(cw, ch)
    const TAB_H = 40, STAT_H = 54, BTN_H = 44
    const mainY = TAB_H
    const mainH = ch - TAB_H - STAT_H - BTN_H
    this.drawTopTabs(cw, TAB_H)
    if (this.tab === 'hull') this.renderHullTab(0, mainY, cw, mainH)
    else                     this.renderArmamentTab(0, mainY, cw, mainH)
    this.renderStatsBar(0, ch - STAT_H - BTN_H, cw, STAT_H)
    this.renderButtons(0, ch - BTN_H, cw, BTN_H)
  }

  // ── Data helpers ─────────────────────────────────────────────────────────

  private selectedHull(): HullCatalogEntry | null {
    return getHullsByClass(this.selectedClass)[this.selectedHullIdx] ?? null
  }

  private buildResult(): PrepResult | null {
    const hull = this.selectedHull()
    if (!hull) return null
    const loadout: WeaponTemplate[] = []
    for (const slot of hull.slots) {
      const w = this.slotWeapons.get(slot.id) ?? this.defaultWeapon(slot)
      const cell = this.currentSlotCell(slot)
      if (w) loadout.push({ id: w.id, name: w.name, type: w.type, ammo: w.ammo, mount: cellToMount(cell.c, cell.r) })
    }
    if (loadout.length === 0) return null
    return { templateId: hull.templateId, shipType: hull.shipType, loadout }
  }

  private defaultWeapon(slot: HullSlot): ShopWeapon | null {
    return WEAPON_SHOP.find(w =>
      slot.compatibleTypes.includes(w.type) && w.minStage <= this.stage
    ) ?? null
  }

  private getCompatible(slot: HullSlot): ShopWeapon[] {
    return WEAPON_SHOP.filter(w =>
      slot.compatibleTypes.includes(w.type) && w.minStage <= this.stage
    )
  }

  private defaultTowerCell(hull: HullCatalogEntry): GridCell {
    const y = hull.shipType === 'destroyer' ? -0.25 : hull.shipType === 'cruiser' ? 0.25 : -0.02
    return slotCell({ id: 'tower', label: '管制塔', x: 0, y, compatibleTypes: [] })
  }

  private towerFootprint(hull: HullCatalogEntry): Footprint {
    return hull.shipType === 'battleship' ? { w: 4, h: 5 }
      : hull.shipType === 'cruiser' ? { w: 3, h: 4 }
      : { w: 3, h: 3 }
  }

  private weaponFootprint(weapon: ShopWeapon | undefined, slot: HullSlot): Footprint {
    const id = weapon?.id ?? ''
    const type = weapon?.type ?? slot.compatibleTypes[0]
    if (type === 'gun') {
      if (id.includes('460mm')) return { w: 5, h: 4 }
      if (id.includes('406mm')) return { w: 4, h: 3 }
      if (id.includes('203mm')) return { w: 3, h: 3 }
      if (id.includes('152mm')) return { w: 3, h: 2 }
      return { w: 2, h: 2 }
    }
    if (type === 'secondary') return id.includes('152mm') ? { w: 3, h: 2 } : { w: 2, h: 1 }
    if (type === 'torpedo') return id.includes('610mm') ? { w: 4, h: 1 } : { w: 3, h: 1 }
    if (type === 'missile') return id.includes('longrange') || id.includes('cruise') ? { w: 3, h: 3 } : { w: 2, h: 2 }
    if (type === 'aa') return id.includes('ciws') || id.includes('20mm') ? { w: 1, h: 1 } : { w: 2, h: 2 }
    return { w: 2, h: 2 }
  }

  private buildPlacements(hull: HullCatalogEntry): Placement[] {
    const towerCell = this.towerCell ?? this.defaultTowerCell(hull)
    const placements: Placement[] = [{
      id: 'tower',
      kind: 'tower',
      label: '管制塔',
      cell: towerCell,
      footprint: this.towerFootprint(hull),
      color: '#d6b86a',
    }]

    for (const slot of hull.slots) {
      const weapon = this.slotWeapons.get(slot.id)
      placements.push({
        id: slot.id,
        kind: 'weapon',
        label: weapon ? TYPE_JP[weapon.type] : slot.label,
        cell: this.currentSlotCell(slot),
        footprint: this.weaponFootprint(weapon, slot),
        color: weapon ? (TYPE_COLOR[weapon.type] ?? DIM) : '#3a6a42',
        slot,
        weapon,
      })
    }
    return placements
  }

  // ── Background ────────────────────────────────────────────────────────────

  private drawBackground(cw: number, ch: number): void {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, ch)
    g.addColorStop(0, '#0a1510'); g.addColorStop(1, '#060d08')
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch)
    ctx.strokeStyle = 'rgba(38,74,46,0.12)'; ctx.lineWidth = 1
    for (let x = 0; x < cw; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke() }
    for (let y = 0; y < ch; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke() }
  }

  // ── Top tabs ──────────────────────────────────────────────────────────────

  private drawTopTabs(cw: number, h: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#080f08'; ctx.fillRect(0, 0, cw, h)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(cw, h); ctx.stroke()
    ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'right'
    ctx.fillText(`Stage ${this.stage}`, cw - 12, h / 2 + 4)

    const defs: { tab: ScreenTab; label: string }[] = [
      { tab: 'hull',     label: '艦体選択' },
      { tab: 'armament', label: '兵装配置' },
    ]
    const tw = 114, th = h - 10, sx = 8
    for (let i = 0; i < defs.length; i++) {
      const t = defs[i]!; const tx = sx + i * (tw + 4)
      const active = this.tab === t.tab
      ctx.fillStyle = active ? ACCENT : '#0c1610'; ctx.fillRect(tx, 5, tw, th)
      ctx.strokeStyle = active ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(tx, 5, tw, th)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = active ? '#cce8cc' : DIM; ctx.textAlign = 'center'
      ctx.fillText(t.label, tx + tw / 2, 5 + th / 2 + 5)
      this.addRegion({ tag: 'main-tab', tab: t.tab, x: tx, y: 5, w: tw, h: th })
    }
  }

  // ── Hull tab ──────────────────────────────────────────────────────────────

  private renderHullTab(x: number, y: number, cw: number, ch: number): void {
    const ctx = this.ctx
    const ctW = 88, ctH = 42
    for (let i = 0; i < CLASS_TABS.length; i++) {
      const tab = CLASS_TABS[i]!; const ty = y + 20 + i * (ctH + 8)
      const active = tab.type === this.selectedClass
      ctx.fillStyle = active ? ACCENT : '#0c1610'; ctx.fillRect(x + 8, ty, ctW, ctH)
      ctx.strokeStyle = active ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(x + 8, ty, ctW, ctH)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = active ? '#cce8cc' : TEXT; ctx.textAlign = 'center'
      ctx.fillText(tab.label, x + 8 + ctW / 2, ty + ctH / 2 + 5)
      this.addRegion({ tag: 'class-tab', shipType: tab.type, x: x + 8, y: ty, w: ctW, h: ctH })
    }

    const hulls = getHullsByClass(this.selectedClass)
    const cardW = Math.min(250, (cw - 116) / 3 - 14)
    const cardH = Math.min(310, ch - 28)
    const totalW = hulls.length * (cardW + 14) - 14
    const startX = x + 110 + (cw - 110 - totalW) / 2
    const cardY = y + (ch - cardH) / 2

    for (let i = 0; i < hulls.length; i++) {
      const hull = hulls[i]!
      const cx2 = startX + i * (cardW + 14)
      const locked = hull.minStage > this.stage
      const selected = i === this.selectedHullIdx && !locked
      this.drawHullCard(cx2, cardY, cardW, cardH, hull, locked, selected)
      if (!locked) this.addRegion({ tag: 'hull-card', index: i, x: cx2, y: cardY, w: cardW, h: cardH })
    }
  }

  private drawHullCard(x: number, y: number, w: number, h: number, hull: HullCatalogEntry, locked: boolean, selected: boolean): void {
    const ctx = this.ctx
    ctx.fillStyle = locked ? LOCKED : selected ? SEL : PANEL; ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = locked ? '#1a2a1a' : selected ? '#3a9a4a' : BORDER
    ctx.lineWidth = selected ? 2 : 1; ctx.strokeRect(x, y, w, h)

    const bc = locked ? '#1a2a1a' : hull.minStage <= 1 ? '#1a5a1a' : hull.minStage <= 4 ? '#1a3a6f' : '#5a3a0a'
    ctx.fillStyle = bc; ctx.fillRect(x + w - 70, y + 8, 62, 20)
    ctx.font = '10px sans-serif'; ctx.fillStyle = locked ? DIM : '#c0e0c0'; ctx.textAlign = 'center'
    ctx.fillText(hull.minStage <= 1 ? '初期解放' : `Stg.${hull.minStage}+`, x + w - 39, y + 22)

    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = locked ? DIM : selected ? '#a0d8a0' : TEXT
    ctx.fillText(hull.name, x + w / 2, y + 44)
    ctx.font = '11px sans-serif'; ctx.fillStyle = locked ? '#1a2a1a' : '#4a7a4a'
    ctx.fillText(hull.className, x + w / 2, y + 60)

    this.drawShipTopDown(ctx, x + w / 2, y + h * 0.42, w * 0.28, h * 0.30, hull, locked)

    const sv = y + h - 104
    this.drawStatBar(x + 14, sv,      w - 28, 'HP',   hull.hp / 2100,      locked ? DIM : '#22c55e', `${hull.hp}`,                   locked)
    this.drawStatBar(x + 14, sv + 30, w - 28, '速力', hull.maxSpeed / 7.2, locked ? DIM : '#38bdf8', `${hull.maxSpeed.toFixed(1)}kt`, locked)

    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = locked ? DIM : '#4a7a4a'; ctx.textAlign = 'left'
    ctx.fillText(`スロット: ${hull.slots.length}`, x + 14, y + h - 22)
    if (selected) {
      ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#3a9a4a'; ctx.textAlign = 'right'
      ctx.fillText('✓ 選択中', x + w - 10, y + h - 10)
    }
    if (locked) {
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#2a3a2a'; ctx.textAlign = 'center'
      ctx.fillText('🔒 未解放', x + w / 2, y + h / 2 + 4)
    }
  }

  // ── Armament tab ──────────────────────────────────────────────────────────

  private renderArmamentTab(x: number, y: number, cw: number, ch: number): void {
    const hull = this.selectedHull()
    if (!hull) return

    const PALETTE_W = Math.floor(cw * 0.36)
    const gridAreaW = cw - PALETTE_W

    this.drawGridArea(x, y, gridAreaW, ch, hull)

    // Right panel
    const ctx = this.ctx
    ctx.fillStyle = '#080e08'; ctx.fillRect(x + gridAreaW, y, PALETTE_W, ch)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x + gridAreaW, y); ctx.lineTo(x + gridAreaW, y + ch); ctx.stroke()
    this.drawWeaponPalette(x + gridAreaW, y, PALETTE_W, ch, hull)
  }

  // ── Grid area (left/center) ───────────────────────────────────────────────

  private drawGridArea(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry): void {
    const ctx = this.ctx
    const placements = this.buildPlacements(hull)
    const occupied = this.occupiedCells(placements)

    // Grid geometry: center the grid in the available area
    const CW = Math.max(12, Math.floor((pw * 0.58) / GRID_COLS))   // cell width
    const CH = Math.max(10, Math.floor((ph * 0.86) / GRID_ROWS))   // cell height
    const gridW = CW * GRID_COLS
    const gridH = CH * GRID_ROWS
    const gx = px + (pw - gridW) / 2  // grid left edge
    const gy = py + (ph - gridH) / 2  // grid top edge

    // Hull half-dimensions in normalized coords → grid coords
    const hw = (GRID_COLS - 1) / 2     // 3.0
    const hh = (GRID_ROWS - 1) / 2     // 5.5

    // Hull background silhouette (draw first, behind grid)
    ctx.save()
    ctx.translate(gx + gridW / 2, gy + gridH / 2)
    ctx.beginPath()
    this.buildHullPath(ctx, 0, 0, CW * hw * 1.02, CH * hh * 1.02)
    ctx.fillStyle = '#0d1e12'
    ctx.fill()
    ctx.strokeStyle = '#2a4a30'; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()

    this.drawDeckStructure(gx, gy, CW, CH, hull)

    // Draw all grid cells
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cellX = gx + c * CW
        const cellY = gy + r * CH

        if (!this.isInsideHullCell(c, r)) {
          // Outside hull: skip (transparent)
          continue
        }

        const isOccupied = occupied.has(this.cellKey(c, r))
        if (isOccupied) {
          ctx.strokeStyle = 'rgba(30,60,36,0.30)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(cellX + 0.5, cellY + 0.5, CW - 1, CH - 1)
        } else {
          // Interior non-slot cell: faint grid line only
          const moveTarget = this.selectedSlotId || this.selectedTower
            ? this.moveTargetState(hull, c, r, placements)
            : 'none'
          if (moveTarget === 'valid') {
            ctx.fillStyle = 'rgba(184,148,32,0.14)'
            ctx.fillRect(cellX, cellY, CW, CH)
            ctx.strokeStyle = 'rgba(184,148,32,0.70)'
          } else if (moveTarget === 'far') {
            ctx.strokeStyle = 'rgba(80,70,32,0.45)'
          } else {
            ctx.strokeStyle = 'rgba(30,60,36,0.45)'
          }
          ctx.lineWidth = moveTarget === 'valid' ? 1 : 0.5
          ctx.strokeRect(cellX + 0.5, cellY + 0.5, CW - 1, CH - 1)
          if (moveTarget === 'valid') {
            this.addRegion({ tag: 'grid-empty', c, r, x: cellX, y: cellY, w: CW, h: CH })
          }
        }
      }
    }

    for (const placement of placements) {
      this.drawPlacement(gx, gy, CW, CH, placement)
    }

    // Centerline
    ctx.save(); ctx.setLineDash([5, 4])
    ctx.strokeStyle = 'rgba(80,150,90,0.30)'; ctx.lineWidth = 1
    const clx = gx + (GRID_COLS / 2) * CW
    ctx.beginPath(); ctx.moveTo(clx, gy); ctx.lineTo(clx, gy + gridH); ctx.stroke()
    ctx.setLineDash([]); ctx.restore()

    // Port / Starboard labels
    ctx.font = '9px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
    ctx.fillText('▲ 艦首', gx + gridW / 2, py + 14)
    ctx.fillText('▼ 艦尾', gx + gridW / 2, py + ph - 4)
    ctx.textAlign = 'right'; ctx.fillText('← 左舷', gx - 4, gy + gridH / 2 + 4)
    ctx.textAlign = 'left';  ctx.fillText('右舷 →', gx + gridW + 4, gy + gridH / 2 + 4)

    // Column & row guides (faint numbers)
    ctx.font = '7px sans-serif'; ctx.fillStyle = 'rgba(50,90,56,0.5)'; ctx.textAlign = 'center'
    for (let c = 0; c < GRID_COLS; c++) {
      ctx.fillText(`${c}`, gx + c * CW + CW / 2, gy - 3)
    }
    ctx.textAlign = 'right'
    for (let r = 0; r < GRID_ROWS; r++) {
      ctx.fillText(`${r}`, gx - 2, gy + r * CH + CH / 2 + 3)
    }
  }

  private drawPlacement(gx: number, gy: number, cw: number, ch: number, placement: Placement): void {
    const ctx = this.ctx
    const rect = this.footprintRect(placement.cell, placement.footprint)
    const x = gx + rect.left * cw
    const y = gy + rect.top * ch
    const w = rect.w * cw
    const h = rect.h * ch
    const isSel = placement.kind === 'tower' ? this.selectedTower : placement.id === this.selectedSlotId
    const isHov = placement.kind === 'tower'
      ? this.hovered?.tag === 'grid-tower'
      : this.hovered?.tag === 'grid-slot' && this.hovered.slotId === placement.id
    const col = isSel ? YELLOW : placement.color

    ctx.fillStyle = isHov ? col + '32' : col + '22'
    ctx.fillRect(x, y, w, h)
    ctx.lineWidth = isSel ? 2 : 1
    ctx.strokeStyle = col
    if (!placement.weapon && placement.kind === 'weapon') {
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore()
    } else {
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    }

    if (placement.kind === 'tower') {
      this.drawTowerShape(x, y, w, h, col)
      this.addRegion({ tag: 'grid-tower', x, y, w, h })
      return
    }

    this.drawWeaponShape(x, y, w, h, placement.weapon, placement.slot!, col)
    ctx.font = `bold ${Math.min(11, Math.max(7, cw * 0.55))}px sans-serif`
    ctx.fillStyle = placement.weapon ? '#e8f2e8' : DIM
    ctx.textAlign = 'center'
    const lbl = placement.weapon ? TYPE_JP[placement.weapon.type] : placement.slot!.label.slice(0, 3)
    ctx.fillText(lbl, x + w / 2, y + h + Math.min(10, ch * 0.72))
    this.addRegion({ tag: 'grid-slot', slotId: placement.id, x, y, w, h })
  }

  // ── Weapon palette (right) ────────────────────────────────────────────────

  private drawWeaponPalette(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry): void {
    const ctx = this.ctx

    // Hull title
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = TEXT; ctx.textAlign = 'left'
    ctx.fillText(hull.name, px + 10, py + 20)
    ctx.font = '10px sans-serif'; ctx.fillStyle = DIM
    ctx.fillText(hull.className, px + 10, py + 34)

    // Selected slot info
    const selSlot = hull.slots.find(s => s.id === this.selectedSlotId)
    const infoY = py + 46
    ctx.fillStyle = selSlot ? SEL : '#080e08'; ctx.fillRect(px + 6, infoY, pw - 12, 22)
    ctx.strokeStyle = selSlot ? '#3a9a4a' : '#1a3020'; ctx.lineWidth = 1
    ctx.strokeRect(px + 6, infoY, pw - 12, 22)
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
    if (selSlot) {
      ctx.fillStyle = '#90d090'
      ctx.fillText(`スロット: ${selSlot.label}`, px + 12, infoY + 15)
      const compat = selSlot.compatibleTypes.map(t => TYPE_JP[t] ?? t).join(' / ')
      ctx.fillStyle = DIM; ctx.textAlign = 'right'
      ctx.fillText(compat, px + pw - 12, infoY + 15)
    } else {
      ctx.fillStyle = DIM; ctx.fillText('グリッドのスロットを選択', px + 12, infoY + 15)
    }

    // Weapon type tabs
    const tabY = infoY + 28
    const tabW = (pw - 12) / TYPE_TABS.length
    for (let i = 0; i < TYPE_TABS.length; i++) {
      const t = TYPE_TABS[i]!; const tx = px + 6 + i * tabW
      const active = this.weaponFilter === t.filter
      ctx.fillStyle = active ? ACCENT : '#0c1810'; ctx.fillRect(tx, tabY, tabW, 22)
      ctx.strokeStyle = active ? '#3a9a4a' : '#1a3020'; ctx.lineWidth = 1; ctx.strokeRect(tx, tabY, tabW, 22)
      ctx.font = `${active ? 'bold ' : ''}9px sans-serif`
      ctx.fillStyle = active ? '#cce8cc' : DIM; ctx.textAlign = 'center'
      ctx.fillText(t.label, tx + tabW / 2, tabY + 15)
      this.addRegion({ tag: 'type-tab', filter: t.filter, x: tx, y: tabY, w: tabW, h: 22 })
    }

    // Weapon cards
    const listY = tabY + 28
    const listH = ph - (listY - py) - 6
    const cardH = 52, cardW = pw - 12
    let cy = listY

    // Determine which weapons to show
    const showAll = !selSlot
    const weapons = WEAPON_SHOP.filter(w => {
      if (w.minStage > this.stage) return false
      if (this.weaponFilter !== 'all' && w.type !== this.weaponFilter) return false
      if (!showAll && !selSlot!.compatibleTypes.includes(w.type)) return false
      return true
    })

    // Clip to list area
    ctx.save(); ctx.beginPath(); ctx.rect(px, listY, pw, listH); ctx.clip()

    for (const w of weapons) {
      if (cy + cardH > listY + listH) break
      const isCur = selSlot ? this.slotWeapons.get(selSlot.id)?.id === w.id : false
      const isHov = this.hovered?.tag === 'weapon-card' && this.hovered.weaponId === w.id
      const compatible = !selSlot || selSlot.compatibleTypes.includes(w.type)
      const wCol = TYPE_COLOR[w.type] ?? DIM

      ctx.fillStyle = isCur ? '#0a2a14' : isHov && compatible ? '#0f1e12' : '#080e08'
      ctx.fillRect(px + 6, cy, cardW, cardH)
      ctx.strokeStyle = isCur ? '#3a9a4a' : compatible ? '#1e3824' : '#0f1810'
      ctx.lineWidth = isCur ? 1.5 : 1
      ctx.strokeRect(px + 6, cy, cardW, cardH)

      // Type badge
      ctx.fillStyle = wCol + '30'; ctx.fillRect(px + 8, cy + 4, 30, cardH - 8)
      ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = wCol; ctx.textAlign = 'center'
      ctx.fillText(TYPE_JP[w.type]!, px + 23, cy + cardH / 2 + 3)

      // Name and desc
      ctx.font = `bold 10px sans-serif`
      ctx.fillStyle = compatible ? TEXT : DIM; ctx.textAlign = 'left'
      ctx.fillText(w.name, px + 44, cy + 16)
      ctx.font = '9px sans-serif'; ctx.fillStyle = '#3a5a3a'
      ctx.fillText(w.desc, px + 44, cy + 28)
      ctx.fillStyle = DIM; ctx.fillText(`弾数: ${w.ammo}`, px + 44, cy + 41)

      if (isCur) {
        ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#3a9a4a'; ctx.textAlign = 'right'
        ctx.fillText('✓ 装備中', px + pw - 10, cy + 20)
      } else if (compatible && selSlot) {
        const bx = px + pw - 40
        ctx.fillStyle = isHov ? ACCENT : '#0f2414'; ctx.fillRect(bx, cy + 8, 34, 18)
        ctx.strokeStyle = '#2a6a30'; ctx.lineWidth = 1; ctx.strokeRect(bx, cy + 8, 34, 18)
        ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#a0d0a0'; ctx.textAlign = 'center'
        ctx.fillText('装備', bx + 17, cy + 20)
      }

      if (compatible && selSlot) {
        this.addRegion({ tag: 'weapon-card', weaponId: w.id, x: px + 6, y: cy, w: cardW, h: cardH })
      }
      cy += cardH + 4
    }

    if (weapons.length === 0) {
      ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
      ctx.fillText('該当なし', px + pw / 2, listY + 30)
    }
    ctx.restore()
  }

  // ── Stats bar ─────────────────────────────────────────────────────────────

  private renderStatsBar(x: number, y: number, cw: number, ch: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#080f08'; ctx.fillRect(x, y, cw, ch)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.stroke()

    const hull = this.selectedHull()
    if (!hull) {
      ctx.font = '12px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
      ctx.fillText('艦体を選択してください', x + cw / 2, y + ch / 2 + 4)
      return
    }

    const stats = [
      { label: '耐久力', value: `${hull.hp}`,                     barR: hull.hp / 2100,       col: '#22c55e' },
      { label: '速力',   value: `${hull.maxSpeed.toFixed(1)}kt`,  barR: hull.maxSpeed / 7.2,  col: '#38bdf8' },
      { label: '旋回',   value: `${(hull.turnRate * 1000 | 0) / 10}`, barR: hull.turnRate / 0.046, col: '#fb923c' },
      { label: '索敵',   value: `${hull.hp > 1000 ? 40 : 50}nm`, barR: 0.65,                 col: '#a78bfa' },
    ]

    const colW = (cw * 0.74) / stats.length
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!; const sx = x + colW * i + 14
      ctx.font = '9px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
      ctx.fillText(s.label, sx, y + 14)
      const bw = colW - 22
      ctx.fillStyle = '#0a1810'; ctx.fillRect(sx, y + 18, bw, 6)
      ctx.fillStyle = s.col; ctx.fillRect(sx, y + 18, bw * Math.min(1, s.barR), 6)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#b0d8b0'
      ctx.fillText(s.value, sx, y + 44)
    }

    const filled = this.slotWeapons.size
    ctx.font = '9px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'right'
    ctx.fillText('兵装', cw - 14, y + 14)
    ctx.font = `bold 15px sans-serif`
    ctx.fillStyle = filled === hull.slots.length ? GREEN : YELLOW
    ctx.fillText(`${filled} / ${hull.slots.length}`, cw - 14, y + 44)
  }

  // ── Button bar ────────────────────────────────────────────────────────────

  private renderButtons(x: number, y: number, cw: number, ch: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#060c06'; ctx.fillRect(x, y, cw, ch)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.stroke()

    if (this.tab === 'armament') {
      this.drawBtn(x + 12, y + 5, 108, ch - 10, '← 艦体選択', PANEL, TEXT, 12)
      this.addRegion({ tag: 'back', x: x + 12, y: y + 5, w: 108, h: ch - 10 })
    }
    if (this.tab === 'hull' && this.selectedHull()) {
      this.drawBtn(x + 12, y + 5, 118, ch - 10, '兵装配置 →', ACCENT, '#cceccc', 12)
      this.addRegion({ tag: 'main-tab', tab: 'armament', x: x + 12, y: y + 5, w: 118, h: ch - 10 })
    }

    const hull = this.selectedHull()
    const bw = 176, bx2 = x + cw - bw - 12
    this.drawBtn(bx2, y + 5, bw, ch - 10, '出撃準備完了 →', hull ? GREEN : '#0a1810', hull ? '#fff' : DIM, 13)
    if (hull) this.addRegion({ tag: 'deploy', x: bx2, y: y + 5, w: bw, h: ch - 10 })
  }

  // ── Drawing utilities ─────────────────────────────────────────────────────

  private drawShipTopDown(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, hull: HullCatalogEntry, locked: boolean): void {
    ctx.beginPath(); this.buildHullPath(ctx, cx, cy, hw, hh)
    ctx.fillStyle = locked ? '#090f0a'
      : hull.shipType === 'destroyer'  ? '#0d1e12'
      : hull.shipType === 'cruiser'    ? '#112018'
      : '#162a1c'
    ctx.fill(); ctx.strokeStyle = locked ? '#1a2a1a' : BORDER; ctx.lineWidth = 1; ctx.stroke()
    ctx.strokeStyle = locked ? '#152015' : 'rgba(170,210,170,0.22)'
    ctx.beginPath(); ctx.moveTo(cx, cy - hh * 0.82); ctx.lineTo(cx, cy + hh * 0.72); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - hw * 0.36, cy - hh * 0.20); ctx.lineTo(cx + hw * 0.36, cy - hh * 0.20); ctx.stroke()
    const towerW = hull.shipType === 'battleship' ? hw * 0.42 : hw * 0.32
    const towerH = hull.shipType === 'destroyer' ? hh * 0.15 : hh * 0.20
    ctx.fillStyle = locked ? '#101a10' : '#243827'
    ctx.fillRect(cx - towerW / 2, cy - towerH * 0.2, towerW, towerH)
    ctx.strokeStyle = locked ? '#1a2a1a' : '#d6b86a'
    ctx.strokeRect(cx - towerW / 2, cy - towerH * 0.2, towerW, towerH)
    for (const slot of hull.slots) {
      const sx = cx + slot.x * hw * 0.82
      const sy = cy + slot.y * hh * 0.88
      ctx.beginPath(); ctx.ellipse(sx, sy, 3.2, 2.1, 0, 0, Math.PI * 2)
      ctx.fillStyle = locked ? DIM : (TYPE_COLOR[slot.compatibleTypes[0]!] ?? '#2a6a3a'); ctx.fill()
    }
  }

  private buildHullPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
    const steps = 56
    ctx.moveTo(cx, cy - hh)
    for (let i = 0; i <= steps; i++) {
      const ny = -1 + (2 / steps) * i
      ctx.lineTo(cx + this.hullMaxHW(ny) * hw, cy + ny * hh)
    }
    for (let i = steps; i >= 0; i--) {
      const ny = -1 + (2 / steps) * i
      ctx.lineTo(cx - this.hullMaxHW(ny) * hw, cy + ny * hh)
    }
    ctx.closePath()
  }

  private hullMaxHW(ny: number): number {
    if (ny < -0.82) return Math.max(0.02, (ny + 1) / 0.18 * 0.38)
    if (ny < -0.48) return 0.38 + (ny + 0.82) / 0.34 * 0.62
    if (ny < 0.50) return 1.0 - Math.abs(ny - 0.02) * 0.07
    if (ny < 0.86) return 0.94 - (ny - 0.50) / 0.36 * 0.20
    return 0.74 - (ny - 0.86) / 0.14 * 0.18
  }

  private currentSlotCell(slot: HullSlot): { c: number; r: number } {
    return this.slotCells.get(slot.id) ?? slotCell(slot)
  }

  private moveTargetState(hull: HullCatalogEntry, c: number, r: number, placements: Placement[]): 'none' | 'far' | 'valid' {
    if (!this.isInsideHullCell(c, r)) return 'none'
    if (this.selectedTower) return this.canMoveTowerTo(c, r, hull, placements) ? 'valid' : 'far'
    const slot = hull.slots.find(s => s.id === this.selectedSlotId)
    if (!slot) return 'none'
    return this.canMoveSlotTo(slot, c, r, hull, placements) ? 'valid' : 'far'
  }

  private canMoveSlotTo(slot: HullSlot, c: number, r: number, hull: HullCatalogEntry, placements = this.buildPlacements(hull)): boolean {
    if (!this.isInsideHullCell(c, r)) return false
    const home = slotCell(slot)
    const dc = c - home.c
    const dr = r - home.r
    if (Math.sqrt(dc * dc + dr * dr) > MAX_SLOT_MOVE_CELLS) return false
    const existing = placements.find(p => p.id === slot.id && p.kind === 'weapon')
    if (!existing) return false
    return this.canPlaceFootprint({ c, r }, existing.footprint, placements, slot.id)
  }

  private canMoveTowerTo(c: number, r: number, hull: HullCatalogEntry, placements = this.buildPlacements(hull)): boolean {
    const home = this.defaultTowerCell(hull)
    const dc = c - home.c
    const dr = r - home.r
    if (Math.sqrt(dc * dc + dr * dr) > MAX_SLOT_MOVE_CELLS) return false
    return this.canPlaceFootprint({ c, r }, this.towerFootprint(hull), placements, 'tower')
  }

  private isInsideHullCell(c: number, r: number): boolean {
    const hw = (GRID_COLS - 1) / 2
    const hh = (GRID_ROWS - 1) / 2
    const nx = (c - hw) / hw
    const ny = (r - hh) / hh
    return Math.abs(nx) <= this.hullMaxHW(ny) * 0.98
  }

  private canPlaceFootprint(cell: GridCell, footprint: Footprint, placements: Placement[], ignoreId: string): boolean {
    const rect = this.footprintRect(cell, footprint)
    for (let r = rect.top; r < rect.top + rect.h; r++) {
      for (let c = rect.left; c < rect.left + rect.w; c++) {
        if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS || !this.isInsideHullCell(c, r)) return false
      }
    }

    for (const placement of placements) {
      if (placement.id === ignoreId) continue
      if (this.rectsOverlap(rect, this.footprintRect(placement.cell, placement.footprint))) return false
    }
    return true
  }

  private occupiedCells(placements: Placement[]): Set<string> {
    const cells = new Set<string>()
    for (const placement of placements) {
      const rect = this.footprintRect(placement.cell, placement.footprint)
      for (let r = rect.top; r < rect.top + rect.h; r++) {
        for (let c = rect.left; c < rect.left + rect.w; c++) cells.add(this.cellKey(c, r))
      }
    }
    return cells
  }

  private footprintRect(cell: GridCell, footprint: Footprint): { left: number; top: number; w: number; h: number } {
    return {
      left: cell.c - Math.floor(footprint.w / 2),
      top: cell.r - Math.floor(footprint.h / 2),
      w: footprint.w,
      h: footprint.h,
    }
  }

  private rectsOverlap(a: { left: number; top: number; w: number; h: number }, b: { left: number; top: number; w: number; h: number }): boolean {
    return a.left < b.left + b.w && a.left + a.w > b.left && a.top < b.top + b.h && a.top + a.h > b.top
  }

  private cellKey(c: number, r: number): string {
    return `${c},${r}`
  }

  private drawDeckStructure(gx: number, gy: number, cw: number, ch: number, hull: HullCatalogEntry): void {
    const ctx = this.ctx
    const gridW = cw * GRID_COLS
    const gridH = ch * GRID_ROWS
    const cx = gx + gridW / 2
    ctx.save()
    ctx.strokeStyle = 'rgba(151,191,151,0.16)'
    ctx.lineWidth = 1
    for (const xMul of [-0.28, 0, 0.28]) {
      ctx.beginPath()
      ctx.moveTo(cx + xMul * gridW * 0.35, gy + gridH * 0.10)
      ctx.lineTo(cx + xMul * gridW * 0.25, gy + gridH * 0.90)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(151,191,151,0.11)'
    for (const yMul of [0.18, 0.34, 0.52, 0.70, 0.84]) {
      const half = this.hullMaxHW(yMul * 2 - 1) * gridW * 0.45
      ctx.beginPath()
      ctx.moveTo(cx - half, gy + gridH * yMul)
      ctx.lineTo(cx + half, gy + gridH * yMul)
      ctx.stroke()
    }
    if (hull.shipType !== 'destroyer') {
      ctx.fillStyle = 'rgba(120,155,130,0.12)'
      ctx.fillRect(cx - cw * 2.5, gy + gridH * 0.39, cw * 5, ch * 3)
      ctx.strokeStyle = 'rgba(190,220,190,0.18)'
      ctx.strokeRect(cx - cw * 2.5, gy + gridH * 0.39, cw * 5, ch * 3)
    }
    ctx.restore()
  }

  private drawTowerShape(x: number, y: number, w: number, h: number, col: string): void {
    const ctx = this.ctx
    const cx = x + w / 2
    ctx.fillStyle = '#16251c'
    ctx.fillRect(x + w * 0.22, y + h * 0.20, w * 0.56, h * 0.62)
    ctx.strokeStyle = col
    ctx.strokeRect(x + w * 0.22, y + h * 0.20, w * 0.56, h * 0.62)

    ctx.fillStyle = '#243827'
    ctx.fillRect(x + w * 0.12, y + h * 0.30, w * 0.76, h * 0.20)
    ctx.fillRect(x + w * 0.30, y + h * 0.05, w * 0.40, h * 0.18)
    ctx.strokeStyle = 'rgba(240,220,150,0.70)'
    ctx.beginPath()
    ctx.moveTo(cx, y + h * 0.05)
    ctx.lineTo(cx, y - h * 0.14)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.28, y + h * 0.18)
    ctx.lineTo(cx + w * 0.28, y + h * 0.18)
    ctx.stroke()
  }

  private drawWeaponShape(x: number, y: number, w: number, h: number, weapon: ShopWeapon | undefined, slot: HullSlot, col: string): void {
    const type = weapon?.type ?? slot.compatibleTypes[0]
    if (type === 'gun' || type === 'secondary') {
      this.drawGunShape(x, y, w, h, weapon, col)
    } else if (type === 'torpedo') {
      this.drawTorpedoShape(x, y, w, h, col)
    } else if (type === 'aa') {
      this.drawAaShape(x, y, w, h, col)
    } else if (type === 'missile') {
      this.drawMissileShape(x, y, w, h, col)
    }
  }

  private drawGunShape(x: number, y: number, w: number, h: number, weapon: ShopWeapon | undefined, col: string): void {
    const ctx = this.ctx
    const heavy = weapon?.id.includes('406mm') || weapon?.id.includes('460mm')
    const barrelCount = weapon?.id.includes('single') ? 1 : 2
    const cx = x + w / 2
    const cy = y + h / 2
    const r = Math.min(w, h) * (heavy ? 0.30 : 0.25)
    ctx.fillStyle = '#172018'
    ctx.beginPath()
    ctx.ellipse(cx, cy, r * 1.15, r * 0.82, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = col
    ctx.stroke()
    ctx.strokeStyle = '#d7d3b8'
    ctx.lineWidth = Math.max(1, h * 0.08)
    for (let i = 0; i < barrelCount; i++) {
      const bx = cx + (i - (barrelCount - 1) / 2) * r * 0.5
      ctx.beginPath()
      ctx.moveTo(bx, cy - r * 0.25)
      ctx.lineTo(bx, y + h * 0.06)
      ctx.stroke()
    }
  }

  private drawTorpedoShape(x: number, y: number, w: number, h: number, col: string): void {
    const ctx = this.ctx
    const tubes = w > h * 3 ? 4 : 3
    ctx.strokeStyle = col
    ctx.lineWidth = Math.max(1, h * 0.12)
    for (let i = 0; i < tubes; i++) {
      const yy = y + h * (0.32 + i * 0.12)
      ctx.beginPath()
      ctx.moveTo(x + w * 0.12, yy)
      ctx.lineTo(x + w * 0.88, yy)
      ctx.stroke()
    }
    ctx.strokeRect(x + w * 0.08, y + h * 0.24, w * 0.84, h * 0.52)
  }

  private drawAaShape(x: number, y: number, w: number, h: number, col: string): void {
    const ctx = this.ctx
    const cx = x + w / 2
    const cy = y + h / 2
    ctx.fillStyle = '#13251b'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = col
    ctx.stroke()
    ctx.strokeStyle = '#d7f5df'
    ctx.lineWidth = 1
    for (const a of [-0.5, 0.5]) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.sin(a) * w * 0.28, cy - h * 0.34)
      ctx.stroke()
    }
  }

  private drawMissileShape(x: number, y: number, w: number, h: number, col: string): void {
    const ctx = this.ctx
    const cols = w > h ? 3 : 2
    const rows = 2
    ctx.strokeStyle = col
    ctx.strokeRect(x + w * 0.14, y + h * 0.16, w * 0.72, h * 0.68)
    ctx.fillStyle = col + '88'
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(x + w * (0.24 + c * 0.20), y + h * (0.30 + r * 0.24), w * 0.10, h * 0.12)
      }
    }
  }

  private drawStatBar(x: number, y: number, w: number, label: string, ratio: number, barColor: string, value: string, locked: boolean): void {
    const ctx = this.ctx
    ctx.font = '10px sans-serif'; ctx.fillStyle = locked ? DIM : '#4a7a4a'; ctx.textAlign = 'left'
    ctx.fillText(label, x, y + 10)
    ctx.fillStyle = '#0a1810'; ctx.fillRect(x + 36, y, w - 82, 10)
    ctx.fillStyle = locked ? DIM : barColor; ctx.fillRect(x + 36, y, (w - 82) * Math.min(1, ratio), 10)
    ctx.font = '10px sans-serif'; ctx.fillStyle = locked ? DIM : TEXT; ctx.textAlign = 'right'
    ctx.fillText(value, x + w, y + 10)
  }

  private drawBtn(x: number, y: number, w: number, h: number, label: string, bg: string, fg: string, fs = 13): void {
    const ctx = this.ctx
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = (fg === '#fff' || fg === '#cceccc') ? '#3a9a4a' : BORDER
    ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h)
    ctx.font = `bold ${fs}px sans-serif`; ctx.fillStyle = fg; ctx.textAlign = 'center'
    ctx.fillText(label, x + w / 2, y + h / 2 + fs * 0.37)
  }

  private addRegion(r: Region): void { this.regions.push(r) }

  private hitRegion(e: MouseEvent): Region | null {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i]!
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r
    }
    return null
  }

  private onMouseMove(e: MouseEvent): void { this.hovered = this.hitRegion(e) }
}
