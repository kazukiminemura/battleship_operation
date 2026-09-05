import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

// Isolated browser storage: exercise the real designer -> briefing -> combat UI path.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto('http://127.0.0.1:5173/')
  const setup = await page.evaluate(async () => {
    const hlg = await import('/src/designer/hlg-system.ts')
    const { HULL_CATALOG } = await import('/src/game/data/hull-catalog.ts')
    const { saveDesign } = await import('/src/designer/data.ts')
    const loadedModule = file => performance.getEntriesByType('resource').map(e => e.name).find(url => new URL(url).pathname.endsWith(`/${file}.ts`)) ?? `/src/game/rendering/${file}.ts`
    const { ThreeShipDesignerRenderer } = await import(loadedModule('three-ship-designer-renderer'))
    const { ThreeBattlefieldRenderer } = await import(loadedModule('three-battlefield-renderer'))
    const hull = HULL_CATALOG.find(h => h.shipType === 'destroyer')
    const design = hlg.defaultHLGDesign(hull)
    const weapon = design.components.find(c => c.category === 'weapon')
    weapon.rotation = 90
    const spec = hlg.hlgGridSpec(hull)
    const part = hlg.HLG_PART_BY_ID[weapon.partId]
    const cell = hlg.findNearestValidCell(hull, design, part, { c: spec.centerC, r: spec.topR + Math.floor(spec.lengthCells * 0.75) })
    if (!cell) throw new Error('No valid position for second turret')
    design.components.push(hlg.makeComponent(part, cell, 180, weapon.weaponSlot))
    const stats = hlg.calculateHLGStats(hull, design)
    if (!stats.canDeploy) throw new Error(JSON.stringify(stats.warnings))
    saveDesign(design)
    const signature = root => {
      const result = []
      root.traverse(p => {
        if (p.userData.designInstanceId) result.push({ id: p.userData.designInstanceId, pos: p.position.toArray(), rot: p.rotation.toArray(), scale: p.scale.toArray(), visible: p.visible })
      })
      return result.sort((a, b) => a.id.localeCompare(b.id))
    }
    const show = ThreeShipDesignerRenderer.prototype.show
    ThreeShipDesignerRenderer.prototype.show = function(config) {
      show.call(this, config)
      window.__designSignature = signature(this.shipRoot)
    }
    const create = ThreeBattlefieldRenderer.prototype.createShipVisual
    ThreeBattlefieldRenderer.prototype.createShipVisual = function(ship, scale) {
      const result = create.call(this, ship, scale)
      if (ship.team === 'player') {
        window.__combatSignature = signature(result.group)
        window.__launchLayout = ship.designLayout
      }
      return result
    }
    return { components: design.components.length, weapons: design.components.filter(c => c.category === 'weapon').length }
  })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /^駆逐艦/ }).first().click()
  await page.getByRole('button', { name: '出撃', exact: true }).waitFor()
  await page.waitForFunction(() => window.__designSignature?.length > 0)
  await page.screenshot({ path: 'docs/screenshots/design-sync-designer.png' })
  await page.getByRole('button', { name: '出撃', exact: true }).click()
  await page.getByRole('button', { name: '出撃', exact: true }).waitFor({ state: 'hidden' })
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__combatSignature?.length > 0)
  const result = await page.evaluate(() => ({ designer: window.__designSignature, combat: window.__combatSignature, layout: window.__launchLayout }))
  assert.deepEqual(result.combat, result.designer)
  assert.equal(result.layout.weapons.length, setup.weapons)
  assert.equal(result.combat.length, setup.components)
  await page.screenshot({ path: 'docs/screenshots/design-sync-combat.png' })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ matchedComponents: result.combat.length, matchedWeapons: setup.weapons, browserErrors: errors.length }))
} catch (error) {
  console.log('browser errors', errors)
  console.log('page state', await page.evaluate(() => ({ signature: window.__designSignature, layout: window.__launchLayout, canvas: [...document.querySelectorAll('canvas')].map(c => ({id:c.id, w:c.width, h:c.height})) })))
  await page.screenshot({ path: 'docs/screenshots/design-sync-check.png' })
  throw error
} finally {
  await browser.close()
}
