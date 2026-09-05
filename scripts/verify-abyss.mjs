import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const telemetry = () => page.locator('#abyss').evaluate(el => ({ x: +el.dataset.x, y: +el.dataset.y, z: +el.dataset.z, yaw: +el.dataset.yaw, count: +el.dataset.scanned, phase: el.dataset.phase }))
async function holdUntil(key, predicate, argument, timeout = 25000) {
  await page.keyboard.down(key)
  try { await page.waitForFunction(predicate, argument, { timeout, polling: 40 }) }
  finally { await page.keyboard.up(key) }
}
async function travel(target) {
  // Steer from current telemetry, like a player, instead of assuming a fixed
  // heading stays accurate across rendering and input latency.
  const held = new Set()
  async function input(wanted) {
    for (const key of held) if (!wanted.includes(key)) { await page.keyboard.up(key); held.delete(key) }
    for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key) }
  }
  async function navigate(destination, horizontal) {
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      const ship = await telemetry()
      const gap = Math.hypot(destination.x - ship.x, destination.z - ship.z)
      const dy = destination.y - ship.y
      if ((!horizontal || gap < 6) && Math.abs(dy) < 1.5) { await input([]); return }
      const desired = Math.atan2(destination.x - ship.x, -(destination.z - ship.z))
      const delta = Math.atan2(Math.sin(desired - ship.yaw), Math.cos(desired - ship.yaw))
      const wanted = []
      if (Math.abs(dy) > 1) wanted.push(dy > 0 ? 'KeyQ' : 'KeyE')
      if (horizontal && gap >= 6) {
        if (Math.abs(delta) > 0.12) wanted.push(delta > 0 ? 'KeyD' : 'KeyA')
        if (Math.abs(delta) < 0.3) wanted.push('KeyW')
      }
      await input(wanted)
      await page.waitForTimeout(100)
    }
    throw new Error('Navigation timed out')
  }
  try {
    await navigate({ ...target, y: -25 }, true)
    await page.waitForTimeout(1600)
    await navigate(target, false)
  } finally { await input([]) }
  console.log('arrived', await telemetry())
}
try {
  await page.goto('http://127.0.0.1:5173/underwater.html')
  await page.waitForFunction(() => document.querySelector('#abyss').dataset.phase === 'ready')
  await page.screenshot({ path: 'docs/screenshots/abyss-title.png' })
  await page.getByRole('button', { name: '探索をはじめる' }).click()
  await page.waitForFunction(() => document.querySelector('#abyss').dataset.phase === 'diving')
  await page.keyboard.press('Escape')
  const paused = await telemetry()
  await page.waitForTimeout(300)
  assert.equal((await telemetry()).phase, 'paused')
  assert.equal((await telemetry()).z, paused.z)
  await page.getByRole('button', { name: '探索を続ける' }).click()
  const destinations = await page.evaluate(async () => {
    const { SITES, sitePosition, BASE } = await import('/src/underwater/simulation.ts')
    return [...SITES.slice(0, 3).map(sitePosition), BASE]
  })
  for (let i = 0; i < 3; i++) {
    await travel(destinations[i])
    await page.keyboard.press('Space')
    await holdUntil('KeyF', count => +document.querySelector('#abyss').dataset.scanned >= count, i + 1, 15000)
    console.log('surveyed', i + 1)
    await page.screenshot({ path: `docs/screenshots/abyss-site-${i + 1}.png` })
  }
  await page.getByRole('button', { name: /調査記録/ }).click()
  assert.equal(await page.locator('#journal article').count(), 5)
  await page.getByRole('button', { name: '調査記録を閉じる' }).click()
  await travel(destinations[3])
  await holdUntil('KeyF', () => document.querySelector('#abyss').dataset.phase === 'complete', null, 10000)
  await page.screenshot({ path: 'docs/screenshots/abyss-complete.png' })
  assert.equal(await page.locator('#overlay-title').textContent(), 'おかえりなさい、探査員。')
  await page.getByRole('button', { name: '新しい探索をはじめる' }).click()
  await page.waitForFunction(() => document.querySelector('#abyss').dataset.scanned === '0')
  assert.equal((await telemetry()).phase, 'diving')
  assert.deepEqual(errors, [])
  console.log('PASS: start, pause, navigation, three surveys, journal, return, completion, retry; no browser errors')
} catch (error) {
  console.error('state', await telemetry(), errors)
  await page.screenshot({ path: 'docs/screenshots/abyss-verification.png' })
  throw error
} finally { await browser.close() }
