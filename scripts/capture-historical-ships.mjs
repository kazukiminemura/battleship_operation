import { chromium } from '@playwright/test'

// Render the production model and the actual default designer loadouts, not mock geometry.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  for (const variant of ['designer', 'combat']) for (const type of ['destroyer', 'cruiser', 'battleship']) {
    await page.goto('http://127.0.0.1:5173/')
    const result = await page.evaluate(async ({type, variant}) => {
      const { ThreeShipDesignerRenderer } = await import('/src/game/rendering/three-ship-designer-renderer.ts')
      const { HULL_CATALOG } = await import('/src/game/data/hull-catalog.ts')
      const { defaultHLGDesign, towerMountFromHLG, previewWeaponsFromHLG } = await import('/src/designer/hlg-system.ts')
      const hull = HULL_CATALOG.find(h => h.shipType === type)
      const design = defaultHLGDesign(hull)
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;inset:0'
      document.body.append(host)
      const renderer = new ThreeShipDesignerRenderer()
      renderer.setViewportFromElement(host)
      const weapons = previewWeaponsFromHLG(hull, design)
      let config = { hull, towerMount: towerMountFromHLG(hull, design), armorBonus: 0, weapons }
      if (variant === 'combat') {
        const { createInitialState } = await import('/src/game/data/masterdata.ts')
        const { combatShipPreviewConfig } = await import('/src/game/rendering/three-battlefield-renderer.ts')
        config = combatShipPreviewConfig(createInitialState(type).entities.get('ship.player'))
      }
      renderer.show(config)
      let frames = 0
      return new Promise(resolve => {
        function draw() {
          renderer.update()
          if (++frames < 8) requestAnimationFrame(draw)
          else resolve({ type, variant, weapons: config.weapons.length, tower: config.towerMount })
        }
        draw()
      })
    }, {type, variant})
    await page.screenshot({ path: `docs/screenshots/historical-${type}-${variant}.png` })
    console.log(JSON.stringify(result))
  }
  await page.goto('http://127.0.0.1:5173/?debug=map')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'docs/screenshots/historical-combat.png' })
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  await browser.close()
}
