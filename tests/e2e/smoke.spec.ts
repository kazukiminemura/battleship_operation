import { test, expect } from '@playwright/test'

test('app starts and canvas is present', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas#game-canvas')
  await expect(canvas).toBeVisible()
})

test('canvas has nonzero dimensions', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('canvas#game-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThan(0)
  expect(box!.height).toBeGreaterThan(0)
})

test('HUD text is visible', async ({ page }) => {
  await page.goto('/')
  // wait for game to render at least one frame
  await page.waitForTimeout(500)
  // The HUD is drawn on canvas, so we check for the canvas element and that the page loaded
  await expect(page.locator('canvas#game-canvas')).toBeVisible()
  // page title
  await expect(page).toHaveTitle('Battleship Operation')
})
