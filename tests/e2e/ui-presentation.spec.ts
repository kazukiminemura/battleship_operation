import { test, expect } from '@playwright/test'

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
  test(`UI flow stays readable and usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('#game-canvas')).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: testInfo.outputPath('01-title.png') })
    await page.keyboard.press('Enter')
    await expect(page.locator('.sd-ship-cards')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('02-ship-select.png') })
    await page.locator('.sd-ship-card').first().click()
    const deploy = page.getByRole('button', { name: '出撃', exact: true })
    await expect(deploy).toBeVisible()
    const plan = await page.locator('.sd-plan-viewport').boundingBox()
    const side = await page.locator('.sd-blueprint').boundingBox()
    expect(plan!.height).toBeGreaterThan(120)
    expect(side!.height).toBeGreaterThan(120)
    const fontSize = await page.locator('.sd-hlg-part-name').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(13)
    const collapsedAudio = (await page.getByTestId('audio-settings').boundingBox())!
    const redo = (await page.getByRole('button', { name: /やり直し/ }).boundingBox())!
    expect(redo.x + redo.width).toBeLessThanOrEqual(collapsedAudio.x)
    await page.screenshot({ path: testInfo.outputPath('03-designer.png') })
    await page.getByText('音設定', { exact: true }).click()
    const audio = (await page.getByTestId('audio-settings').boundingBox())!
    const sortie = (await deploy.boundingBox())!
    expect(audio.y).toBeGreaterThanOrEqual(sortie.y + sortie.height)
    await deploy.click()
    await expect(page.locator('.sd-root')).toHaveCount(0)
    await page.getByText('音設定', { exact: true }).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: testInfo.outputPath('04-briefing.png') })
    // Click the briefing's actual sortie control so focus leaves audio settings.
    await page.locator('#game-canvas').click({ position: { x: viewport.width * .5, y: viewport.height * .825 } })
    await expect(page.getByTestId('audio-settings')).toHaveCSS('top', '146px')
    await page.waitForTimeout(500)
    await page.screenshot({ path: testInfo.outputPath('05-combat.png') })
    await page.keyboard.press('KeyP')
    await page.waitForTimeout(100)
    await page.screenshot({ path: testInfo.outputPath('06-pause.png') })
    expect(errors).toEqual([])
  })
}

test('result presentation renders success and failure fixtures without errors', async ({ page }, testInfo) => {
  await page.goto('/')
  for (const result of ['completed', 'failed'] as const) {
    await page.evaluate(async result => {
      const resultsPath = '/src/game/ui/resultsscreen.ts'
      const dataPath = '/src/game/data/masterdata.ts'
      const { ResultsScreen } = await import(/* @vite-ignore */ resultsPath)
      const { createInitialState } = await import(/* @vite-ignore */ dataPath)
      document.getElementById('result-fixture')?.remove()
      const canvas = document.createElement('canvas')
      canvas.id = 'result-fixture'
      canvas.width = innerWidth; canvas.height = innerHeight
      canvas.style.cssText = 'position:fixed;inset:0;z-index:200'
      document.body.append(canvas)
      const state = createInitialState('destroyer')
      state.missionResult = result
      state.metrics.enemiesDestroyed = 3
      new ResultsScreen(canvas).render(state)
    }, result)
    await expect(page.locator('#result-fixture')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`result-${result}-fixture.png`) })
  }
})
