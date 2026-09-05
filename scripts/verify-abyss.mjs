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
  let ship = await telemetry()
  if (Math.abs(target.y - ship.y) > 1) await holdUntil(target.y > ship.y ? 'KeyQ' : 'KeyE', ({y}) => Math.abs(+document.querySelector('#abyss').dataset.y - y) < 0.8, target)
  ship = await telemetry()
  const yaw = Math.atan2(target.x - ship.x, -(target.z - ship.z))
  const delta = Math.atan2(Math.sin(yaw - ship.yaw), Math.cos(yaw - ship.yaw))
  if (Math.abs(delta) > 0.06) await holdUntil(delta > 0 ? 'KeyD' : 'KeyA', desired => {
    const actual = +document.querySelector('#abyss').dataset.yaw
    return Math.abs(Math.atan2(Math.sin(desired - actual), Math.cos(desired - actual))) < 0.055
  }, yaw)
  await holdUntil('KeyW', target => {
    const d = document.querySelector('#abyss').dataset
    return Math.hypot(+d.x - target.x, +d.z - target.z) < 8
  }, target)
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
