import { test, expect, type Page } from '@playwright/test'

/**
 * The floating audio settings panel is fixed to the top-right corner, where the
 * ship designer keeps its header actions. Regression: the panel used to cover
 * 艦種変更 / 出撃 so a mouse user could not sortie from the designer.
 */
async function openDesigner(page: Page): Promise<void> {
  await page.goto('/')
  const canvas = page.locator('canvas#game-canvas')
  await expect(canvas).toBeVisible()
  // The start screen publishes its BATTLE START region on the first rendered frame.
  await page.waitForTimeout(500)
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.67)
  await expect(page.locator('.sd-root')).toBeVisible()
}

test('deploy stays clickable while the audio panel is present', async ({ page }) => {
  await openDesigner(page)
  await page.locator('.sd-ship-card').first().click()
  const deploy = page.getByRole('button', { name: '出撃', exact: true })
  await expect(deploy).toBeVisible()
  // Expanded panel is wider than the collapsed summary; neither may reach the button.
  await page.getByText('音設定', { exact: true }).click()
  await deploy.click()
  await expect(page.locator('.sd-root')).toHaveCount(0)
})

test('title button on the ship select step stays clickable', async ({ page }) => {
  await openDesigner(page)
  await page.getByRole('button', { name: 'タイトルへ' }).click()
  await expect(page.locator('.sd-root')).toHaveCount(0)
})

test('gun height slider updates the side view and supports step buttons and keyboard', async ({ page }) => {
  await openDesigner(page)
  await page.locator('.sd-ship-card').first().click()
  const placement = page.getByRole('slider', { name: '新規砲台高', exact: true })
  await expect(placement).toHaveValue('0')
  await page.getByRole('button', { name: '新規砲台高を上げる', exact: true }).click()
  await expect(placement).toHaveValue('2')
  await placement.focus()
  await placement.press('End')
  await expect(placement).toHaveValue('8')
  await expect(page.getByRole('button', { name: '新規砲台高を上げる', exact: true })).toBeDisabled()

  const gun = page.locator('.sd-blueprint-part').filter({ has: page.locator('path[stroke="#cbd0b9"]') }).first()
  await gun.focus()
  await gun.press('Enter')
  const height = page.getByRole('slider', { name: '選択砲台の高さ', exact: true })
  await height.fill('8')
  await expect(height).toHaveValue('8')
  await expect(gun.locator('text')).toHaveText('+8m')
  await page.getByRole('button', { name: '選択砲台の高さを下げる', exact: true }).click()
  await expect(height).toHaveValue('6')
  await expect(gun.locator('text')).toHaveText('+6m')
  await page.screenshot({ path: 'artifacts/gun-height-control.png' })
})

test('placed turret can be raised by dragging directly, cancelled and undone', async ({ page }) => {
  await openDesigner(page)
  await page.locator('.sd-ship-card').first().click()
  const gun = page.locator('.sd-blueprint-part').filter({ has: page.locator('path[stroke="#cbd0b9"]') }).first()
  const hitbox = gun.locator('.sd-blueprint-hitbox')
  await gun.focus()
  await gun.press('Enter')
  const before = await hitbox.boundingBox()
  const originalX = await hitbox.getAttribute('x')
  const svg = (await page.locator('.sd-blueprint svg').boundingBox())!
  const delta = 30 * Math.min(svg.width / 1000, svg.height / 175)
  const x = before!.x + before!.width / 2, y = before!.y + before!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - delta, { steps: 10 })
  await expect(gun.locator('text')).toHaveText('+6m')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(gun.locator('text')).toHaveCount(0)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - delta, { steps: 10 })
  await expect(gun.locator('text')).toHaveText('+6m')
  await page.mouse.up()
  await expect(page.getByRole('slider', { name: '選択砲台の高さ', exact: true })).toHaveValue('6')
  await expect(hitbox).toHaveAttribute('x', originalX!)
  await page.screenshot({ path: 'artifacts/gun-height-direct-drag.png' })
  await page.getByRole('button', { name: /取り消し/ }).click()
  await expect(gun.locator('text')).toHaveCount(0)
  const after = (await hitbox.boundingBox())!
  expect(after.x).toBeCloseTo(before!.x, 1)
  expect(after.y).toBeCloseTo(before!.y, 1)
})
