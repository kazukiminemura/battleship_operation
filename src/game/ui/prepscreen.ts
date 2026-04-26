import type { WeaponTemplate, PlayerShipType } from '../data/masterdata'
import { ARMOR_WEIGHT_K } from '../data/masterdata'
import { getHullsByClass, type HullCatalogEntry, type HullSlot } from '../data/hull-catalog'
import { WEAPON_SHOP, TYPE_COLOR, TYPE_JP, type ShopWeapon } from '../data/weapon-shop'
import type { WeaponType } from '../simulation/types'
import { ThreeShipDesignerRenderer, type ShipDesignerPreviewConfig } from '../rendering/three-ship-designer-renderer'
import { drawAccessKeyHint, isAccessKey } from './accesskeys'
import {
  GRID_CELL_METERS,
  buildPlacements,
  canMoveSlotTo,
  canMoveTowerTo,
  cellCenter,
  cellKey,
  cellToMount,
  currentSlotCell,
  defaultTowerCell,
  footprintRect,
  gridSpec,
  hullDimensions,
  hullMaxHalfWidth,
  isInsideHullCell,
  mountToCell,
  moveTargetState,
  occupiedCells,
  type GridCell,
  type GridSpec,
  type Placement,
} from './prep-layout'

export interface PrepResult {
  templateId: string
  shipType: PlayerShipType
  loadout: WeaponTemplate[]
  armorBonus: number
  slotCells?: Record<string, GridCell>
  towerCell?: GridCell | null
}

type ScreenTab = 'hull' | 'armament'
type ArmamentView = 'grid' | 'preview3d'
type WeaponFilter = WeaponType | 'all'
export type PrepAudioCue = 'select' | 'place' | 'equip' | 'back' | 'confirm' | 'denied'

type Region =
  | { tag: 'class-tab';   shipType: PlayerShipType;   x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'hull-card';   index: number;               x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'main-tab';    tab: ScreenTab;              x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'type-tab';    filter: WeaponFilter;        x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'grid-slot';   slotId: string;              x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'grid-tower';                                x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'grid-empty';  c: number; r: number;        x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'weapon-card'; weaponId: string;            x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'weapon-inc';  weaponId: string;            x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'weapon-dec';  weaponId: string;            x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'armor-up';                                  x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'armor-down';                                x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'armor-bar';                                 x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'armament-view'; view: ArmamentView;          x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'deploy';                                    x: number; y: number; w: number; h: number; accessKey?: string }
  | { tag: 'back';                                      x: number; y: number; w: number; h: number; accessKey?: string }

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

const YUKIMURA_DEFAULT_WEAPONS: Record<string, ShopWeapon> = {
  s0: { id: 'weapon.gun.yukimura.snowball.forward', name: '雪玉主砲(前)', type: 'gun', ammo: 260, desc: '丸い雪玉を高弾道で撃ち出す', cost: 0, minStage: 1 },
  s1: { id: 'weapon.gun.yukimura.snowball.center', name: '雪玉主砲(中)', type: 'gun', ammo: 260, desc: '丸い雪玉を高弾道で撃ち出す', cost: 0, minStage: 1 },
  s2: { id: 'weapon.gun.yukimura.snowball.aft', name: '雪玉主砲(後)', type: 'gun', ammo: 260, desc: '丸い雪玉を高弾道で撃ち出す', cost: 0, minStage: 1 },
  s3: { id: 'weapon.secondary.yukimura.marshmallow.port', name: '左舷マシュマロ砲', type: 'secondary', ammo: 520, desc: 'ふわっと白いマシュマロ弾を速射する', cost: 0, minStage: 1 },
  s4: { id: 'weapon.secondary.yukimura.marshmallow.starboard', name: '右舷マシュマロ砲', type: 'secondary', ammo: 520, desc: 'ふわっと白いマシュマロ弾を速射する', cost: 0, minStage: 1 },
  s5: { id: 'weapon.torpedo.yukimura.yukidaru', name: '雪樽', type: 'torpedo', ammo: 60, desc: '雪を詰めた大樽を転がして放つ', cost: 0, minStage: 1 },
}
const LOCKED = '#090f0a'
const SEL    = '#0a3018'
type ShipPreviewMode = 'card' | 'grid'

const ARMOR_BONUS_STEP = 5
const ARMOR_BONUS_MAX  = 100

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
  private armamentView: ArmamentView = 'grid'
  private weaponFilter: WeaponFilter = 'all'
  private slotWeapons = new Map<string, ShopWeapon>()  // slotId → weapon
  private slotCells = new Map<string, { c: number; r: number }>()
  private towerCell: GridCell | null = null
  private armorBonus = 0
  private lastAudioCue: PrepAudioCue | null = null
  private readonly shipPreview: ThreeShipDesignerRenderer

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onMoveRef = (e) => this.onMouseMove(e)
    this.shipPreview = new ThreeShipDesignerRenderer()
  }

  attach(stage: number, inheritedDesign: PrepResult | null = null): void {
    this.stage = stage
    this.tab = 'hull'
    this.selectedClass = 'destroyer'
    this.selectedHullIdx = 0
    this.selectedSlotId = null
    this.selectedTower = false
    this.armamentView = 'grid'
    this.weaponFilter = 'all'
    this.slotWeapons = new Map()
    this.slotCells = new Map()
    this.towerCell = null
    this.armorBonus = 0
    if (inheritedDesign) this.applyInheritedDesign(inheritedDesign)
    this.canvas.addEventListener('mousemove', this.onMoveRef)
  }

  detach(): void {
    this.canvas.removeEventListener('mousemove', this.onMoveRef)
    this.hovered = null
    this.shipPreview.hide()
  }

  checkClick(e: MouseEvent): PrepResult | null {
    this.lastAudioCue = null
    const r = this.hitRegion(e)
    if (!r) return null
    if (r.tag === 'armor-bar') {
      const rect = this.canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      this.setArmorBonusFromBar(mx, r)
      this.lastAudioCue = 'select'
      return null
    }
    return this.activateRegion(r)
  }

  checkKeyDown(e: KeyboardEvent): PrepResult | null {
    this.lastAudioCue = null
    const hull = this.selectedHull()

    if (!e.altKey && e.code === 'Space' && hull) {
      return this.activateRegion(this.tab === 'hull'
        ? { tag: 'main-tab', tab: 'armament', x: 0, y: 0, w: 0, h: 0, accessKey: 'SPACE' }
        : { tag: 'deploy', x: 0, y: 0, w: 0, h: 0, accessKey: 'SPACE' })
    }

    if (e.altKey) {
      for (let i = this.regions.length - 1; i >= 0; i--) {
        const region = this.regions[i]!
        const key = this.accessKeyForRegion(region)
        if (key && isAccessKey(e, key)) return this.activateRegion(region)
      }
    }
    return null
  }

  private activateRegion(r: Region): PrepResult | null {
    switch (r.tag) {
      case 'main-tab':
        if (r.tab === 'armament' && !this.selectedHull()) {
          this.lastAudioCue = 'denied'
          break
        }
        this.tab = r.tab
        this.selectedSlotId = null
        this.selectedTower = false
        this.lastAudioCue = 'select'
        break

      case 'class-tab':
        this.selectedClass = r.shipType
        this.selectedHullIdx = 0
        this.slotWeapons = new Map()
        this.slotCells = new Map()
        this.towerCell = null
        this.selectedSlotId = null
        this.selectedTower = false
        this.lastAudioCue = 'select'
        break

      case 'hull-card': {
        const hull = getHullsByClass(this.selectedClass)[r.index]
        if (!hull || hull.minStage > this.stage) {
          this.lastAudioCue = 'denied'
          break
        }
        if (this.selectedHullIdx !== r.index) {
          this.selectedHullIdx = r.index
          this.slotWeapons = new Map()
          this.slotCells = new Map()
          this.towerCell = null
          this.selectedSlotId = null
          this.selectedTower = false
        }
        this.tab = 'armament'
        this.lastAudioCue = 'select'
        break
      }

      case 'type-tab':
        this.weaponFilter = r.filter
        this.lastAudioCue = 'select'
        break

      case 'armament-view':
        this.armamentView = r.view
        this.lastAudioCue = 'select'
        break

      case 'grid-slot':
        // Toggle selection; clicking again deselects
        this.selectedSlotId = this.selectedSlotId === r.slotId ? null : r.slotId
        this.selectedTower = false
        this.lastAudioCue = 'select'
        break

      case 'grid-tower':
        this.selectedTower = !this.selectedTower
        this.selectedSlotId = null
        this.lastAudioCue = 'select'
        break

      case 'grid-empty': {
        const hull = this.selectedHull()
        if (!hull) {
          this.lastAudioCue = 'denied'
          break
        }
        const spec = gridSpec(hull)
        const placements = this.currentPlacements(hull, spec)
        if (this.selectedTower) {
          if (canMoveTowerTo(r.c, r.r, hull, placements, spec)) {
            this.towerCell = { c: r.c, r: r.r }
            this.lastAudioCue = 'place'
          } else {
            this.lastAudioCue = 'denied'
          }
          break
        }
        if (!this.selectedSlotId) {
          this.lastAudioCue = 'denied'
          break
        }
        const slot = hull?.slots.find(s => s.id === this.selectedSlotId)
        if (!slot || !canMoveSlotTo(slot, r.c, r.r, hull, placements, spec)) {
          this.lastAudioCue = 'denied'
          break
        }
        this.slotCells.set(slot.id, { c: r.c, r: r.r })
        this.lastAudioCue = 'place'
        break
      }

      case 'weapon-card': {
        // Assign the weapon to the selected slot (if compatible), or remove it
        if (!this.selectedSlotId) {
          this.lastAudioCue = 'denied'
          break
        }
        const hull = this.selectedHull()
        const slot = hull?.slots.find(s => s.id === this.selectedSlotId)
        if (!slot) {
          this.lastAudioCue = 'denied'
          break
        }
        const w = WEAPON_SHOP.find(x => x.id === r.weaponId)
        if (!w || !slot.compatibleTypes.includes(w.type)) {
          this.lastAudioCue = 'denied'
          break
        }
        if (this.slotWeapons.get(slot.id)?.id === w.id) {
          this.slotWeapons.delete(slot.id)   // clicking current weapon removes it
        } else {
          this.slotWeapons.set(slot.id, w)
          this.selectedSlotId = null
        }
        this.lastAudioCue = 'equip'
        break
      }

      case 'weapon-inc': {
        const hull = this.selectedHull()
        if (!hull) { this.lastAudioCue = 'denied'; break }
        const w = WEAPON_SHOP.find(x => x.id === r.weaponId)
        if (!w) { this.lastAudioCue = 'denied'; break }
        const emptySlot = hull.slots.find(s =>
          s.compatibleTypes.includes(w.type) && !this.slotWeapons.has(s.id)
        )
        if (!emptySlot) { this.lastAudioCue = 'denied'; break }
        this.slotWeapons.set(emptySlot.id, w)
        this.lastAudioCue = 'equip'
        break
      }

      case 'weapon-dec': {
        const hull = this.selectedHull()
        if (!hull) { this.lastAudioCue = 'denied'; break }
        const w = WEAPON_SHOP.find(x => x.id === r.weaponId)
        if (!w) { this.lastAudioCue = 'denied'; break }
        const equippedSlots = hull.slots.filter(s => this.slotWeapons.get(s.id)?.id === w.id)
        if (equippedSlots.length === 0) { this.lastAudioCue = 'denied'; break }
        this.slotWeapons.delete(equippedSlots[equippedSlots.length - 1]!.id)
        this.lastAudioCue = 'equip'
        break
      }

      case 'armor-up':
        this.armorBonus = Math.min(ARMOR_BONUS_MAX, this.armorBonus + ARMOR_BONUS_STEP)
        this.lastAudioCue = 'select'
        break

      case 'armor-down':
        this.armorBonus = Math.max(0, this.armorBonus - ARMOR_BONUS_STEP)
        this.lastAudioCue = 'select'
        break

      case 'armor-bar':
        this.lastAudioCue = 'select'
        break

      case 'deploy':
        this.lastAudioCue = 'confirm'
        return this.buildResult()

      case 'back':
        if (this.tab === 'armament') this.tab = 'hull'
        this.lastAudioCue = 'back'
        break
    }
    return null
  }

  consumeAudioCue(): PrepAudioCue | null {
    const cue = this.lastAudioCue
    this.lastAudioCue = null
    return cue
  }

  render(showAccessKeys = false): void {
    const { width: cw, height: ch } = this.canvas
    this.regions = []
    this.drawBackground(cw, ch)
    const TAB_H = 56, STAT_H = 76, BTN_H = 64
    const mainY = TAB_H
    const mainH = ch - TAB_H - STAT_H - BTN_H
    this.drawTopTabs(cw, TAB_H, showAccessKeys)
    if (this.tab === 'hull') {
      this.shipPreview.hide()
      this.renderHullTab(0, mainY, cw, mainH, showAccessKeys)
    } else {
      this.renderArmamentTab(0, mainY, cw, mainH, showAccessKeys)
    }
    this.renderStatsBar(0, ch - STAT_H - BTN_H, cw, STAT_H)
    this.renderButtons(0, ch - BTN_H, cw, BTN_H, showAccessKeys)
    this.shipPreview.update()
  }

  // ── Data helpers ─────────────────────────────────────────────────────────

  private selectedHull(): HullCatalogEntry | null {
    return getHullsByClass(this.selectedClass)[this.selectedHullIdx] ?? null
  }

  private buildResult(): PrepResult | null {
    const hull = this.selectedHull()
    if (!hull) return null
    const spec = gridSpec(hull)
    const loadout: WeaponTemplate[] = []
    for (const slot of hull.slots) {
      const w = this.slotWeapons.get(slot.id) ?? this.defaultWeapon(hull, slot)
      const cell = currentSlotCell(slot, spec, this.slotCells)
      if (w) loadout.push({ id: w.id, name: w.name, type: w.type, ammo: w.ammo, mount: cellToMount(cell.c, cell.r, spec) })
    }
    if (loadout.length === 0) return null
    return {
      templateId: hull.templateId,
      shipType: hull.shipType,
      loadout,
      armorBonus: this.armorBonus,
      slotCells: Object.fromEntries(this.slotCells),
      towerCell: this.towerCell ? { ...this.towerCell } : null,
    }
  }

  private applyInheritedDesign(design: PrepResult): void {
    const hulls = getHullsByClass(design.shipType)
    const hullIdx = hulls.findIndex(h => h.templateId === design.templateId && h.minStage <= this.stage)
    const hull = hullIdx >= 0 ? hulls[hullIdx]! : null
    if (!hull) return

    this.selectedClass = design.shipType
    this.selectedHullIdx = hullIdx
    this.tab = 'armament'
    this.armorBonus = Math.max(0, Math.min(ARMOR_BONUS_MAX, design.armorBonus))
    this.slotWeapons = new Map()
    this.slotCells = new Map()
    this.towerCell = design.towerCell ? { ...design.towerCell } : null

    const spec = gridSpec(hull)
    for (let i = 0; i < hull.slots.length; i++) {
      const slot = hull.slots[i]!
      const weapon = design.loadout[i]
      if (!weapon || !slot.compatibleTypes.includes(weapon.type)) continue
      this.slotWeapons.set(slot.id, this.shopWeaponFromTemplate(weapon))
      const savedCell = design.slotCells?.[slot.id]
      if (savedCell) this.slotCells.set(slot.id, { ...savedCell })
      else if (weapon.mount) this.slotCells.set(slot.id, mountToCell(weapon.mount, spec))
    }
  }

  private shopWeaponFromTemplate(weapon: WeaponTemplate): ShopWeapon {
    return WEAPON_SHOP.find(w => w.id === weapon.id) ?? {
      id: weapon.id,
      name: weapon.name ?? weapon.id,
      type: weapon.type,
      ammo: weapon.ammo,
      desc: '',
      cost: 0,
      minStage: 1,
    }
  }

  private defaultWeapon(hull: HullCatalogEntry, slot: HullSlot): ShopWeapon | null {
    if (hull.templateId === 'hull.bb.yukimura') {
      const special = YUKIMURA_DEFAULT_WEAPONS[slot.id]
      if (special) return special
    }
    return WEAPON_SHOP.find(w =>
      slot.compatibleTypes.includes(w.type) && w.minStage <= this.stage
    ) ?? null
  }

  private getCompatible(slot: HullSlot): ShopWeapon[] {
    return WEAPON_SHOP.filter(w =>
      slot.compatibleTypes.includes(w.type) && w.minStage <= this.stage
    )
  }

  private currentPlacements(hull: HullCatalogEntry, spec = gridSpec(hull)): Placement[] {
    return buildPlacements(hull, spec, this.slotWeapons, this.slotCells, this.towerCell)
  }

  private previewConfig(hull: HullCatalogEntry): ShipDesignerPreviewConfig {
    const spec = gridSpec(hull)
    const towerCell = this.towerCell ?? defaultTowerCell(hull, spec)
    const weapons = hull.slots
      .map((slot) => {
        const weapon = this.slotWeapons.get(slot.id) ?? this.defaultWeapon(hull, slot)
        if (!weapon) return null
        const cell = currentSlotCell(slot, spec, this.slotCells)
        return {
          id: weapon.id,
          name: weapon.name,
          type: weapon.type,
          mount: cellToMount(cell.c, cell.r, spec),
          selected: this.selectedSlotId === slot.id,
        }
      })
      .filter((weapon): weapon is ShipDesignerPreviewConfig['weapons'][number] => weapon !== null)

    return {
      hull,
      weapons,
      towerMount: cellToMount(towerCell.c, towerCell.r, spec),
      armorBonus: this.armorBonus,
    }
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

  private drawTopTabs(cw: number, h: number, showAccessKeys: boolean): void {
    const ctx = this.ctx
    ctx.fillStyle = '#080f08'; ctx.fillRect(0, 0, cw, h)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(cw, h); ctx.stroke()
    ctx.font = '16px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'right'
    ctx.fillText(`Stage ${this.stage}`, cw - 14, h / 2 + 6)

    const defs: { tab: ScreenTab; label: string }[] = [
      { tab: 'hull',     label: '艦体選択' },
      { tab: 'armament', label: '兵装配置' },
    ]
    const tw = 150, th = h - 10, sx = 8
    for (let i = 0; i < defs.length; i++) {
      const t = defs[i]!; const tx = sx + i * (tw + 4)
      const active = this.tab === t.tab
      ctx.fillStyle = active ? ACCENT : '#0c1610'; ctx.fillRect(tx, 5, tw, th)
      ctx.strokeStyle = active ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(tx, 5, tw, th)
      ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = active ? '#cce8cc' : DIM; ctx.textAlign = 'center'
      ctx.fillText(t.label, tx + tw / 2, 5 + th / 2 + 7)
      const region: Region = { tag: 'main-tab', tab: t.tab, x: tx, y: 5, w: tw, h: th }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, tx + 7, 12)
      this.addRegion(region)
    }
  }

  // ── Hull tab ──────────────────────────────────────────────────────────────

  private renderHullTab(x: number, y: number, cw: number, ch: number, showAccessKeys: boolean): void {
    const ctx = this.ctx
    const ctW = 118, ctH = 58
    for (let i = 0; i < CLASS_TABS.length; i++) {
      const tab = CLASS_TABS[i]!; const ty = y + 20 + i * (ctH + 8)
      const active = tab.type === this.selectedClass
      ctx.fillStyle = active ? ACCENT : '#0c1610'; ctx.fillRect(x + 8, ty, ctW, ctH)
      ctx.strokeStyle = active ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(x + 8, ty, ctW, ctH)
      ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = active ? '#cce8cc' : TEXT; ctx.textAlign = 'center'
      ctx.fillText(tab.label, x + 8 + ctW / 2, ty + ctH / 2 + 7)
      const region: Region = { tag: 'class-tab', shipType: tab.type, x: x + 8, y: ty, w: ctW, h: ctH }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, x + 14, ty + 8)
      this.addRegion(region)
    }

    const hulls = getHullsByClass(this.selectedClass)
    const cardW = Math.min(286, (cw - 148) / 3 - 14)
    const cardH = Math.min(310, ch - 28)
    const totalW = hulls.length * (cardW + 14) - 14
    const startX = x + 142 + (cw - 142 - totalW) / 2
    const cardY = y + (ch - cardH) / 2

    for (let i = 0; i < hulls.length; i++) {
      const hull = hulls[i]!
      const cx2 = startX + i * (cardW + 14)
      const locked = hull.minStage > this.stage
      const selected = i === this.selectedHullIdx && !locked
      this.drawHullCard(cx2, cardY, cardW, cardH, hull, locked, selected)
      if (!locked) {
        const region: Region = { tag: 'hull-card', index: i, x: cx2, y: cardY, w: cardW, h: cardH }
        if (showAccessKeys) this.drawRegionAccessHint(ctx, region, cx2 + 8, cardY + 8)
        this.addRegion(region)
      }
    }
  }

  private drawHullCard(x: number, y: number, w: number, h: number, hull: HullCatalogEntry, locked: boolean, selected: boolean): void {
    const ctx = this.ctx
    ctx.fillStyle = locked ? LOCKED : selected ? SEL : PANEL; ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = locked ? '#1a2a1a' : selected ? '#3a9a4a' : BORDER
    ctx.lineWidth = selected ? 2 : 1; ctx.strokeRect(x, y, w, h)

    const bc = locked ? '#1a2a1a' : hull.minStage <= 1 ? '#1a5a1a' : hull.minStage <= 4 ? '#1a3a6f' : '#5a3a0a'
    ctx.fillStyle = bc; ctx.fillRect(x + w - 70, y + 8, 62, 20)
    ctx.font = '13px sans-serif'; ctx.fillStyle = locked ? DIM : '#c0e0c0'; ctx.textAlign = 'center'
    ctx.fillText(hull.minStage <= 1 ? '初期解放' : `Stg.${hull.minStage}+`, x + w - 39, y + 23)

    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = locked ? DIM : selected ? '#a0d8a0' : TEXT
    ctx.fillText(hull.name, x + w / 2, y + 52)
    ctx.font = '16px sans-serif'; ctx.fillStyle = locked ? '#1a2a1a' : '#4a7a4a'
    ctx.fillText(hull.className, x + w / 2, y + 75)

    const dims = hullDimensions(hull)
    const previewHH = h * 0.29
    const previewHW = Math.min(w * 0.30, previewHH * (dims.beamM / dims.lengthM))
    this.drawShipTopDown(ctx, x + w / 2, y + h * 0.42, previewHW, previewHH, hull, locked)

    const sv = y + h - 104
    this.drawStatBar(x + 14, sv,      w - 28, 'HP',   hull.hp / 2100,      locked ? DIM : '#22c55e', `${hull.hp}`,                   locked)
    this.drawStatBar(x + 14, sv + 30, w - 28, '速力', hull.maxSpeed / 7.2, locked ? DIM : '#38bdf8', `${hull.maxSpeed.toFixed(1)}kt`, locked)

    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = locked ? DIM : '#4a7a4a'; ctx.textAlign = 'left'
    ctx.fillText(`スロット: ${hull.slots.length} / ${Math.round(dims.lengthM)}m x ${dims.beamM.toFixed(1)}m`, x + 14, y + h - 22)
    if (selected) {
      ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#3a9a4a'; ctx.textAlign = 'right'
      ctx.fillText('✓ 選択中', x + w - 10, y + h - 10)
    }
    if (locked) {
      ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#2a3a2a'; ctx.textAlign = 'center'
      ctx.fillText('🔒 未解放', x + w / 2, y + h / 2 + 4)
    }
  }

  // ── Armament tab ──────────────────────────────────────────────────────────

  private renderArmamentTab(x: number, y: number, cw: number, ch: number, showAccessKeys: boolean): void {
    const hull = this.selectedHull()
    if (!hull) return

    const PALETTE_W = Math.floor(cw * 0.36)
    const gridAreaW = cw - PALETTE_W

    if (this.armamentView === 'preview3d') {
      this.drawPreview3dArea(x, y, gridAreaW, ch, hull, showAccessKeys)
    } else {
      this.shipPreview.hide()
      this.drawGridArea(x, y, gridAreaW, ch, hull, showAccessKeys)
    }

    // Right panel
    const ctx = this.ctx
    ctx.fillStyle = '#080e08'; ctx.fillRect(x + gridAreaW, y, PALETTE_W, ch)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x + gridAreaW, y); ctx.lineTo(x + gridAreaW, y + ch); ctx.stroke()
    this.drawWeaponPalette(x + gridAreaW, y, PALETTE_W, ch, hull, showAccessKeys)
  }

  // ── Grid area (left/center) ───────────────────────────────────────────────

  private drawGridArea(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry, showAccessKeys: boolean): void {
    const ctx = this.ctx
    const spec = gridSpec(hull)
    const placements = this.currentPlacements(hull, spec)
    const occupied = occupiedCells(placements)
    const sideH = Math.min(64, Math.max(42, ph * 0.13))
    const gridPy = py + sideH + 8
    const gridPh = ph - sideH - 10

    // Grid geometry uses a square 2.5m cell so length / beam reads like a real ship.
    const cellPx = Math.max(3, Math.floor(Math.min((pw * 0.66) / spec.cols, (gridPh * 0.88) / spec.rows)))
    const CW = cellPx
    const CH = cellPx
    const gridW = CW * spec.cols
    const gridH = CH * spec.rows
    const gx = px + (pw - gridW) / 2  // grid left edge
    const gy = gridPy + (gridPh - gridH) / 2  // grid top edge

    this.drawSideProfile(px + 18, py + 8, pw - 36, sideH - 6, hull, spec, cellPx)
    this.drawArmamentViewSwitch(px + pw - 188, py + 10, 170, 30, showAccessKeys)

    const hw = spec.beamCells / 2
    const hh = spec.lengthCells / 2

    // Hull background silhouette (draw first, behind grid)
    this.drawShipTopDown(
      ctx,
      gx + cellCenter(spec.centerC) * CW,
      gy + (spec.topR + spec.lengthCells / 2) * CH,
      CW * hw * 1.02,
      CH * hh * 1.02,
      hull,
      false,
      'grid',
      false,
    )

    this.drawDeckStructure(gx, gy, CW, CH, hull, spec)

    // Draw all grid cells
    for (let r = 0; r < spec.rows; r++) {
      for (let c = 0; c < spec.cols; c++) {
        const cellX = gx + c * CW
        const cellY = gy + r * CH

        if (!isInsideHullCell(c, r, spec)) {
          // Outside hull: skip (transparent)
          continue
        }

        const isOccupied = occupied.has(cellKey(c, r))
        if (isOccupied) {
          ctx.strokeStyle = 'rgba(30,60,36,0.30)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(cellX + 0.5, cellY + 0.5, CW - 1, CH - 1)
        } else {
          // Interior non-slot cell: faint grid line only
          const moveTarget = this.selectedSlotId || this.selectedTower
            ? moveTargetState(hull, c, r, placements, spec, { slotId: this.selectedSlotId, tower: this.selectedTower })
            : 'none'
          if (moveTarget === 'valid') {
            const onCenterline = c === spec.centerC
            ctx.fillStyle = onCenterline ? 'rgba(234,179,8,0.22)' : 'rgba(184,148,32,0.14)'
            ctx.fillRect(cellX, cellY, CW, CH)
            ctx.strokeStyle = onCenterline ? 'rgba(250,204,21,0.88)' : 'rgba(184,148,32,0.70)'
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
    const clx = gx + cellCenter(spec.centerC) * CW
    ctx.beginPath(); ctx.moveTo(clx, gy); ctx.lineTo(clx, gy + gridH); ctx.stroke()
    ctx.setLineDash([]); ctx.restore()

    // Port / Starboard labels
    ctx.font = '14px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
    ctx.fillText('▲ 艦首', clx, py + 19)
    ctx.fillText('▼ 艦尾', clx, py + ph - 6)
    ctx.textAlign = 'right'; ctx.fillText('← 左舷', gx - 6, gy + gridH / 2 + 5)
    ctx.textAlign = 'left';  ctx.fillText('右舷 →', gx + gridW + 6, gy + gridH / 2 + 5)
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.round(spec.lengthM)}m x ${spec.beamM.toFixed(1)}m / 1セル ${GRID_CELL_METERS}m`, clx, gy - 14)

    // Column & row guides (faint numbers)
    ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(50,90,56,0.5)'; ctx.textAlign = 'center'
    for (let c = 0; c < spec.cols; c++) {
      if (c % 2 === 0) ctx.fillText(`${c}`, gx + c * CW + CW / 2, gy - 3)
    }
    ctx.textAlign = 'right'
    for (let r = 0; r < spec.rows; r += 4) {
      ctx.fillText(`${Math.round((r - spec.topR) * GRID_CELL_METERS)}`, gx - 2, gy + r * CH + CH / 2 + 3)
    }
  }

  private drawPreview3dArea(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry, showAccessKeys: boolean): void {
    const ctx = this.ctx
    const previewX = px + 18
    const previewY = py + 52
    const previewW = pw - 36
    const previewH = ph - 82

    ctx.fillStyle = '#071117'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = 'rgba(45,90,104,0.36)'
    ctx.lineWidth = 1
    for (let y = py + 60; y < py + ph; y += 36) {
      ctx.beginPath()
      for (let x = px; x <= px + pw; x += 8) {
        const wy = y + Math.sin(x * 0.018) * 3
        x === px ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy)
      }
      ctx.stroke()
    }

    ctx.fillStyle = 'rgba(6,17,23,0.72)'
    ctx.fillRect(previewX - 1, previewY - 1, previewW + 2, previewH + 2)
    ctx.strokeStyle = '#2e393d'
    ctx.strokeRect(previewX - 1, previewY - 1, previewW + 2, previewH + 2)

    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = '#d7b56d'
    ctx.textAlign = 'left'
    ctx.fillText('3D確認', px + 18, py + 30)
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#91a3a8'
    ctx.fillText(`${hull.name} / 兵装 ${this.previewConfig(hull).weapons.length}基 / 装甲 +${this.armorBonus}`, px + 90, py + 30)
    this.drawArmamentViewSwitch(px + pw - 188, py + 10, 170, 30, showAccessKeys)

    this.shipPreview.setViewportFromCanvas(this.canvas, previewX, previewY, previewW, previewH)
    this.shipPreview.show(this.previewConfig(hull))
  }

  private drawArmamentViewSwitch(x: number, y: number, w: number, h: number, showAccessKeys: boolean): void {
    const ctx = this.ctx
    const views: { view: ArmamentView; label: string }[] = [
      { view: 'grid', label: '配置図' },
      { view: 'preview3d', label: '3D確認' },
    ]
    const cellW = w / views.length
    for (let i = 0; i < views.length; i++) {
      const item = views[i]!
      const bx = x + i * cellW
      const active = this.armamentView === item.view
      const hovered = this.hovered?.tag === 'armament-view' && this.hovered.view === item.view
      ctx.fillStyle = active ? '#263239' : hovered ? '#16251f' : '#0c1810'
      ctx.fillRect(bx, y, cellW, h)
      ctx.strokeStyle = active ? '#d7b56d' : '#2e393d'
      ctx.strokeRect(bx, y, cellW, h)
      ctx.font = `${active ? 'bold ' : ''}13px sans-serif`
      ctx.fillStyle = active ? '#eef4f3' : '#91a3a8'
      ctx.textAlign = 'center'
      ctx.fillText(item.label, bx + cellW / 2, y + h * 0.67)
      const region: Region = { tag: 'armament-view', view: item.view, x: bx, y, w: cellW, h }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, bx + 5, y + 5)
      this.addRegion(region)
    }
  }

  private drawPlacement(gx: number, gy: number, cw: number, ch: number, placement: Placement): void {
    const ctx = this.ctx
    const rect = footprintRect(placement.cell, placement.footprint)
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
    ctx.font = `bold ${Math.min(15, Math.max(10, cw * 0.68))}px sans-serif`
    ctx.fillStyle = placement.weapon ? '#e8f2e8' : DIM
    ctx.textAlign = 'center'
    const lbl = placement.weapon ? TYPE_JP[placement.weapon.type] : placement.slot!.label.slice(0, 3)
    ctx.fillText(lbl, x + w / 2, y + h + Math.min(10, ch * 0.72))
    this.addRegion({ tag: 'grid-slot', slotId: placement.id, x, y, w, h })
  }

  // ── Weapon palette (right) ────────────────────────────────────────────────

  private drawWeaponPalette(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry, showAccessKeys: boolean): void {
    const ctx = this.ctx

    // Hull title
    ctx.font = 'bold 19px sans-serif'; ctx.fillStyle = TEXT; ctx.textAlign = 'left'
    ctx.fillText(hull.name, px + 12, py + 28)
    ctx.font = '15px sans-serif'; ctx.fillStyle = DIM
    ctx.fillText(hull.className, px + 12, py + 50)

    // Selected slot info
    const selSlot = hull.slots.find(s => s.id === this.selectedSlotId)
    const infoY = py + 64
    ctx.fillStyle = selSlot ? SEL : '#080e08'; ctx.fillRect(px + 6, infoY, pw - 12, 36)
    ctx.strokeStyle = selSlot ? '#3a9a4a' : '#1a3020'; ctx.lineWidth = 1
    ctx.strokeRect(px + 6, infoY, pw - 12, 36)
    ctx.font = '15px sans-serif'; ctx.textAlign = 'left'
    if (selSlot) {
      ctx.fillStyle = '#90d090'
      ctx.fillText(`スロット: ${selSlot.label}`, px + 12, infoY + 24)
      const compat = selSlot.compatibleTypes.map(t => TYPE_JP[t] ?? t).join(' / ')
      ctx.fillStyle = DIM; ctx.textAlign = 'right'
      ctx.fillText(compat, px + pw - 12, infoY + 24)
    } else {
      ctx.fillStyle = DIM; ctx.fillText('グリッドのスロットを選択', px + 12, infoY + 24)
    }

    // Weapon type tabs
    const tabY = infoY + 44
    const tabW = (pw - 12) / TYPE_TABS.length
    for (let i = 0; i < TYPE_TABS.length; i++) {
      const t = TYPE_TABS[i]!; const tx = px + 6 + i * tabW
      const active = this.weaponFilter === t.filter
      ctx.fillStyle = active ? ACCENT : '#0c1810'; ctx.fillRect(tx, tabY, tabW, 32)
      ctx.strokeStyle = active ? '#3a9a4a' : '#1a3020'; ctx.lineWidth = 1; ctx.strokeRect(tx, tabY, tabW, 32)
      ctx.font = `${active ? 'bold ' : ''}12px sans-serif`
      ctx.fillStyle = active ? '#cce8cc' : DIM; ctx.textAlign = 'center'
      ctx.fillText(t.label, tx + tabW / 2, tabY + 22)
      const region: Region = { tag: 'type-tab', filter: t.filter, x: tx, y: tabY, w: tabW, h: 32 }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, tx + 4, tabY + 5)
      this.addRegion(region)
    }

    // Weapon cards
    const listY = tabY + 42
    const listH = ph - (listY - py) - 6
    const cardH = 78, cardW = pw - 12
    let cy = listY

    // Determine which weapons to show
    const showAll = !selSlot
    const weapons = this.visibleWeapons(hull)

    // Clip to list area
    ctx.save(); ctx.beginPath(); ctx.rect(px, listY, pw, listH); ctx.clip()

    for (const w of weapons) {
      if (cy + cardH > listY + listH) break
      const isCur = selSlot ? this.slotWeapons.get(selSlot.id)?.id === w.id : false
      const isHov = this.hovered?.tag === 'weapon-card' && this.hovered.weaponId === w.id
      const compatible = !selSlot || selSlot.compatibleTypes.includes(w.type)
      const wCol = TYPE_COLOR[w.type] ?? DIM

      // Count how many slots currently have this weapon
      const equippedCount = hull.slots.filter(s => this.slotWeapons.get(s.id)?.id === w.id).length
      const hasCompatibleEmpty = hull.slots.some(s =>
        s.compatibleTypes.includes(w.type) && !this.slotWeapons.has(s.id)
      )

      ctx.fillStyle = equippedCount > 0 ? '#0a2a14' : isHov && compatible ? '#0f1e12' : '#080e08'
      ctx.fillRect(px + 6, cy, cardW, cardH)
      ctx.strokeStyle = equippedCount > 0 ? '#3a9a4a' : compatible ? '#1e3824' : '#0f1810'
      ctx.lineWidth = equippedCount > 0 ? 1.5 : 1
      ctx.strokeRect(px + 6, cy, cardW, cardH)

      // Type badge
      ctx.fillStyle = wCol + '30'; ctx.fillRect(px + 8, cy + 6, 42, cardH - 12)
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = wCol; ctx.textAlign = 'center'
      ctx.fillText(TYPE_JP[w.type]!, px + 29, cy + cardH / 2 + 4)

      // Name and desc
      ctx.font = `bold 16px sans-serif`
      ctx.fillStyle = compatible ? TEXT : DIM; ctx.textAlign = 'left'
      ctx.fillText(w.name, px + 60, cy + 23)
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#3a5a3a'
      ctx.fillText(w.desc, px + 60, cy + 44)
      ctx.fillStyle = DIM; ctx.fillText(`弾数: ${w.ammo}`, px + 60, cy + 64)

      // +/- count buttons (always visible for compatible weapons)
      if (compatible) {
        const btnW = 24, btnH = 24, btnY2 = cy + (cardH - btnH) / 2
        const cntX = px + pw - 12   // right edge
        const plusX = cntX - btnW
        const countLabelX = plusX - 4
        const minusX = countLabelX - 28 - btnW

        // + button
        const canInc = hasCompatibleEmpty
        const isHovInc = this.hovered?.tag === 'weapon-inc' && this.hovered.weaponId === w.id
        ctx.fillStyle = canInc ? (isHovInc ? ACCENT : '#0f2414') : '#080f0a'
        ctx.fillRect(plusX, btnY2, btnW, btnH)
        ctx.strokeStyle = canInc ? '#2a6a30' : '#1a2a1a'; ctx.lineWidth = 1
        ctx.strokeRect(plusX, btnY2, btnW, btnH)
        ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = canInc ? '#a0d0a0' : DIM; ctx.textAlign = 'center'
        ctx.fillText('+', plusX + btnW / 2, btnY2 + 17)

        // Count
        ctx.font = 'bold 18px sans-serif'
        ctx.fillStyle = equippedCount > 0 ? '#3a9a4a' : DIM; ctx.textAlign = 'right'
        ctx.fillText(`${equippedCount}`, countLabelX, btnY2 + 17)

        // - button
        const canDec = equippedCount > 0
        const isHovDec = this.hovered?.tag === 'weapon-dec' && this.hovered.weaponId === w.id
        ctx.fillStyle = canDec ? (isHovDec ? '#2a1414' : '#0f1414') : '#080f0a'
        ctx.fillRect(minusX, btnY2, btnW, btnH)
        ctx.strokeStyle = canDec ? '#6a2a2a' : '#1a2a1a'
        ctx.strokeRect(minusX, btnY2, btnW, btnH)
        ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = canDec ? '#d09090' : DIM; ctx.textAlign = 'center'
        ctx.fillText('−', minusX + btnW / 2, btnY2 + 17)

        if (canInc) this.addRegion({ tag: 'weapon-inc', weaponId: w.id, x: plusX, y: btnY2, w: btnW, h: btnH })
        if (canDec) this.addRegion({ tag: 'weapon-dec', weaponId: w.id, x: minusX, y: btnY2, w: btnW, h: btnH })
      }

      if (isCur && selSlot) {
        ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#3a9a4a'; ctx.textAlign = 'right'
        ctx.fillText('✓', px + pw - 80, cy + 29)
      }

      if (compatible && selSlot) {
        const region: Region = { tag: 'weapon-card', weaponId: w.id, x: px + 6, y: cy, w: cardW - 90, h: cardH }
        this.addRegion(region)
        if (showAccessKeys) this.drawRegionAccessHint(ctx, region, px + pw - 116, cy + 17)
      }
      cy += cardH + 4
    }

    if (weapons.length === 0) {
      ctx.font = '16px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
      ctx.fillText('該当なし', px + pw / 2, listY + 38)
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
      ctx.font = '18px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
      ctx.fillText('艦体を選択してください', x + cw / 2, y + ch / 2 + 4)
      return
    }

    const totalArmor = hull.armor + this.armorBonus
    const effectiveSpeed = hull.maxSpeed / (1 + totalArmor * ARMOR_WEIGHT_K)

    const stats = [
      { label: '耐久力', value: `${hull.hp}`,                         barR: hull.hp / 2100,         col: '#22c55e' },
      { label: '速力',   value: `${effectiveSpeed.toFixed(1)}kt`,     barR: effectiveSpeed / 7.2,   col: '#38bdf8' },
      { label: '旋回',   value: `${(hull.turnRate * 1000 | 0) / 10}`, barR: hull.turnRate / 0.046,  col: '#fb923c' },
      { label: '尺度',   value: `${Math.round(hullDimensions(hull).lengthM)}m`, barR: hullDimensions(hull).lengthM / 270, col: '#a78bfa' },
    ]

    const statAreaW = cw * 0.68
    const colW = statAreaW / stats.length
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!; const sx = x + colW * i + 14
      ctx.font = '14px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
      ctx.fillText(s.label, sx, y + 21)
      const bw = colW - 22
      ctx.fillStyle = '#0a1810'; ctx.fillRect(sx, y + 29, bw, 9)
      ctx.fillStyle = s.col; ctx.fillRect(sx, y + 29, bw * Math.min(1, s.barR), 9)
      ctx.font = 'bold 21px sans-serif'; ctx.fillStyle = '#b0d8b0'
      ctx.fillText(s.value, sx, y + 66)
    }

    // Armor control section
    const armX = x + statAreaW + 8
    const armW = cw * 0.19
    this.drawArmorControl(armX, y, armW, ch, hull, totalArmor)

    // Weapon count (far right)
    const filled = this.slotWeapons.size
    ctx.font = '14px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'right'
    ctx.fillText('兵装', x + cw - 14, y + 21)
    ctx.font = 'bold 23px sans-serif'
    ctx.fillStyle = filled === hull.slots.length ? GREEN : YELLOW
    ctx.fillText(`${filled} / ${hull.slots.length}`, x + cw - 14, y + 66)
  }

  private drawArmorControl(ax: number, ay: number, aw: number, ah: number, hull: HullCatalogEntry, totalArmor: number): void {
    const ctx = this.ctx
    const mitigation = totalArmor / (totalArmor + 100)

    ctx.font = '13px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
    ctx.fillText('装甲', ax, ay + 19)
    ctx.fillStyle = '#6a9a6a'; ctx.textAlign = 'right'
    ctx.fillText(`軽減${(mitigation * 100 | 0)}%`, ax + aw - 4, ay + 19)

    const bw = aw - 8
    const barY = ay + 27
    const barH = 10
    const maxTotalArmor = hull.armor + ARMOR_BONUS_MAX
    const totalRatio = maxTotalArmor > 0 ? totalArmor / maxTotalArmor : 0
    const baseRatio = maxTotalArmor > 0 ? hull.armor / maxTotalArmor : 0
    const isBarHovered = this.hovered?.tag === 'armor-bar'

    ctx.fillStyle = isBarHovered ? '#102414' : '#0a1810'
    ctx.fillRect(ax, barY, bw, barH)
    ctx.fillStyle = '#1f4a2a'
    ctx.fillRect(ax, barY, bw * baseRatio, barH)
    ctx.fillStyle = isBarHovered ? '#58b86a' : '#3a7a4a'
    ctx.fillRect(ax, barY, bw * Math.min(1, totalRatio), barH)
    ctx.strokeStyle = isBarHovered ? '#70c878' : '#245a2e'
    ctx.strokeRect(ax, barY, bw, barH)
    ctx.fillStyle = '#d6b86a'
    ctx.fillRect(ax + bw * baseRatio - 1, barY - 2, 2, barH + 4)
    this.addRegion({ tag: 'armor-bar', x: ax, y: barY - 6, w: bw, h: barH + 12 })

    const btnW = 26, btnH = 22, btnY = ay + 46
    const midX = ax + aw / 2

    const canDown = this.armorBonus > 0
    const canUp   = this.armorBonus < ARMOR_BONUS_MAX
    const downX = midX - 56
    const upX   = midX + 30

    ctx.fillStyle = canDown ? '#0d2010' : '#08100a'
    ctx.fillRect(downX, btnY, btnW, btnH)
    ctx.strokeStyle = canDown ? '#2a6030' : '#1a2a1a'; ctx.lineWidth = 1
    ctx.strokeRect(downX, btnY, btnW, btnH)
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = canDown ? '#70b070' : DIM; ctx.textAlign = 'center'
    ctx.fillText('−', downX + btnW / 2, btnY + 15)

    const bonusLabel = this.armorBonus > 0 ? `${hull.armor}+${this.armorBonus}` : `${hull.armor}`
    ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#b0d8b0'; ctx.textAlign = 'center'
    ctx.fillText(bonusLabel, midX, btnY + 16)

    ctx.fillStyle = canUp ? '#0d2010' : '#08100a'
    ctx.fillRect(upX, btnY, btnW, btnH)
    ctx.strokeStyle = canUp ? '#2a6030' : '#1a2a1a'
    ctx.strokeRect(upX, btnY, btnW, btnH)
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = canUp ? '#70b070' : DIM; ctx.textAlign = 'center'
    ctx.fillText('+', upX + btnW / 2, btnY + 15)

    if (canDown) this.addRegion({ tag: 'armor-down', x: downX, y: btnY, w: btnW, h: btnH })
    if (canUp)   this.addRegion({ tag: 'armor-up',   x: upX,   y: btnY, w: btnW, h: btnH })
  }

  private setArmorBonusFromBar(mx: number, r: Extract<Region, { tag: 'armor-bar' }>): void {
    const ratio = Math.max(0, Math.min(1, (mx - r.x) / Math.max(1, r.w)))
    const stepped = Math.round((ratio * ARMOR_BONUS_MAX) / ARMOR_BONUS_STEP) * ARMOR_BONUS_STEP
    this.armorBonus = Math.max(0, Math.min(ARMOR_BONUS_MAX, stepped))
  }

  private visibleWeapons(hull: HullCatalogEntry): ShopWeapon[] {
    const selSlot = hull.slots.find(s => s.id === this.selectedSlotId)
    const hullTypes = new Set(hull.slots.flatMap(s => s.compatibleTypes))
    return WEAPON_SHOP.filter(w => {
      if (w.minStage > this.stage) return false
      if (this.weaponFilter !== 'all' && w.type !== this.weaponFilter) return false
      if (selSlot) return selSlot.compatibleTypes.includes(w.type)
      return hullTypes.has(w.type)
    })
  }

  // ── Button bar ────────────────────────────────────────────────────────────

  private renderButtons(x: number, y: number, cw: number, ch: number, showAccessKeys: boolean): void {
    const ctx = this.ctx
    ctx.fillStyle = '#060c06'; ctx.fillRect(x, y, cw, ch)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.stroke()

    if (this.tab === 'armament') {
      this.drawBtn(x + 12, y + 8, 154, ch - 16, '← 艦体選択', PANEL, TEXT, 18)
      const region: Region = { tag: 'back', x: x + 12, y: y + 8, w: 154, h: ch - 16 }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, x + 20, y + 16)
      this.addRegion(region)
    }
    if (this.tab === 'hull' && this.selectedHull()) {
      this.drawBtn(x + 12, y + 8, 164, ch - 16, '兵装配置 →', ACCENT, '#cceccc', 18)
      const region: Region = { tag: 'main-tab', tab: 'armament', x: x + 12, y: y + 8, w: 164, h: ch - 16, accessKey: 'SPACE' }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, x + 20, y + 16)
      this.addRegion(region)
    }

    const hull = this.selectedHull()
    const bw = 260, bx2 = x + cw - bw - 12
    this.drawBtn(bx2, y + 8, bw, ch - 16, '出撃準備完了 →', hull ? GREEN : '#0a1810', hull ? '#fff' : DIM, 19)
    if (hull) {
      const region: Region = { tag: 'deploy', x: bx2, y: y + 8, w: bw, h: ch - 16, accessKey: 'SPACE' }
      if (showAccessKeys) this.drawRegionAccessHint(ctx, region, bx2 + 8, y + 16)
      this.addRegion(region)
    }
  }

  // ── Drawing utilities ─────────────────────────────────────────────────────

  private drawShipTopDown(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    hw: number,
    hh: number,
    hull: HullCatalogEntry,
    locked: boolean,
    mode: ShipPreviewMode = 'card',
    showSlots = true,
  ): void {
    if (hull.templateId === 'hull.bb.yukimura') {
      this.drawYukimuraTopDown(ctx, cx, cy, hw, hh, locked, mode)
      return
    }

    ctx.beginPath(); this.buildHullPath(ctx, cx, cy, hw, hh)
    ctx.fillStyle = locked ? '#090f0a'
      : mode === 'grid'
        ? hull.shipType === 'destroyer' ? '#102218'
          : hull.shipType === 'cruiser' ? '#14271c'
          : '#193022'
        : hull.shipType === 'destroyer'  ? '#0d1e12'
          : hull.shipType === 'cruiser'  ? '#112018'
          : '#162a1c'
    ctx.fill(); ctx.strokeStyle = locked ? '#1a2a1a' : BORDER; ctx.lineWidth = 1; ctx.stroke()
    ctx.strokeStyle = locked ? '#152015' : (mode === 'grid' ? '#365740' : 'rgba(170,210,170,0.22)')
    ctx.beginPath(); ctx.moveTo(cx, cy - hh * 0.82); ctx.lineTo(cx, cy + hh * 0.72); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - hw * 0.36, cy - hh * 0.20); ctx.lineTo(cx + hw * 0.36, cy - hh * 0.20); ctx.stroke()
    const towerW = hull.shipType === 'battleship' ? hw * 0.42 : hw * 0.32
    const towerH = hull.shipType === 'destroyer' ? hh * 0.15 : hh * 0.20
    ctx.fillStyle = locked ? '#101a10' : (mode === 'grid' ? '#2a4030' : '#243827')
    ctx.fillRect(cx - towerW / 2, cy - towerH * 0.2, towerW, towerH)
    ctx.strokeStyle = locked ? '#1a2a1a' : '#d6b86a'
    ctx.strokeRect(cx - towerW / 2, cy - towerH * 0.2, towerW, towerH)
    if (showSlots) {
      for (const slot of hull.slots) {
        const sx = cx + slot.x * hw * 0.82
        const sy = cy + slot.y * hh * 0.88
        ctx.beginPath(); ctx.ellipse(sx, sy, 3.2, 2.1, 0, 0, Math.PI * 2)
        ctx.fillStyle = locked ? DIM : (TYPE_COLOR[slot.compatibleTypes[0]!] ?? '#2a6a3a'); ctx.fill()
      }
    }
  }

  private drawYukimuraTopDown(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    hw: number,
    hh: number,
    locked: boolean,
    mode: ShipPreviewMode = 'card',
  ): void {
    const snow = locked ? '#1d2528' : '#f8fafc'
    const shade = locked ? '#334155' : '#cbd5e1'
    const green = locked ? '#1f3a2d' : '#166534'
    const red = locked ? '#4a1d1d' : '#dc2626'
    const hullFill = mode === 'grid' ? '#15261c' : 'rgba(0,0,0,0.22)'

    ctx.save()
    ctx.fillStyle = hullFill
    polygonPath(ctx, facetedOvalPoints(cx, cy + hh * 0.12, hw * 0.92, hh * 0.62, 16, -Math.PI / 2))
    ctx.fill()

    for (const [ox, oy, rx, ry] of [
      [0, 0.24, 0.86, 0.58],
      [0, -0.12, 0.64, 0.46],
      [0, -0.45, 0.46, 0.34],
    ] as const) {
      polygonPath(ctx, facetedOvalPoints(cx + hw * ox, cy + hh * oy, hw * rx, hh * ry, 14, -Math.PI / 2))
      ctx.fillStyle = snow
      ctx.fill()
      ctx.strokeStyle = shade
      ctx.lineWidth = 1
      ctx.stroke()
    }

    polygonPath(ctx, facetedOvalPoints(cx, cy - hh * 0.70, hw * 0.52, hh * 0.18, 10, Math.PI / 10))
    ctx.fillStyle = green
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.30, cy - hh * 0.70)
    ctx.lineTo(cx - hw * 0.12, cy - hh * 0.92)
    ctx.lineTo(cx + hw * 0.22, cy - hh * 0.92)
    ctx.lineTo(cx + hw * 0.34, cy - hh * 0.70)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = red
    ctx.lineWidth = Math.max(2, hw * 0.10)
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.52, cy - hh * 0.16)
    ctx.lineTo(cx + hw * 0.52, cy - hh * 0.08)
    ctx.stroke()
    ctx.strokeStyle = green
    ctx.beginPath()
    ctx.moveTo(cx - hw * 0.14, cy - hh * 0.08)
    ctx.lineTo(cx + hw * 0.24, cy + hh * 0.34)
    ctx.stroke()

    ctx.fillStyle = locked ? '#92400e' : '#f59e0b'
    ctx.beginPath()
    const noseR = Math.max(2, hw * 0.09)
    ctx.moveTo(cx + noseR * 1.15, cy - hh * 0.46)
    ctx.lineTo(cx - noseR * 0.45, cy - hh * 0.46 - noseR * 0.68)
    ctx.lineTo(cx - noseR * 0.45, cy - hh * 0.46 + noseR * 0.68)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = locked ? '#111827' : '#020617'
    for (const ex of [-0.18, 0.18]) {
      const eyeR = Math.max(1.5, hw * 0.055)
      polygonPath(ctx, [
        [cx + hw * ex, cy - hh * 0.52 - eyeR],
        [cx + hw * ex + eyeR, cy - hh * 0.52],
        [cx + hw * ex, cy - hh * 0.52 + eyeR],
        [cx + hw * ex - eyeR, cy - hh * 0.52],
      ])
      ctx.fill()
    }
    ctx.restore()
  }

  private buildHullPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
    const steps = 56
    ctx.moveTo(cx, cy - hh)
    for (let i = 0; i <= steps; i++) {
      const ny = -1 + (2 / steps) * i
      ctx.lineTo(cx + hullMaxHalfWidth(ny) * hw, cy + ny * hh)
    }
    for (let i = steps; i >= 0; i--) {
      const ny = -1 + (2 / steps) * i
      ctx.lineTo(cx - hullMaxHalfWidth(ny) * hw, cy + ny * hh)
    }
    ctx.closePath()
  }

  private drawDeckStructure(gx: number, gy: number, cw: number, ch: number, hull: HullCatalogEntry, spec: GridSpec): void {
    const ctx = this.ctx
    const gridW = cw * spec.cols
    const gridH = ch * spec.rows
    const hullH = ch * spec.lengthCells
    const cx = gx + cellCenter(spec.centerC) * cw
    const bowY = gy + spec.topR * ch
    ctx.save()
    ctx.strokeStyle = 'rgba(151,191,151,0.16)'
    ctx.lineWidth = 1
    for (const xMul of [-0.28, 0, 0.28]) {
      ctx.beginPath()
      ctx.moveTo(cx + xMul * spec.beamCells * cw * 0.72, bowY + hullH * 0.10)
      ctx.lineTo(cx + xMul * spec.beamCells * cw * 0.56, bowY + hullH * 0.90)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(151,191,151,0.11)'
    for (const yMul of [0.18, 0.34, 0.52, 0.70, 0.84]) {
      const half = hullMaxHalfWidth(yMul * 2 - 1) * spec.beamCells * cw * 0.50
      ctx.beginPath()
      ctx.moveTo(cx - half, bowY + hullH * yMul)
      ctx.lineTo(cx + half, bowY + hullH * yMul)
      ctx.stroke()
    }
    if (hull.shipType !== 'destroyer') {
      ctx.fillStyle = 'rgba(120,155,130,0.12)'
      ctx.fillRect(cx - cw * Math.min(3.2, spec.beamCells * 0.38), bowY + hullH * 0.39, cw * Math.min(6.4, spec.beamCells * 0.76), ch * 5)
      ctx.strokeStyle = 'rgba(190,220,190,0.18)'
      ctx.strokeRect(cx - cw * Math.min(3.2, spec.beamCells * 0.38), bowY + hullH * 0.39, cw * Math.min(6.4, spec.beamCells * 0.76), ch * 5)
    }
    ctx.restore()
  }

  private drawSideProfile(x: number, y: number, w: number, h: number, hull: HullCatalogEntry, spec: GridSpec, cellPx: number): void {
    const ctx = this.ctx
    const lengthPx = Math.min(w, spec.lengthCells * cellPx)
    const beamRatio = spec.beamM / spec.lengthM
    const hullH = Math.max(8, Math.min(h * 0.36, lengthPx * beamRatio * 0.72))
    const sx = x + (w - lengthPx) / 2
    const waterY = y + h * 0.72
    const deckY = waterY - hullH
    const bow = sx
    const stern = sx + lengthPx

    ctx.save()
    ctx.strokeStyle = 'rgba(90,130,160,0.28)'
    ctx.lineWidth = 0.5
    for (let gx = sx; gx <= stern; gx += cellPx * 4) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke()
    }
    for (let gy = y; gy <= y + h; gy += Math.max(6, cellPx * 2)) {
      ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(stern, gy); ctx.stroke()
    }

    if (hull.templateId === 'hull.bb.yukimura') {
      this.drawYukimuraSideProfile(ctx, sx, y, lengthPx, h, waterY, deckY)
      ctx.restore()
      return
    }

    ctx.beginPath()
    ctx.moveTo(bow, waterY - hullH * 0.15)
    ctx.lineTo(bow + lengthPx * 0.08, deckY)
    ctx.lineTo(stern - lengthPx * 0.10, deckY)
    ctx.lineTo(stern, waterY - hullH * 0.22)
    ctx.lineTo(stern - lengthPx * 0.03, waterY)
    ctx.lineTo(bow + lengthPx * 0.08, waterY)
    ctx.closePath()
    ctx.fillStyle = 'rgba(20,42,34,0.92)'
    ctx.fill()
    ctx.strokeStyle = '#9fb8c6'
    ctx.lineWidth = 1
    ctx.stroke()

    const towerX = sx + lengthPx * (hull.shipType === 'destroyer' ? 0.38 : hull.shipType === 'cruiser' ? 0.62 : 0.49)
    const towerW = Math.max(10, lengthPx * (hull.shipType === 'battleship' ? 0.055 : 0.045))
    const towerH = Math.max(16, h * (hull.shipType === 'battleship' ? 0.42 : 0.34))
    ctx.fillStyle = 'rgba(214,184,106,0.18)'
    ctx.fillRect(towerX - towerW / 2, deckY - towerH, towerW, towerH)
    ctx.strokeStyle = '#d6b86a'
    ctx.strokeRect(towerX - towerW / 2, deckY - towerH, towerW, towerH)
    ctx.beginPath()
    ctx.moveTo(towerX, deckY - towerH)
    ctx.lineTo(towerX, deckY - towerH - h * 0.22)
    ctx.stroke()

    const gunCount = hull.shipType === 'battleship' ? 3 : hull.shipType === 'cruiser' ? 2 : 1
    ctx.strokeStyle = '#f6d18a'
    ctx.fillStyle = 'rgba(249,115,22,0.18)'
    for (let i = 0; i < gunCount; i++) {
      const t = gunCount === 1 ? 0.28 : 0.18 + i * (0.62 / Math.max(1, gunCount - 1))
      const gx = sx + lengthPx * t
      ctx.fillRect(gx - 5, deckY - 6, 10, 6)
      ctx.beginPath(); ctx.moveTo(gx, deckY - 6); ctx.lineTo(gx + 20, deckY - 11); ctx.stroke()
    }

    ctx.font = '9px sans-serif'
    ctx.fillStyle = DIM
    ctx.textAlign = 'left'
    ctx.fillText(`側面図 ${Math.round(spec.lengthM)}m`, sx, y + 10)
    ctx.textAlign = 'right'
    ctx.fillText(`幅 ${spec.beamM.toFixed(1)}m`, stern, y + 10)
    ctx.restore()
  }

  private drawYukimuraSideProfile(ctx: CanvasRenderingContext2D, sx: number, y: number, lengthPx: number, h: number, waterY: number, deckY: number): void {
    const cx = sx + lengthPx * 0.48
    const baseR = Math.max(14, h * 0.28)
    ctx.fillStyle = 'rgba(15,23,42,0.28)'
    polygonPath(ctx, facetedOvalPoints(cx, waterY, lengthPx * 0.36, h * 0.10, 14))
    ctx.fill()

    for (const [ox, lift, rx, ry] of [
      [-0.08, 0.00, 1.18, 0.78],
      [0.02, 0.34, 0.84, 0.66],
      [0.10, 0.66, 0.58, 0.48],
    ] as const) {
      polygonPath(ctx, facetedOvalPoints(cx + lengthPx * ox, waterY - baseR * lift, baseR * rx, baseR * ry, 14))
      ctx.fillStyle = '#f8fafc'
      ctx.fill()
      ctx.strokeStyle = '#cbd5e1'
      ctx.stroke()
    }

    polygonPath(ctx, facetedOvalPoints(cx + lengthPx * 0.10, waterY - baseR * 0.98, baseR * 0.62, baseR * 0.18, 10, Math.PI / 10))
    ctx.fillStyle = '#166534'
    ctx.fill()
    ctx.strokeStyle = '#22c55e'
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + lengthPx * 0.10 - baseR * 0.36, waterY - baseR * 0.98)
    ctx.lineTo(cx + lengthPx * 0.10 - baseR * 0.12, waterY - baseR * 1.34)
    ctx.lineTo(cx + lengthPx * 0.10 + baseR * 0.26, waterY - baseR * 1.34)
    ctx.lineTo(cx + lengthPx * 0.10 + baseR * 0.42, waterY - baseR * 0.98)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = Math.max(3, h * 0.030)
    ctx.beginPath()
    ctx.moveTo(cx - baseR * 0.72, waterY - baseR * 0.42)
    ctx.lineTo(cx + baseR * 0.72, waterY - baseR * 0.38)
    ctx.stroke()
    ctx.strokeStyle = '#15803d'
    ctx.beginPath()
    ctx.moveTo(cx + baseR * 0.05, waterY - baseR * 0.34)
    ctx.lineTo(cx + baseR * 0.36, waterY + baseR * 0.20)
    ctx.stroke()

    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    const noseR = Math.max(3, baseR * 0.12)
    ctx.moveTo(cx + lengthPx * 0.20 + noseR * 1.2, waterY - baseR * 0.66)
    ctx.lineTo(cx + lengthPx * 0.20 - noseR * 0.4, waterY - baseR * 0.66 - noseR * 0.7)
    ctx.lineTo(cx + lengthPx * 0.20 - noseR * 0.4, waterY - baseR * 0.66 + noseR * 0.7)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = '#f8fafc'
    ctx.fillStyle = 'rgba(248,250,252,0.46)'
    for (const t of [0.28, 0.46, 0.64]) {
      const gx = sx + lengthPx * t
      ctx.fillRect(gx - 5, deckY - 6, 10, 6)
      ctx.beginPath()
      ctx.moveTo(gx, deckY - 6)
      ctx.lineTo(gx + 20, deckY - 12)
      ctx.stroke()
    }

    ctx.font = '9px sans-serif'
    ctx.fillStyle = DIM
    ctx.textAlign = 'left'
    ctx.fillText('側面図 雪だるま艦', sx, y + 10)
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
    ctx.font = '14px sans-serif'; ctx.fillStyle = locked ? DIM : '#4a7a4a'; ctx.textAlign = 'left'
    ctx.fillText(label, x, y + 14)
    ctx.fillStyle = '#0a1810'; ctx.fillRect(x + 48, y + 1, w - 112, 13)
    ctx.fillStyle = locked ? DIM : barColor; ctx.fillRect(x + 48, y + 1, (w - 112) * Math.min(1, ratio), 13)
    ctx.font = '14px sans-serif'; ctx.fillStyle = locked ? DIM : TEXT; ctx.textAlign = 'right'
    ctx.fillText(value, x + w, y + 14)
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

  private drawRegionAccessHint(ctx: CanvasRenderingContext2D, r: Region, x: number, y: number): void {
    const key = this.accessKeyForRegion(r)
    if (key) drawAccessKeyHint(ctx, key, x, y)
  }

  private accessKeyForRegion(r: Region): string | null {
    if (r.accessKey) return r.accessKey
    if (r.tag === 'main-tab') return r.tab === 'hull' ? 'H' : 'A'
    if (r.tag === 'class-tab') return classAccessKey(r.shipType)
    if (r.tag === 'type-tab') return filterAccessKey(r.filter)
    if (r.tag === 'armament-view') return r.view === 'grid' ? 'G' : 'V'
    if (r.tag === 'hull-card') return r.index < 9 ? String(r.index + 1) : null
    if (r.tag === 'weapon-card') {
      const visibleWeaponCards = this.regions.filter(x => x.tag === 'weapon-card')
      const index = visibleWeaponCards.findIndex(x => x === r)
      return index >= 0 && index < 9 ? String(index + 1) : null
    }
    if (r.tag === 'armor-down') return '-'
    if (r.tag === 'armor-up') return '+'
    if (r.tag === 'deploy') return 'P'
    if (r.tag === 'back') return 'H'
    return null
  }

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

function classAccessKey(shipType: PlayerShipType): string {
  if (shipType === 'destroyer') return 'D'
  if (shipType === 'cruiser') return 'C'
  return 'B'
}

function filterAccessKey(filter: WeaponFilter): string {
  if (filter === 'all') return 'L'
  if (filter === 'gun') return 'G'
  if (filter === 'secondary') return 'S'
  if (filter === 'torpedo') return 'T'
  if (filter === 'aa') return 'F'
  return 'M'
}

function polygonPath(ctx: CanvasRenderingContext2D, points: [number, number][]): void {
  ctx.beginPath()
  ctx.moveTo(points[0]![0], points[0]![1])
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
  ctx.closePath()
}

function facetedOvalPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  facets: number,
  phase = 0,
): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < facets; i++) {
    const a = phase + (Math.PI * 2 * i) / facets
    const wobble = 1 + (i % 3 === 0 ? 0.04 : i % 3 === 1 ? -0.025 : 0.012)
    pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble])
  }
  return pts
}
