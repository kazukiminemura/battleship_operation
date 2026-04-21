import type { WeaponTemplate } from '../data/masterdata'
import type { PlayerShipType } from '../data/masterdata'
import { getHullsByClass, type HullCatalogEntry, type HullSlot } from '../data/hull-catalog'
import { WEAPON_SHOP, TYPE_COLOR, TYPE_JP, getAvailableWeapons, calcStartingCredits, type ShopWeapon } from '../data/weapon-shop'
import type { WeaponType } from '../simulation/types'

export interface PrepResult {
  templateId: string
  shipType: PlayerShipType
  loadout: WeaponTemplate[]
}

type PrepPhase = 'hull' | 'shop' | 'placement'

interface FreePlacement {
  uid: number
  weapon: ShopWeapon
  nx: number  // -1 (port) to 1 (starboard)
  ny: number  // -1 (bow) to 1 (stern)
}

interface DiagBounds { cx: number; cy: number; hw: number; hh: number }

type Region =
  | { tag: 'class-tab';     shipType: PlayerShipType;      x: number; y: number; w: number; h: number }
  | { tag: 'hull-card';     index: number;                  x: number; y: number; w: number; h: number }
  | { tag: 'type-tab';      weaponType: WeaponType | 'all'; x: number; y: number; w: number; h: number }
  | { tag: 'shop-item';     weaponId: string;               x: number; y: number; w: number; h: number }
  | { tag: 'inventory-item';idx: number;                    x: number; y: number; w: number; h: number }
  | { tag: 'fixed-slot';    slotId: string;                 x: number; y: number; w: number; h: number }
  | { tag: 'placed-weapon'; uid: number;                    x: number; y: number; w: number; h: number }
  | { tag: 'hull-area';     cx: number; cy: number; hw: number; hh: number; x: number; y: number; w: number; h: number }
  | { tag: 'next';                                           x: number; y: number; w: number; h: number }
  | { tag: 'back';                                           x: number; y: number; w: number; h: number }
  | { tag: 'deploy';                                         x: number; y: number; w: number; h: number }

const CLASS_TABS: { type: PlayerShipType; label: string }[] = [
  { type: 'destroyer',  label: '駆逐艦' },
  { type: 'cruiser',    label: '巡洋艦' },
  { type: 'battleship', label: '戦艦' },
]

const SHOP_TYPE_TABS: { type: WeaponType | 'all'; label: string }[] = [
  { type: 'all',       label: '全部' },
  { type: 'gun',       label: '主砲' },
  { type: 'secondary', label: '副砲' },
  { type: 'torpedo',   label: '魚雷' },
  { type: 'aa',        label: '対空' },
  { type: 'missile',   label: 'ミサイル' },
]

const PANEL   = '#101828'
const BORDER  = '#1e3a5f'
const TEXT    = '#c8d8f0'
const DIM     = '#4a6080'
const ACCENT  = '#2563eb'
const GREEN   = '#16a34a'
const LOCKED  = '#1a2030'

// Minimum spacing (normalized) between guns on centerline
const GUN_MIN_SPACING = 0.22
// Minimum distance (normalized) between any two free placements
const FREE_MIN_SPACING = 0.14
// Centerline snap zone: |nx| must be within this to place a gun
const CENTERLINE_ZONE = 0.15

export class PrepScreen {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions: Region[] = []
  private hovered: Region | null = null
  private onMoveRef: (e: MouseEvent) => void

  private phase: PrepPhase = 'hull'
  private stage = 1
  private selectedClass: PlayerShipType = 'destroyer'
  private selectedHullIndex = 0
  private credits = 0
  private inventory: ShopWeapon[] = []

  // Placement state
  private fixedAssignments = new Map<string, ShopWeapon>()  // slotId → weapon (torpedo/secondary)
  private freePlacements: FreePlacement[] = []               // gun/missile/aa free positions
  private uidCounter = 0
  private selectedInventoryIdx = -1

  // Shop state
  private shopTypeFilter: WeaponType | 'all' = 'all'

  // Mouse tracking for placement preview
  private pmouseX = 0
  private pmouseY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onMoveRef = (e) => this.onMouseMove(e)
  }

  attach(stage: number): void {
    this.stage = stage
    this.phase = 'hull'
    this.selectedClass = 'destroyer'
    this.selectedHullIndex = 0
    this.credits = calcStartingCredits(stage)
    this.inventory = []
    this.fixedAssignments = new Map()
    this.freePlacements = []
    this.uidCounter = 0
    this.selectedInventoryIdx = -1
    this.shopTypeFilter = 'all'
    this.canvas.addEventListener('mousemove', this.onMoveRef)
  }

  detach(): void {
    this.canvas.removeEventListener('mousemove', this.onMoveRef)
    this.hovered = null
  }

  // ── Click handling ──────────────────────────────────────────────────────

  checkClick(e: MouseEvent): PrepResult | null {
    const r = this.hitRegion(e)
    if (!r) return null

    // Phase 1: hull selection
    if (r.tag === 'class-tab') {
      this.selectedClass = r.shipType
      this.selectedHullIndex = 0
      return null
    }
    if (r.tag === 'hull-card') {
      const hull = getHullsByClass(this.selectedClass)[r.index]
      if (hull && hull.minStage <= this.stage) this.selectedHullIndex = r.index
      return null
    }
    if (r.tag === 'next' && this.phase === 'hull') {
      this.phase = 'shop'
      this.inventory = []
      this.fixedAssignments = new Map()
      this.freePlacements = []
      return null
    }

    // Phase 2: shop
    if (r.tag === 'type-tab') {
      this.shopTypeFilter = r.weaponType
      return null
    }
    if (r.tag === 'shop-item') {
      const weapon = WEAPON_SHOP.find(w => w.id === r.weaponId)
      if (!weapon || weapon.minStage > this.stage) return null
      if (this.credits < weapon.cost) return null
      const hull = this.selectedHull()
      if (!hull || this.inventory.length >= hull.slots.length) return null
      this.credits -= weapon.cost
      this.inventory.push({ ...weapon })
      return null
    }
    if (r.tag === 'inventory-item' && this.phase === 'shop') {
      const weapon = this.inventory[r.idx]
      if (!weapon) return null
      // Refund purchased weapon
      const assignedSlot = [...this.fixedAssignments.entries()].find(([, w]) => w === weapon)
      if (assignedSlot) this.fixedAssignments.delete(assignedSlot[0])
      const freeIdx = this.freePlacements.findIndex(p => p.weapon === weapon)
      if (freeIdx >= 0) this.freePlacements.splice(freeIdx, 1)
      this.credits += weapon.cost
      this.inventory.splice(r.idx, 1)
      if (this.selectedInventoryIdx >= this.inventory.length) this.selectedInventoryIdx = -1
      return null
    }
    if (r.tag === 'next' && this.phase === 'shop') {
      this.phase = 'placement'
      this.selectedInventoryIdx = -1
      return null
    }
    if (r.tag === 'back' && this.phase === 'shop') {
      this.phase = 'hull'
      return null
    }

    // Phase 3: placement
    if (this.phase === 'placement') {
      if (r.tag === 'inventory-item') {
        this.selectedInventoryIdx = this.selectedInventoryIdx === r.idx ? -1 : r.idx
        return null
      }

      if (r.tag === 'placed-weapon') {
        // Remove free placement
        const idx = this.freePlacements.findIndex(p => p.uid === r.uid)
        if (idx >= 0) this.freePlacements.splice(idx, 1)
        this.selectedInventoryIdx = -1
        return null
      }

      if (r.tag === 'fixed-slot') {
        const existing = this.fixedAssignments.get(r.slotId)
        if (existing) {
          // Unassign
          this.fixedAssignments.delete(r.slotId)
        } else {
          // Assign selected inventory weapon if compatible
          const unassigned = this.inventoryUnassigned()
          const weapon = unassigned[this.selectedInventoryIdx]
          if (weapon) {
            const hull = this.selectedHull()
            const slot = hull?.slots.find(s => s.id === r.slotId)
            if (slot && slot.compatibleTypes.includes(weapon.type)) {
              this.fixedAssignments.set(r.slotId, weapon)
              this.selectedInventoryIdx = -1
            }
          }
        }
        return null
      }

      if (r.tag === 'hull-area') {
        const rect = this.canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const nx = (mx - r.cx) / r.hw
        const ny = (my - r.cy) / r.hh
        const unassigned = this.inventoryUnassigned()
        const weapon = unassigned[this.selectedInventoryIdx]
        if (!weapon) return null

        if (weapon.type === 'gun') {
          // Must be on centerline
          if (Math.abs(nx) > CENTERLINE_ZONE) return null
          if (!this.isInsideHull(0, ny)) return null
          if (!this.canPlaceGun(ny)) return null
          if (!this.hasGunCapacity()) return null
          this.freePlacements.push({ uid: this.uidCounter++, weapon, nx: 0, ny })
          this.selectedInventoryIdx = -1
        } else if (weapon.type === 'missile' || weapon.type === 'aa') {
          if (!this.isInsideHull(nx, ny)) return null
          if (!this.canPlaceFree(nx, ny)) return null
          this.freePlacements.push({ uid: this.uidCounter++, weapon, nx, ny })
          this.selectedInventoryIdx = -1
        }
        // torpedo/secondary: must use fixed slots
        return null
      }

      if (r.tag === 'back') {
        this.phase = 'shop'
        this.selectedInventoryIdx = -1
        return null
      }

      if (r.tag === 'deploy') {
        const hull = this.selectedHull()
        if (!hull) return null
        const loadout: WeaponTemplate[] = []
        // Free placements (gun/missile/aa) sorted bow→stern
        const sorted = [...this.freePlacements].sort((a, b) => a.ny - b.ny)
        for (const p of sorted) {
          loadout.push({ id: p.weapon.id, name: p.weapon.name, type: p.weapon.type, ammo: p.weapon.ammo })
        }
        // Fixed slot assignments (torpedo/secondary)
        for (const slot of this.getFixedSlots(hull)) {
          const w = this.fixedAssignments.get(slot.id)
          if (w) loadout.push({ id: w.id, name: w.name, type: w.type, ammo: w.ammo })
        }
        return { templateId: hull.templateId, shipType: hull.shipType, loadout }
      }
    }

    return null
  }

  render(): void {
    const cw = this.canvas.width
    const ch = this.canvas.height
    this.regions = []
    this.drawBackground(cw, ch)
    this.drawPhaseBar(cw)
    if (this.phase === 'hull')           this.renderHullPhase(cw, ch)
    else if (this.phase === 'shop')      this.renderShopPhase(cw, ch)
    else                                 this.renderPlacementPhase(cw, ch)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private selectedHull(): HullCatalogEntry | null {
    return getHullsByClass(this.selectedClass)[this.selectedHullIndex] ?? null
  }

  private inventoryUnassigned(): ShopWeapon[] {
    const usedFree = new Set(this.freePlacements.map(p => p.weapon))
    const usedFixed = new Set(this.fixedAssignments.values())
    return this.inventory.filter(w => !usedFree.has(w) && !usedFixed.has(w))
  }

  private totalPlaced(): number {
    return this.freePlacements.length + this.fixedAssignments.size
  }

  private getFixedSlots(hull: HullCatalogEntry): HullSlot[] {
    return hull.slots.filter(s =>
      s.compatibleTypes.every(t => t === 'torpedo' || t === 'secondary')
    )
  }

  // Hull boundary: normalized x limit at given normalized y
  private hullMaxHW(ny: number): number {
    if (ny < -0.55) return Math.max(0, (ny + 1) / 0.45)
    if (ny > 0.58)  return Math.max(0.4, 1 - (ny - 0.58) / 0.42 * 0.35)
    return 1.0
  }

  private isInsideHull(nx: number, ny: number): boolean {
    return ny >= -0.95 && ny <= 0.95 && Math.abs(nx) <= this.hullMaxHW(ny)
  }

  private canPlaceGun(ny: number): boolean {
    return this.freePlacements
      .filter(p => p.weapon.type === 'gun')
      .every(p => Math.abs(p.ny - ny) >= GUN_MIN_SPACING)
  }

  private hasGunCapacity(): boolean {
    const hull = this.selectedHull()
    if (!hull) return false
    const cap = hull.slots.filter(s => s.compatibleTypes.includes('gun')).length
    return this.freePlacements.filter(p => p.weapon.type === 'gun').length < cap
  }

  private canPlaceFree(nx: number, ny: number): boolean {
    return this.freePlacements.every(
      p => Math.hypot(p.nx - nx, p.ny - ny) >= FREE_MIN_SPACING
    )
  }

  private getDiagBounds(cw: number, ch: number): DiagBounds {
    const hh = Math.min(210, (ch - 230) / 2)
    const hw = hh * 0.44
    const cx = cw * 0.40
    const cy = 44 + 18 + hh
    return { cx, cy, hw, hh }
  }

  // ── Background ───────────────────────────────────────────────────────────

  private drawBackground(cw: number, ch: number): void {
    const ctx = this.ctx
    const grad = ctx.createLinearGradient(0, 0, 0, ch)
    grad.addColorStop(0, '#06090f')
    grad.addColorStop(1, '#0a1525')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)
    ctx.strokeStyle = 'rgba(30,58,95,0.2)'
    ctx.lineWidth = 1
    for (let x = 0; x < cw; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke() }
    for (let y = 0; y < ch; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke() }
  }

  private drawPhaseBar(cw: number): void {
    const ctx = this.ctx
    const phases = ['1 艦体選択', '2 兵装購入', '3 兵装配置']
    const phaseIdx = this.phase === 'hull' ? 0 : this.phase === 'shop' ? 1 : 2
    const barH = 44
    ctx.fillStyle = 'rgba(10,15,26,0.9)'
    ctx.fillRect(0, 0, cw, barH)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, barH); ctx.lineTo(cw, barH); ctx.stroke()
    const tabW = 220, startX = (cw - tabW * 3) / 2
    for (let i = 0; i < 3; i++) {
      const tx = startX + i * tabW
      const active = i === phaseIdx, done = i < phaseIdx
      ctx.fillStyle = active ? ACCENT : done ? '#1a3a6f' : PANEL
      ctx.fillRect(tx + 4, 4, tabW - 8, barH - 8)
      ctx.font = `bold ${active ? 15 : 13}px sans-serif`
      ctx.fillStyle = active ? '#fff' : done ? '#7ab' : DIM
      ctx.textAlign = 'center'
      ctx.fillText(phases[i]!, tx + tabW / 2, 27)
    }
  }

  // ── Phase 1: Hull Selection ───────────────────────────────────────────────

  private renderHullPhase(cw: number, ch: number): void {
    const ctx = this.ctx
    const topY = 54

    // Class tabs
    const tabW = 100, tabH = 50, tabX = 20
    for (let i = 0; i < CLASS_TABS.length; i++) {
      const tab = CLASS_TABS[i]!
      const ty = topY + 20 + i * 58
      const active = tab.type === this.selectedClass
      this.drawBtn(tabX, ty, tabW, tabH, tab.label, active ? ACCENT : PANEL, active ? '#fff' : TEXT, 14)
      this.addRegion({ tag: 'class-tab', shipType: tab.type, x: tabX, y: ty, w: tabW, h: tabH })
    }

    // Hull cards
    const hulls = getHullsByClass(this.selectedClass)
    const cardW = Math.min(280, (cw - 160) / 3 - 20)
    const cardH = Math.min(340, ch - topY - 80)
    const totalW = hulls.length * (cardW + 20) - 20
    const startX = 140 + (cw - 140 - totalW) / 2
    const cardsY = topY + (ch - topY - 60 - cardH) / 2

    for (let i = 0; i < hulls.length; i++) {
      const hull = hulls[i]!
      const cx2 = startX + i * (cardW + 20)
      const locked = hull.minStage > this.stage
      const selected = i === this.selectedHullIndex && !locked
      this.drawHullCard(ctx, cx2, cardsY, cardW, cardH, hull, locked, selected)
      if (!locked) this.addRegion({ tag: 'hull-card', index: i, x: cx2, y: cardsY, w: cardW, h: cardH })
    }

    // Credits display
    ctx.font = '13px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
    ctx.fillText('出撃準備資金:', 20, ch - 28)
    ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#fbbf24'
    ctx.fillText(`¥ ${this.credits.toLocaleString()}`, 130, ch - 24)

    // Next button
    const hull = this.selectedHull()
    const canNext = hull !== null && hull.minStage <= this.stage
    const bx = cw - 180, by = ch - 56
    this.drawBtn(bx, by, 160, 42, '兵装購入へ  →', canNext ? ACCENT : LOCKED, canNext ? '#fff' : DIM, 15)
    if (canNext) this.addRegion({ tag: 'next', x: bx, y: by, w: 160, h: 42 })
  }

  private drawHullCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, hull: HullCatalogEntry, locked: boolean, selected: boolean): void {
    ctx.fillStyle = locked ? LOCKED : selected ? '#0d2044' : PANEL
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = locked ? '#1a2530' : selected ? '#60a5fa' : BORDER
    ctx.lineWidth = selected ? 2 : 1; ctx.strokeRect(x, y, w, h)

    // Stage badge
    const bc = locked ? '#374151' : hull.minStage <= 1 ? '#166534' : hull.minStage <= 4 ? '#1e40af' : hull.minStage <= 7 ? '#92400e' : '#6b21a8'
    ctx.fillStyle = bc; ctx.fillRect(x + w - 70, y + 8, 62, 20)
    ctx.font = '11px sans-serif'; ctx.fillStyle = locked ? DIM : '#fff'; ctx.textAlign = 'center'
    ctx.fillText(hull.minStage <= 1 ? '初期解放' : `ステージ${hull.minStage}+`, x + w - 39, y + 22)

    ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = locked ? DIM : selected ? '#93c5fd' : TEXT
    ctx.fillText(hull.name, x + w / 2, y + 44)
    ctx.font = '12px sans-serif'; ctx.fillStyle = locked ? '#2a3545' : '#6b7f99'
    ctx.fillText(hull.className, x + w / 2, y + 62)

    this.drawHullMiniature(ctx, x + w / 2, y + 130, 38, 105, hull, locked)

    const statY = y + h - 130
    this.drawStatBar(ctx, x + 16, statY,       w - 32, 'HP',   hull.hp / 2100,          locked ? DIM : '#22c55e', locked ? '#1a2030' : '#052e16', `${hull.hp}`, locked)
    this.drawStatBar(ctx, x + 16, statY + 32,  w - 32, '速力', hull.maxSpeed / 7.2,     locked ? DIM : '#38bdf8', locked ? '#1a2030' : '#0c2536', `${Math.round(hull.maxSpeed * 10)}kt`, locked)

    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = locked ? DIM : '#a5b4c8'; ctx.textAlign = 'left'
    ctx.fillText(`スロット: ${hull.slots.length}`, x + 16, y + h - 28)
    if (selected && !locked) {
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#60a5fa'; ctx.textAlign = 'right'
      ctx.fillText('✓ 選択中', x + w - 12, y + h - 12)
    }
    if (locked) {
      ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#374151'; ctx.textAlign = 'center'
      ctx.fillText('🔒 未解放', x + w / 2, y + h / 2 + 8)
    }
  }

  private drawHullMiniature(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, hull: HullCatalogEntry, locked: boolean): void {
    const fillColor = locked ? '#1a2030' : hull.shipType === 'destroyer' ? '#0d2244' : hull.shipType === 'cruiser' ? '#1a2a44' : '#22304a'
    ctx.fillStyle = fillColor; ctx.strokeStyle = locked ? '#1a2535' : BORDER; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy - hh * 0.3); ctx.lineTo(cx + hw, cy + hh * 0.5)
    ctx.lineTo(cx + hw * 0.6, cy + hh); ctx.lineTo(cx, cy + hh - 4)
    ctx.lineTo(cx - hw * 0.6, cy + hh); ctx.lineTo(cx - hw, cy + hh * 0.5); ctx.lineTo(cx - hw, cy - hh * 0.3)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    // Slot dots
    for (const slot of hull.slots) {
      ctx.beginPath(); ctx.arc(cx + slot.x * hw * 0.7, cy + slot.y * hh * 0.7, 3, 0, Math.PI * 2)
      ctx.fillStyle = locked ? '#1a2535' : (TYPE_COLOR[slot.compatibleTypes[0]!] ?? '#2563eb')
      ctx.fill()
    }
  }

  // ── Phase 2: Shop ─────────────────────────────────────────────────────────

  private renderShopPhase(cw: number, ch: number): void {
    const ctx = this.ctx
    const topY = 54
    const hull = this.selectedHull()!
    const panelW = Math.floor(cw * 0.34)

    // Left panel: hull slots overview
    ctx.fillStyle = PANEL; ctx.fillRect(0, topY, panelW, ch - topY)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(panelW, topY); ctx.lineTo(panelW, ch); ctx.stroke()
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#93c5fd'; ctx.textAlign = 'left'
    ctx.fillText(hull.name, 16, topY + 24)
    ctx.font = '12px sans-serif'; ctx.fillStyle = DIM; ctx.fillText(hull.className, 16, topY + 42)

    let slotY = topY + 58
    for (const slot of hull.slots) {
      const assigned = this.fixedAssignments.get(slot.id) ??
        this.freePlacements.find(p => this.getFixedSlots(hull).every(s => s.id !== slot.id) && false)?.weapon
      ctx.fillStyle = '#0a1420'; ctx.fillRect(8, slotY, panelW - 16, 26)
      ctx.strokeStyle = BORDER; ctx.lineWidth = 1; ctx.strokeRect(8, slotY, panelW - 16, 26)
      ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
      ctx.fillText(slot.label, 14, slotY + 17)
      const compStr = slot.compatibleTypes.map(t => TYPE_JP[t] ?? t).join('/')
      ctx.fillStyle = '#2a3a50'; ctx.textAlign = 'right'
      ctx.fillText(compStr, panelW - 14, slotY + 17)
      slotY += 30
    }

    // Credits bar
    ctx.fillStyle = '#060c18'; ctx.fillRect(0, ch - 56, panelW, 56)
    ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'; ctx.fillText('残余資金', 14, ch - 36)
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.fillText(`¥ ${this.credits.toLocaleString()}`, 14, ch - 14)

    // Right panel: weapon shop
    const shopX = panelW + 10, shopW = cw - panelW - 10
    const tabW2 = shopW / SHOP_TYPE_TABS.length, tabY = topY + 4
    for (let i = 0; i < SHOP_TYPE_TABS.length; i++) {
      const tab = SHOP_TYPE_TABS[i]!
      const tx = shopX + i * tabW2
      const active = tab.type === this.shopTypeFilter
      ctx.fillStyle = active ? ACCENT : '#0d1a2e'; ctx.fillRect(tx + 2, tabY, tabW2 - 4, 28)
      ctx.font = `${active ? 'bold ' : ''}12px sans-serif`; ctx.fillStyle = active ? '#fff' : DIM; ctx.textAlign = 'center'
      ctx.fillText(tab.label, tx + tabW2 / 2, tabY + 18)
      this.addRegion({ tag: 'type-tab', weaponType: tab.type, x: tx + 2, y: tabY, w: tabW2 - 4, h: 28 })
    }

    const available = getAvailableWeapons(this.stage).filter(w =>
      this.shopTypeFilter === 'all' || w.type === this.shopTypeFilter
    )
    const itemH = 62, itemW = shopW - 20, itemX = shopX + 10
    const listY = topY + 40, visibleH = ch - listY - 58

    ctx.save()
    ctx.beginPath(); ctx.rect(shopX, listY, shopW, visibleH); ctx.clip()
    const maxItems = Math.floor(visibleH / (itemH + 5))

    for (let i = 0; i < Math.min(available.length, maxItems); i++) {
      const weapon = available[i]!
      const iy = listY + i * (itemH + 5)
      const canAfford = this.credits >= weapon.cost
      const slotsFull = this.inventory.length >= hull.slots.length
      const isH = this.hovered?.tag === 'shop-item' && this.hovered.weaponId === weapon.id
      ctx.fillStyle = !canAfford || slotsFull ? '#0a1218' : isH ? '#112240' : '#0d1a2e'
      ctx.fillRect(itemX, iy, itemW, itemH)
      ctx.strokeStyle = !canAfford ? '#1a2530' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(itemX, iy, itemW, itemH)
      const col = TYPE_COLOR[weapon.type] ?? DIM
      ctx.fillStyle = col + '33'; ctx.fillRect(itemX + 4, iy + 4, 50, itemH - 8)
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center'
      ctx.fillText(TYPE_JP[weapon.type] ?? weapon.type, itemX + 29, iy + itemH / 2 + 4)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = canAfford && !slotsFull ? TEXT : DIM; ctx.textAlign = 'left'
      ctx.fillText(weapon.name, itemX + 62, iy + 20)
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#4a6080'; ctx.fillText(weapon.desc, itemX + 62, iy + 37)
      ctx.fillText(`弾数: ${weapon.ammo}`, itemX + 62, iy + 52)
      ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = canAfford && !slotsFull ? '#fbbf24' : '#4a3010'; ctx.textAlign = 'right'
      ctx.fillText(`¥${weapon.cost}`, itemX + itemW - 64, iy + 28)
      const canBuy = canAfford && !slotsFull
      ctx.fillStyle = canBuy ? (isH ? '#1d4ed8' : ACCENT) : '#1a2530'; ctx.fillRect(itemX + itemW - 60, iy + 8, 52, 22)
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = canBuy ? '#fff' : DIM; ctx.textAlign = 'center'
      ctx.fillText('購 入', itemX + itemW - 34, iy + 22)
      if (canBuy) this.addRegion({ tag: 'shop-item', weaponId: weapon.id, x: itemX, y: iy, w: itemW, h: itemH })
    }
    ctx.restore()

    // Purchased inventory tags
    const invY = ch - 50
    ctx.fillStyle = '#060c18'; ctx.fillRect(shopX, invY, shopW, 50)
    ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
    ctx.fillText(`購入済み (${this.inventory.length}/${hull.slots.length}) — クリックで返金`, shopX + 8, invY + 13)
    let tx = shopX + 8
    for (let i = 0; i < this.inventory.length; i++) {
      const w = this.inventory[i]!
      const tagW = 82
      if (tx + tagW > cw - 8) break
      const col2 = TYPE_COLOR[w.type] ?? DIM
      ctx.fillStyle = col2 + '33'; ctx.fillRect(tx, invY + 18, tagW, 22)
      ctx.strokeStyle = col2; ctx.lineWidth = 1; ctx.strokeRect(tx, invY + 18, tagW, 22)
      ctx.font = '10px sans-serif'; ctx.fillStyle = col2; ctx.textAlign = 'center'
      ctx.fillText(w.name.slice(0, 10), tx + tagW / 2, invY + 32)
      this.addRegion({ tag: 'inventory-item', idx: i, x: tx, y: invY + 18, w: tagW, h: 22 })
      tx += tagW + 4
    }

    // Buttons
    const btnY2 = ch - 56
    this.drawBtn(panelW + 10, btnY2, 110, 42, '← 戻る', PANEL, TEXT, 14)
    this.addRegion({ tag: 'back', x: panelW + 10, y: btnY2, w: 110, h: 42 })
    const canNext = this.inventory.length > 0
    this.drawBtn(cw - 175, btnY2, 160, 42, '配置へ  →', canNext ? ACCENT : LOCKED, canNext ? '#fff' : DIM, 15)
    if (canNext) this.addRegion({ tag: 'next', x: cw - 175, y: btnY2, w: 160, h: 42 })
  }

  // ── Phase 3: Free Placement ───────────────────────────────────────────────

  private renderPlacementPhase(cw: number, ch: number): void {
    const ctx = this.ctx
    const hull = this.selectedHull()!
    const b = this.getDiagBounds(cw, ch)
    const unassigned = this.inventoryUnassigned()
    const activeWeapon = unassigned[this.selectedInventoryIdx] ?? null

    // ── Left info panel ────────────────────────────────────────────────────
    const panelW = Math.floor(cw * 0.22)
    ctx.fillStyle = PANEL; ctx.fillRect(0, 44, panelW, ch - 44)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(panelW, 44); ctx.lineTo(panelW, ch); ctx.stroke()
    this.drawPlacementGuide(ctx, hull, 0, 44, panelW, ch - 44, activeWeapon)

    // ── Hull diagram ───────────────────────────────────────────────────────
    const hullLeft  = panelW + 10
    const hullRight = cw - 10
    const hullAreaW = hullRight - hullLeft

    // Hull area region (for click-to-place)
    this.addRegion({ tag: 'hull-area', cx: b.cx, cy: b.cy, hw: b.hw, hh: b.hh, x: hullLeft, y: 44, w: hullAreaW, h: ch - 44 - 160 })

    // Draw the hull
    this.drawPlacementHullDiagram(ctx, b, hull, activeWeapon)

    // ── Right info ─────────────────────────────────────────────────────────
    this.drawPlacedList(ctx, cw, ch, hull)

    // ── Inventory strip ────────────────────────────────────────────────────
    const invStripTop = ch - 154
    const invStripH   = 96
    ctx.fillStyle = '#060c18'; ctx.fillRect(0, invStripTop, cw, invStripH)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, invStripTop); ctx.lineTo(cw, invStripTop); ctx.stroke()
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
    ctx.fillText('未配置 (クリックして選択 → 艦体上をクリックして配置)', 16, invStripTop + 15)

    const iw = 110, ih = invStripH - 24
    let ix = 16
    for (let i = 0; i < unassigned.length; i++) {
      const w = unassigned[i]!
      const sel = i === this.selectedInventoryIdx
      const col = TYPE_COLOR[w.type] ?? DIM
      ctx.fillStyle = sel ? col + '44' : '#0d1a2e'; ctx.fillRect(ix, invStripTop + 20, iw, ih)
      ctx.strokeStyle = sel ? col : BORDER; ctx.lineWidth = sel ? 2 : 1; ctx.strokeRect(ix, invStripTop + 20, iw, ih)
      ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center'
      ctx.fillText(TYPE_JP[w.type] ?? w.type, ix + iw / 2, invStripTop + 33)
      ctx.font = '10px sans-serif'; ctx.fillStyle = sel ? '#fff' : TEXT
      const nm = w.name.length > 12 ? w.name.slice(0, 11) + '…' : w.name
      ctx.fillText(nm, ix + iw / 2, invStripTop + 47)
      ctx.font = '9px sans-serif'; ctx.fillStyle = DIM; ctx.fillText(`弾:${w.ammo}`, ix + iw / 2, invStripTop + 59)

      // Placement hint
      const hint = w.type === 'gun' ? '中心線' : w.type === 'torpedo' || w.type === 'secondary' ? '固定スロット' : '艦体上'
      ctx.font = '9px sans-serif'; ctx.fillStyle = sel ? '#fbbf24' : '#2a3a50'
      ctx.fillText(hint, ix + iw / 2, invStripTop + 71)

      this.addRegion({ tag: 'inventory-item', idx: i, x: ix, y: invStripTop + 20, w: iw, h: ih })
      ix += iw + 6
      if (ix + iw > cw) break
    }
    if (unassigned.length === 0 && this.inventory.length > 0) {
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#22c55e'; ctx.textAlign = 'center'
      ctx.fillText('全兵装を配置しました', cw / 2, invStripTop + invStripH / 2 + 5)
    }

    // ── Buttons ────────────────────────────────────────────────────────────
    const btnY = ch - 54
    this.drawBtn(16, btnY, 110, 42, '← 戻る', PANEL, TEXT, 14)
    this.addRegion({ tag: 'back', x: 16, y: btnY, w: 110, h: 42 })

    const placed = this.totalPlaced()
    ctx.font = '12px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
    ctx.fillText(`配置: ${placed} / ${this.inventory.length}`, cw / 2, btnY + 26)

    const canDeploy = placed > 0
    this.drawBtn(cw - 190, btnY, 176, 42, '出撃準備完了 →', canDeploy ? GREEN : LOCKED, canDeploy ? '#fff' : DIM, 13)
    if (canDeploy) this.addRegion({ tag: 'deploy', x: cw - 190, y: btnY, w: 176, h: 42 })
  }

  private drawPlacementGuide(ctx: CanvasRenderingContext2D, hull: HullCatalogEntry, px: number, py: number, pw: number, ph: number, active: ShopWeapon | null): void {
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#93c5fd'; ctx.textAlign = 'left'
    ctx.fillText('配置ルール', px + 12, py + 24)

    const rules = [
      { color: TYPE_COLOR['gun']!,     icon: '◉', line1: '主　砲', line2: '中心線上に自由配置' },
      { color: TYPE_COLOR['missile']!, icon: '◈', line1: 'ミサイル', line2: '艦体上ならどこでも' },
      { color: TYPE_COLOR['aa']!,      icon: '◆', line1: '機　銃', line2: '艦体上ならどこでも' },
      { color: TYPE_COLOR['torpedo']!, icon: '●', line1: '魚　雷', line2: '固定スロットのみ' },
      { color: TYPE_COLOR['secondary']!,icon: '◐', line1: '副　砲', line2: '固定スロットのみ' },
    ]
    let ry = py + 44
    for (const rule of rules) {
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = rule.color; ctx.fillText(rule.icon + ' ' + rule.line1, px + 10, ry)
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#3a5070'; ctx.fillText(rule.line2, px + 14, ry + 14)
      ry += 36
    }

    if (active) {
      ry += 6
      ctx.fillStyle = 'rgba(37,99,235,0.2)'; ctx.fillRect(px + 6, ry, pw - 12, 60)
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1; ctx.strokeRect(px + 6, ry, pw - 12, 60)
      const col = TYPE_COLOR[active.type] ?? DIM
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = col; ctx.fillText('配置中:', px + 12, ry + 16)
      ctx.font = '11px sans-serif'; ctx.fillStyle = TEXT
      const nm = active.name.length > 10 ? active.name.slice(0, 9) + '…' : active.name
      ctx.fillText(nm, px + 12, ry + 32)
      const hint = active.type === 'gun' ? '↑ 中心線をクリック' : active.type === 'torpedo' || active.type === 'secondary' ? '↑ 固定スロットをクリック' : '↑ 艦体上をクリック'
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.fillText(hint, px + 12, ry + 50)
    }
  }

  private drawPlacementHullDiagram(ctx: CanvasRenderingContext2D, b: DiagBounds, hull: HullCatalogEntry, activeWeapon: ShopWeapon | null): void {
    const { cx, cy, hw, hh } = b

    // Draw hull outline
    ctx.save()
    ctx.beginPath()
    this.buildHullPath(ctx, cx, cy, hw, hh)
    ctx.fillStyle = '#0a1525'
    ctx.fill()
    ctx.strokeStyle = '#2a4a7f'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    // Zone overlays inside hull clip
    ctx.save()
    ctx.beginPath()
    this.buildHullPath(ctx, cx, cy, hw, hh)
    ctx.clip()

    // Gun centerline zone highlight
    if (!activeWeapon || activeWeapon.type === 'gun') {
      const gunZoneW = hw * CENTERLINE_ZONE * 2
      ctx.fillStyle = 'rgba(251,191,36,0.08)'
      ctx.fillRect(cx - gunZoneW / 2, cy - hh, gunZoneW, hh * 2)
    }
    // Missile/AA zone highlight (full hull)
    if (!activeWeapon || activeWeapon.type === 'missile' || activeWeapon.type === 'aa') {
      ctx.fillStyle = 'rgba(167,139,250,0.05)'
      ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2)
    }

    ctx.restore()

    // Centerline dashed line
    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy - hh * 0.96); ctx.lineTo(cx, cy + hh * 0.96); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Bow/stern labels
    ctx.font = '10px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
    ctx.fillText('艦首', cx, cy - hh - 8)
    ctx.fillText('艦尾', cx, cy + hh + 16)

    // Fixed slots (torpedo / secondary)
    const fixedSlots = this.getFixedSlots(hull)
    for (const slot of fixedSlots) {
      const sx = cx + slot.x * hw
      const sy = cy + slot.y * hh
      const r2 = 18
      const assigned = this.fixedAssignments.get(slot.id)
      const col = assigned ? (TYPE_COLOR[assigned.type] ?? DIM) : DIM
      const isActiveFixed = activeWeapon && (activeWeapon.type === 'torpedo' || activeWeapon.type === 'secondary') && slot.compatibleTypes.includes(activeWeapon.type)

      ctx.beginPath(); ctx.arc(sx, sy, r2, 0, Math.PI * 2)
      ctx.fillStyle = assigned ? col + '33' : isActiveFixed ? '#fbbf2422' : '#0a1525'
      ctx.fill()
      ctx.strokeStyle = assigned ? col : isActiveFixed ? '#fbbf24' : '#2a4060'
      ctx.lineWidth = assigned ? 2 : isActiveFixed ? 1.5 : 1
      ctx.setLineDash(assigned ? [] : [4, 3])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.font = assigned ? 'bold 9px sans-serif' : '9px sans-serif'
      ctx.fillStyle = assigned ? col : DIM; ctx.textAlign = 'center'
      ctx.fillText(assigned ? TYPE_JP[assigned.type]! : slot.label.slice(0, 3), sx, sy + 4)

      this.addRegion({ tag: 'fixed-slot', slotId: slot.id, x: sx - r2, y: sy - r2, w: r2 * 2, h: r2 * 2 })
    }

    // Free placements (gun / missile / aa)
    for (const fp of this.freePlacements) {
      const sx = cx + fp.nx * hw
      const sy = cy + fp.ny * hh
      const r2 = 17
      const col = TYPE_COLOR[fp.weapon.type] ?? DIM
      ctx.beginPath(); ctx.arc(sx, sy, r2, 0, Math.PI * 2)
      ctx.fillStyle = col + '44'; ctx.fill()
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke()
      ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center'
      ctx.fillText(TYPE_JP[fp.weapon.type]!, sx, sy + 4)
      this.addRegion({ tag: 'placed-weapon', uid: fp.uid, x: sx - r2, y: sy - r2, w: r2 * 2, h: r2 * 2 })
    }

    // Placement preview
    if (activeWeapon && (activeWeapon.type === 'gun' || activeWeapon.type === 'missile' || activeWeapon.type === 'aa')) {
      const mnx = (this.pmouseX - cx) / hw
      const mny = (this.pmouseY - cy) / hh
      let previewNX = mnx, previewNY = mny
      let valid = false

      if (activeWeapon.type === 'gun') {
        previewNX = 0
        valid = Math.abs(mnx) <= CENTERLINE_ZONE && this.isInsideHull(0, mny) && this.canPlaceGun(mny) && this.hasGunCapacity()
      } else {
        valid = this.isInsideHull(mnx, mny) && this.canPlaceFree(mnx, mny)
      }

      if (valid) {
        const sx = cx + previewNX * hw
        const sy = cy + previewNY * hh
        const col = TYPE_COLOR[activeWeapon.type] ?? DIM
        ctx.beginPath(); ctx.arc(sx, sy, 17, 0, Math.PI * 2)
        ctx.fillStyle = col + '22'; ctx.fill()
        ctx.strokeStyle = col; ctx.lineWidth = 2
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([])
        ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = col + 'aa'; ctx.textAlign = 'center'
        ctx.fillText(TYPE_JP[activeWeapon.type]!, sx, sy + 4)
      }
    }
  }

  private buildHullPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
    // Top-down ship silhouette using hullMaxHW for tapered bow/stern
    const steps = 48
    ctx.moveTo(cx, cy - hh)
    for (let i = 0; i <= steps; i++) {
      const ny = -1 + (2 / steps) * i
      const mw = this.hullMaxHW(ny) * hw
      ctx.lineTo(cx + mw, cy + ny * hh)
    }
    for (let i = steps; i >= 0; i--) {
      const ny = -1 + (2 / steps) * i
      const mw = this.hullMaxHW(ny) * hw
      ctx.lineTo(cx - mw, cy + ny * hh)
    }
    ctx.closePath()
  }

  private drawPlacedList(ctx: CanvasRenderingContext2D, cw: number, ch: number, hull: HullCatalogEntry): void {
    const listX = Math.floor(cw * 0.75)
    const listW = cw - listX - 10
    ctx.fillStyle = '#080f1c'; ctx.fillRect(listX, 44, listW, ch - 44 - 156)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(listX, 44); ctx.lineTo(listX, ch - 156); ctx.stroke()
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
    ctx.fillText('配置済み兵装', listX + 10, 64)

    let ry = 80
    // Free placements
    const sorted = [...this.freePlacements].sort((a, b) => a.ny - b.ny)
    for (const fp of sorted) {
      if (ry > ch - 180) break
      const col = TYPE_COLOR[fp.weapon.type] ?? DIM
      ctx.fillStyle = col + '22'; ctx.fillRect(listX + 6, ry, listW - 12, 22)
      ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'left'
      ctx.fillText(TYPE_JP[fp.weapon.type]!, listX + 10, ry + 14)
      ctx.font = '10px sans-serif'; ctx.fillStyle = TEXT
      const nm = fp.weapon.name.length > 10 ? fp.weapon.name.slice(0, 9) + '…' : fp.weapon.name
      ctx.fillText(nm, listX + 38, ry + 14)
      ry += 26
    }
    // Fixed
    for (const slot of this.getFixedSlots(hull)) {
      if (ry > ch - 180) break
      const w = this.fixedAssignments.get(slot.id)
      if (!w) continue
      const col = TYPE_COLOR[w.type] ?? DIM
      ctx.fillStyle = col + '22'; ctx.fillRect(listX + 6, ry, listW - 12, 22)
      ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = col; ctx.fillText(TYPE_JP[w.type]!, listX + 10, ry + 14)
      ctx.font = '10px sans-serif'; ctx.fillStyle = TEXT
      const nm = w.name.length > 10 ? w.name.slice(0, 9) + '…' : w.name
      ctx.fillText(nm, listX + 38, ry + 14)
      ry += 26
    }
    if (ry === 80) {
      ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.fillText('未配置', listX + 10, 98)
    }
  }

  // ── Shared drawing ────────────────────────────────────────────────────────

  private drawStatBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, ratio: number, barColor: string, trackColor: string, value: string, locked: boolean): void {
    ctx.font = '11px sans-serif'; ctx.fillStyle = locked ? '#2a3545' : DIM; ctx.textAlign = 'left'
    ctx.fillText(label, x, y + 10)
    ctx.fillStyle = trackColor; ctx.fillRect(x + 40, y, w - 90, 12)
    ctx.fillStyle = locked ? '#1a2535' : barColor; ctx.fillRect(x + 40, y, (w - 90) * Math.max(0, Math.min(1, ratio)), 12)
    ctx.font = '11px sans-serif'; ctx.fillStyle = locked ? '#2a3545' : TEXT; ctx.textAlign = 'right'
    ctx.fillText(value, x + w, y + 10)
  }

  private drawBtn(x: number, y: number, w: number, h: number, label: string, bg: string, fg: string, fontSize = 14): void {
    const ctx = this.ctx
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = fg === '#fff' ? '#60a5fa' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h)
    ctx.font = `bold ${fontSize}px sans-serif`; ctx.fillStyle = fg; ctx.textAlign = 'center'
    ctx.fillText(label, x + w / 2, y + h / 2 + fontSize * 0.35)
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

  private onMouseMove(e: MouseEvent): void {
    this.hovered = this.hitRegion(e)
    if (this.phase === 'placement') {
      const rect = this.canvas.getBoundingClientRect()
      this.pmouseX = e.clientX - rect.left
      this.pmouseY = e.clientY - rect.top
    }
  }
}
