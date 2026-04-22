import type { WeaponTemplate, PlayerShipType } from '../data/masterdata'
import { getHullsByClass, type HullCatalogEntry, type HullSlot } from '../data/hull-catalog'
import { WEAPON_SHOP, TYPE_COLOR, TYPE_JP, type ShopWeapon } from '../data/weapon-shop'
import type { WeaponType } from '../simulation/types'

export interface PrepResult {
  templateId: string
  shipType: PlayerShipType
  loadout: WeaponTemplate[]
}

type ScreenTab = 'hull' | 'armament'

type Region =
  | { tag: 'class-tab';  shipType: PlayerShipType; x: number; y: number; w: number; h: number }
  | { tag: 'hull-card';  index: number;             x: number; y: number; w: number; h: number }
  | { tag: 'main-tab';   tab: ScreenTab;            x: number; y: number; w: number; h: number }
  | { tag: 'slot-card';  slotId: string;            x: number; y: number; w: number; h: number }
  | { tag: 'weapon-opt'; slotId: string; weaponId: string; x: number; y: number; w: number; h: number }
  | { tag: 'deploy';                                 x: number; y: number; w: number; h: number }
  | { tag: 'back';                                   x: number; y: number; w: number; h: number }

const CLASS_TABS: { type: PlayerShipType; label: string }[] = [
  { type: 'destroyer',  label: '駆逐艦' },
  { type: 'cruiser',    label: '巡洋艦' },
  { type: 'battleship', label: '戦艦'   },
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
  private slotWeapons = new Map<string, ShopWeapon>()

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
    this.slotWeapons = new Map()
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
        break

      case 'class-tab':
        this.selectedClass = r.shipType
        this.selectedHullIdx = 0
        this.slotWeapons = new Map()
        this.selectedSlotId = null
        break

      case 'hull-card': {
        const hull = getHullsByClass(this.selectedClass)[r.index]
        if (!hull || hull.minStage > this.stage) break
        if (this.selectedHullIdx !== r.index) {
          this.selectedHullIdx = r.index
          this.slotWeapons = new Map()
          this.selectedSlotId = null
        }
        break
      }

      case 'slot-card':
        this.selectedSlotId = this.selectedSlotId === r.slotId ? null : r.slotId
        break

      case 'weapon-opt': {
        const w = WEAPON_SHOP.find(x => x.id === r.weaponId)
        if (w) { this.slotWeapons.set(r.slotId, w); this.selectedSlotId = null }
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

  // ── Private: data helpers ───────────────────────────────────────────────

  private selectedHull(): HullCatalogEntry | null {
    return getHullsByClass(this.selectedClass)[this.selectedHullIdx] ?? null
  }

  private buildResult(): PrepResult | null {
    const hull = this.selectedHull()
    if (!hull) return null
    const loadout: WeaponTemplate[] = []
    for (const slot of hull.slots) {
      const w = this.slotWeapons.get(slot.id) ?? this.defaultWeapon(slot)
      if (w) loadout.push({ id: w.id, name: w.name, type: w.type, ammo: w.ammo })
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

  // ── Background ──────────────────────────────────────────────────────────

  private drawBackground(cw: number, ch: number): void {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, ch)
    g.addColorStop(0, '#0a1510'); g.addColorStop(1, '#060d08')
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch)
    ctx.strokeStyle = 'rgba(38,74,46,0.15)'; ctx.lineWidth = 1
    for (let x = 0; x < cw; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke() }
    for (let y = 0; y < ch; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke() }
  }

  // ── Top tabs ────────────────────────────────────────────────────────────

  private drawTopTabs(cw: number, h: number): void {
    const ctx = this.ctx
    ctx.fillStyle = '#080f08'; ctx.fillRect(0, 0, cw, h)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(cw, h); ctx.stroke()

    ctx.font = '11px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'right'
    ctx.fillText(`Stage ${this.stage}`, cw - 12, h / 2 + 4)

    const tabs: { tab: ScreenTab; label: string }[] = [
      { tab: 'hull',     label: '艦体選択' },
      { tab: 'armament', label: '兵装設定' },
    ]
    const tabW = 114, tabH = h - 10, sx = 8
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i]!; const tx = sx + i * (tabW + 4)
      const active = this.tab === t.tab
      ctx.fillStyle = active ? ACCENT : '#0c1610'; ctx.fillRect(tx, 5, tabW, tabH)
      ctx.strokeStyle = active ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(tx, 5, tabW, tabH)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = active ? '#cce8cc' : DIM; ctx.textAlign = 'center'
      ctx.fillText(t.label, tx + tabW / 2, 5 + tabH / 2 + 5)
      this.addRegion({ tag: 'main-tab', tab: t.tab, x: tx, y: 5, w: tabW, h: tabH })
    }
  }

  // ── Hull tab ────────────────────────────────────────────────────────────

  private renderHullTab(x: number, y: number, cw: number, ch: number): void {
    const ctx = this.ctx
    const classTabW = 88, classTabH = 42
    for (let i = 0; i < CLASS_TABS.length; i++) {
      const tab = CLASS_TABS[i]!
      const ty = y + 20 + i * (classTabH + 8)
      const active = tab.type === this.selectedClass
      ctx.fillStyle = active ? ACCENT : '#0c1610'; ctx.fillRect(x + 8, ty, classTabW, classTabH)
      ctx.strokeStyle = active ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(x + 8, ty, classTabW, classTabH)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = active ? '#cce8cc' : TEXT; ctx.textAlign = 'center'
      ctx.fillText(tab.label, x + 8 + classTabW / 2, ty + classTabH / 2 + 5)
      this.addRegion({ tag: 'class-tab', shipType: tab.type, x: x + 8, y: ty, w: classTabW, h: classTabH })
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

  // ── Armament tab ────────────────────────────────────────────────────────

  private renderArmamentTab(x: number, y: number, cw: number, ch: number): void {
    const hull = this.selectedHull()
    if (!hull) return

    const PANEL_W = Math.floor(cw * 0.35)
    const viewW = cw - PANEL_W
    const profileH = Math.floor(ch * 0.50)
    const topDownH = ch - profileH

    this.drawSideProfile(x, y, viewW, profileH, hull)
    this.drawTopDownDiagram(x, y + profileH, viewW, topDownH, hull)

    // Right panel background + divider
    const ctx = this.ctx
    ctx.fillStyle = '#090f0a'; ctx.fillRect(x + viewW, y, PANEL_W, ch)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x + viewW, y); ctx.lineTo(x + viewW, y + ch); ctx.stroke()

    this.drawSlotPanel(x + viewW, y, PANEL_W, ch, hull)
  }

  // ── Side profile ────────────────────────────────────────────────────────

  private drawSideProfile(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry): void {
    const ctx = this.ctx
    const margin = pw * 0.06
    const shipL = pw - margin * 2
    const bx = px + margin       // bow (left)
    const ex = px + pw - margin  // stern (right)

    const wlY   = py + ph * 0.60  // waterline
    const deckY = py + ph * 0.38  // main deck
    const keelY = py + ph * 0.78  // keel

    // Sky
    const skyG = ctx.createLinearGradient(px, py, px, wlY)
    skyG.addColorStop(0, '#060c08'); skyG.addColorStop(1, '#0a1810')
    ctx.fillStyle = skyG; ctx.fillRect(px, py, pw, wlY - py)

    // Sea
    const seaG = ctx.createLinearGradient(px, wlY, px, py + ph)
    seaG.addColorStop(0, '#06141e'); seaG.addColorStop(1, '#040c16')
    ctx.fillStyle = seaG; ctx.fillRect(px, wlY, pw, py + ph - wlY)

    // Waterline
    ctx.strokeStyle = '#1a3a4a'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(px, wlY); ctx.lineTo(px + pw, wlY); ctx.stroke()

    // Underwater hull
    ctx.beginPath()
    ctx.moveTo(bx + 18, wlY)
    ctx.quadraticCurveTo(bx, wlY, bx + 6, keelY)
    ctx.lineTo(ex - 6, keelY)
    ctx.quadraticCurveTo(ex + 4, keelY, ex - 14, wlY)
    ctx.fillStyle = '#0d1e14'; ctx.fill()
    ctx.strokeStyle = '#1a3020'; ctx.lineWidth = 1; ctx.stroke()

    // Freeboard (hull above waterline)
    ctx.beginPath()
    ctx.moveTo(bx, wlY)
    ctx.bezierCurveTo(bx - 5, deckY + 14, bx + 10, deckY, bx + 24, deckY)
    ctx.lineTo(ex - 10, deckY)
    ctx.bezierCurveTo(ex + 2, deckY, ex + 2, wlY + 6, ex - 12, wlY)
    ctx.closePath()
    ctx.fillStyle = hull.shipType === 'battleship' ? '#1c2e20' : '#162416'
    ctx.fill(); ctx.strokeStyle = '#284830'; ctx.lineWidth = 1.5; ctx.stroke()

    // Deck stripe
    ctx.strokeStyle = '#365840'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(bx + 24, deckY); ctx.lineTo(ex - 10, deckY); ctx.stroke()

    // Superstructure proportions per ship type
    const superHFrac: Record<PlayerShipType, number> = { destroyer: 0.17, cruiser: 0.22, battleship: 0.30 }
    const bridgeXFrac: Record<PlayerShipType, number> = { destroyer: 0.30, cruiser: 0.30, battleship: 0.28 }
    const bridgeWFrac: Record<PlayerShipType, number> = { destroyer: 0.12, cruiser: 0.14, battleship: 0.19 }
    const superH  = ph * superHFrac[hull.shipType]
    const superTopY = deckY - superH
    const bridgeX = bx + shipL * bridgeXFrac[hull.shipType]
    const bridgeW = shipL * bridgeWFrac[hull.shipType]

    // Bridge main body
    ctx.fillStyle = '#182e1e'; ctx.fillRect(bridgeX, superTopY, bridgeW, deckY - superTopY)
    ctx.strokeStyle = '#264a30'; ctx.lineWidth = 1; ctx.strokeRect(bridgeX, superTopY, bridgeW, deckY - superTopY)

    // Bridge windows
    ctx.fillStyle = '#0a2010'
    const winH = 3, winW = (bridgeW - 8) / 3 - 1
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(bridgeX + 4 + i * (winW + 1), superTopY + 5, winW, winH)
    }

    // Pagoda levels for battleship
    if (hull.shipType === 'battleship') {
      for (let lv = 1; lv <= 3; lv++) {
        const lw = bridgeW * (1 - lv * 0.20)
        const lx = bridgeX + (bridgeW - lw) / 2
        const ly = superTopY - lv * (ph * 0.055)
        ctx.fillStyle = `rgba(24,46,30,${0.9 - lv * 0.15})`
        ctx.fillRect(lx, ly, lw, ph * 0.055)
        ctx.strokeStyle = '#264a30'; ctx.lineWidth = 0.5; ctx.strokeRect(lx, ly, lw, ph * 0.055)
      }
    }

    // Funnels
    type FunnelDef = { xFrac: number; wFrac: number; hFrac: number }
    const funnels: Record<PlayerShipType, FunnelDef[]> = {
      destroyer:  [{ xFrac: 0.48, wFrac: 0.040, hFrac: 0.10 }],
      cruiser:    [{ xFrac: 0.48, wFrac: 0.045, hFrac: 0.12 }, { xFrac: 0.58, wFrac: 0.038, hFrac: 0.10 }],
      battleship: [{ xFrac: 0.53, wFrac: 0.055, hFrac: 0.13 }, { xFrac: 0.63, wFrac: 0.048, hFrac: 0.11 }],
    }
    for (const fc of funnels[hull.shipType]) {
      const fx = bx + shipL * fc.xFrac - (shipL * fc.wFrac) / 2
      const fh = ph * fc.hFrac; const fw = shipL * fc.wFrac
      ctx.fillStyle = '#1e2e22'; ctx.fillRect(fx, deckY - fh, fw, fh)
      ctx.strokeStyle = '#2a4030'; ctx.lineWidth = 1; ctx.strokeRect(fx, deckY - fh, fw, fh)
      ctx.fillStyle = '#080e0a'; ctx.fillRect(fx - 1, deckY - fh - 3, fw + 2, 4)
    }

    // Forward mast
    const mastX = bx + shipL * 0.15
    ctx.strokeStyle = '#264830'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(mastX, superTopY - ph * 0.05); ctx.lineTo(mastX, deckY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mastX - 8, superTopY - ph * 0.01); ctx.lineTo(mastX + 8, superTopY - ph * 0.01); ctx.stroke()

    if (hull.shipType !== 'destroyer') {
      const aftX = bx + shipL * 0.72
      ctx.beginPath(); ctx.moveTo(aftX, deckY - ph * 0.08); ctx.lineTo(aftX, deckY); ctx.stroke()
    }

    // Weapon markers
    for (const slot of hull.slots) {
      const slotX = bx + ((slot.y + 1) / 2) * shipL
      const weapon  = this.slotWeapons.get(slot.id)
      const isSel   = slot.id === this.selectedSlotId
      const col     = weapon ? (TYPE_COLOR[weapon.type] ?? DIM)
                    : isSel  ? YELLOW : DIM

      if (slot.compatibleTypes.includes('gun')) {
        // Turret on deck
        const tw = 13, th = 7
        ctx.fillStyle = weapon ? col + '88' : (isSel ? '#3a3a1088' : '#1a2a1888')
        ctx.fillRect(slotX - tw / 2, deckY - th, tw, th)
        ctx.strokeStyle = col; ctx.lineWidth = isSel ? 1.5 : 0.8
        ctx.strokeRect(slotX - tw / 2, deckY - th, tw, th)
        ctx.beginPath(); ctx.moveTo(slotX - 1, deckY - th); ctx.lineTo(slotX - 9, deckY - th - 4)
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke()
      } else if (slot.compatibleTypes.includes('torpedo')) {
        const ty2 = deckY + (wlY - deckY) * 0.45
        ctx.beginPath(); ctx.arc(slotX, ty2, 4, 0, Math.PI * 2)
        ctx.fillStyle = weapon ? col + '88' : (isSel ? '#1a3a4488' : '#0a1e2888')
        ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke()
      } else {
        // AA / missile: small circle on deck
        ctx.beginPath(); ctx.arc(slotX, deckY - 4, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = weapon ? col + '88' : (isSel ? '#2a2a1088' : '#1a2a1888')
        ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke()
      }
    }

    // Labels
    ctx.font = '9px sans-serif'; ctx.fillStyle = DIM
    ctx.textAlign = 'left';  ctx.fillText('艦首 ▶', bx, py + ph - 5)
    ctx.textAlign = 'right'; ctx.fillText('◀ 艦尾', ex, py + ph - 5)
    ctx.textAlign = 'center'; ctx.fillText('─── 側面図 ───', px + pw / 2, py + 12)
  }

  // ── Top-down diagram ─────────────────────────────────────────────────────

  private drawTopDownDiagram(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry): void {
    const ctx = this.ctx
    ctx.fillStyle = '#060e08'; ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.stroke()

    const hw = pw * 0.11
    const hh = ph * 0.38
    const cx2 = px + pw / 2
    const cy2 = py + ph * 0.52

    // Hull shape
    ctx.beginPath(); this.buildHullPath(ctx, cx2, cy2, hw, hh)
    ctx.fillStyle = '#0f1e12'; ctx.fill()
    ctx.strokeStyle = '#284a30'; ctx.lineWidth = 1.5; ctx.stroke()

    // Centerline
    ctx.save(); ctx.setLineDash([5, 4])
    ctx.strokeStyle = 'rgba(70,130,80,0.28)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx2, cy2 - hh); ctx.lineTo(cx2, cy2 + hh); ctx.stroke()
    ctx.setLineDash([]); ctx.restore()

    // Labels
    ctx.font = '9px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'center'
    ctx.fillText('▲ 艦首', cx2, py + 12)
    ctx.fillText('▼ 艦尾', cx2, py + ph - 4)
    ctx.fillText('─── 俯瞰図 ───', px + pw * 0.75, py + 12)

    // Slot markers
    for (const slot of hull.slots) {
      const sx = cx2 + slot.x * hw
      const sy = cy2 + slot.y * hh
      const weapon = this.slotWeapons.get(slot.id)
      const isSel  = slot.id === this.selectedSlotId
      const col    = weapon ? (TYPE_COLOR[weapon.type] ?? DIM)
                   : isSel  ? YELLOW : DIM
      const r = isSel ? 8 : 6

      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = weapon ? col + '44' : (isSel ? '#3a3a1044' : '#1a2a1844')
      ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke()

      if (weapon) {
        ctx.font = '7px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center'
        ctx.fillText(TYPE_JP[weapon.type]!, sx, sy + 3)
      }
    }
  }

  // ── Slot panel (right) ──────────────────────────────────────────────────

  private drawSlotPanel(px: number, py: number, pw: number, ph: number, hull: HullCatalogEntry): void {
    const ctx = this.ctx

    // Header
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = TEXT; ctx.textAlign = 'left'
    ctx.fillText(hull.name, px + 10, py + 20)
    ctx.font = '10px sans-serif'; ctx.fillStyle = DIM
    ctx.fillText(hull.className, px + 10, py + 34)
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(px + 8, py + 40); ctx.lineTo(px + pw - 8, py + 40); ctx.stroke()

    let sy = py + 48
    const slotW = pw - 16

    for (const slot of hull.slots) {
      if (sy + 34 > py + ph - 10) break
      const isSel  = slot.id === this.selectedSlotId
      const weapon = this.slotWeapons.get(slot.id)
      const col    = weapon ? (TYPE_COLOR[weapon.type] ?? DIM) : (isSel ? YELLOW : DIM)

      // Slot header card
      ctx.fillStyle = isSel ? SEL : '#0c1810'; ctx.fillRect(px + 8, sy, slotW, 34)
      ctx.strokeStyle = isSel ? '#3a9a4a' : BORDER; ctx.lineWidth = 1
      ctx.strokeRect(px + 8, sy, slotW, 34)

      // Type indicator dot
      ctx.beginPath(); ctx.arc(px + 18, sy + 17, 5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.fill()

      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = isSel ? '#90d090' : TEXT; ctx.textAlign = 'left'
      ctx.fillText(slot.label, px + 28, sy + 14)

      if (weapon) {
        ctx.font = '9px sans-serif'; ctx.fillStyle = col
        ctx.fillText(weapon.name, px + 28, sy + 27)
      } else {
        ctx.font = '9px sans-serif'; ctx.fillStyle = '#2a4a2a'
        const compat = slot.compatibleTypes.map(t => TYPE_JP[t] ?? t).join('/')
        ctx.fillText(`[${compat}]`, px + 28, sy + 27)
      }

      this.addRegion({ tag: 'slot-card', slotId: slot.id, x: px + 8, y: sy, w: slotW, h: 34 })
      sy += 36

      // Expanded weapon options
      if (isSel) {
        const compatible = this.getCompatible(slot)
        for (const w of compatible) {
          if (sy + 26 > py + ph - 14) break
          const isCur = this.slotWeapons.get(slot.id)?.id === w.id
          const wCol  = TYPE_COLOR[w.type] ?? DIM

          ctx.fillStyle = isCur ? '#0a2a14' : '#080f0a'
          ctx.fillRect(px + 20, sy, slotW - 12, 26)
          ctx.strokeStyle = isCur ? '#3a9a4a' : '#1a3020'; ctx.lineWidth = 1
          ctx.strokeRect(px + 20, sy, slotW - 12, 26)

          ctx.font = '8px sans-serif'; ctx.fillStyle = wCol; ctx.textAlign = 'left'
          ctx.fillText(TYPE_JP[w.type]!, px + 26, sy + 11)
          ctx.font = isCur ? 'bold 10px sans-serif' : '10px sans-serif'
          ctx.fillStyle = isCur ? '#90d090' : TEXT
          ctx.fillText(w.name, px + 26, sy + 22)

          if (isCur) {
            ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#3a9a4a'; ctx.textAlign = 'right'
            ctx.fillText('✓', px + pw - 14, sy + 17); ctx.textAlign = 'left'
          }

          this.addRegion({ tag: 'weapon-opt', slotId: slot.id, weaponId: w.id, x: px + 20, y: sy, w: slotW - 12, h: 26 })
          sy += 28
        }
        sy += 4
      }
    }
  }

  // ── Stats bar ───────────────────────────────────────────────────────────

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
      { label: '耐久力', value: `${hull.hp}`,                barR: hull.hp / 2100,      col: '#22c55e' },
      { label: '速力',   value: `${hull.maxSpeed.toFixed(1)}kt`, barR: hull.maxSpeed / 7.2, col: '#38bdf8' },
      { label: '旋回',   value: `${Math.round(hull.turnRate * 1000) / 10}`,  barR: hull.turnRate / 0.046, col: '#fb923c' },
      { label: '索敵',   value: `${hull.hp > 1000 ? 40 : 50}nm`, barR: 0.65,               col: '#a78bfa' },
    ]

    const colW = (cw * 0.72) / stats.length
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!; const sx = x + colW * i + 14
      ctx.font = '9px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
      ctx.fillText(s.label, sx, y + 14)
      const bw = colW - 20
      ctx.fillStyle = '#0a1810'; ctx.fillRect(sx, y + 18, bw, 6)
      ctx.fillStyle = s.col; ctx.fillRect(sx, y + 18, bw * Math.min(1, s.barR), 6)
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#b0d8b0'
      ctx.fillText(s.value, sx, y + 44)
    }

    // Slot fill summary
    const filled = this.slotWeapons.size
    const total  = hull.slots.length
    ctx.font = '10px sans-serif'; ctx.fillStyle = DIM; ctx.textAlign = 'right'
    ctx.fillText('兵装', cw - 14, y + 14)
    ctx.font = `bold 15px sans-serif`; ctx.fillStyle = filled === total ? GREEN : YELLOW
    ctx.fillText(`${filled} / ${total}`, cw - 14, y + 44)
  }

  // ── Button bar ──────────────────────────────────────────────────────────

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
      this.drawBtn(x + 12, y + 5, 118, ch - 10, '兵装設定 →', ACCENT, '#cceccc', 12)
      this.addRegion({ tag: 'main-tab', tab: 'armament', x: x + 12, y: y + 5, w: 118, h: ch - 10 })
    }

    const hull = this.selectedHull()
    const bw = 176, bx2 = x + cw - bw - 12
    this.drawBtn(bx2, y + 5, bw, ch - 10, '出撃準備完了 →', hull ? GREEN : '#0a1810', hull ? '#fff' : DIM, 13)
    if (hull) this.addRegion({ tag: 'deploy', x: bx2, y: y + 5, w: bw, h: ch - 10 })
  }

  // ── Drawing utilities ────────────────────────────────────────────────────

  private drawShipTopDown(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, hull: HullCatalogEntry, locked: boolean): void {
    ctx.beginPath(); this.buildHullPath(ctx, cx, cy, hw, hh)
    ctx.fillStyle = locked ? '#090f0a' : hull.shipType === 'destroyer' ? '#0d1e12' : hull.shipType === 'cruiser' ? '#112018' : '#162a1c'
    ctx.fill(); ctx.strokeStyle = locked ? '#1a2a1a' : BORDER; ctx.lineWidth = 1; ctx.stroke()
    for (const slot of hull.slots) {
      ctx.beginPath(); ctx.arc(cx + slot.x * hw * 0.8, cy + slot.y * hh * 0.8, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = locked ? DIM : (TYPE_COLOR[slot.compatibleTypes[0]!] ?? '#2a6a3a'); ctx.fill()
    }
  }

  private buildHullPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
    const steps = 40
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
    if (ny < -0.55) return Math.max(0, (ny + 1) / 0.45)
    if (ny > 0.58)  return Math.max(0.4, 1 - (ny - 0.58) / 0.42 * 0.35)
    return 1.0
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
    ctx.strokeStyle = (fg === '#fff' || fg === '#cceccc') ? '#3a9a4a' : BORDER; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h)
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
