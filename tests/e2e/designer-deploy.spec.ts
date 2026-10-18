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
  const deploy = page.getByRole('button', { name: '出撃' })
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
