import { test, expect } from '@playwright/test'

test('audio settings persist and mute preserves independent channel levels', async ({ page }) => {
  await page.goto('/')
  await page.getByText('音設定', { exact: true }).click()
  const music = page.getByRole('slider', { name: 'BGMの音量' })
  await expect(music).toHaveValue('70')
  await music.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await expect(music).toHaveValue('1')
  await page.getByRole('checkbox', { name: 'すべての音を消す' }).check()
  await page.reload()
  await page.getByText('音設定', { exact: true }).click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(music).toHaveValue('1')
  await expect(page.getByRole('slider', { name: '効果音の音量' })).toHaveValue('80')
  await page.getByRole('checkbox').uncheck()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('battleship.audio-settings.v1')!))
  expect(saved).toEqual({ music: 0.01, effects: 0.8, voice: 0.9, muted: false })
})

test('combat audio follows speed, pauses with music, and stays silent when muted', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const NativeAudio = window.Audio
    const media: HTMLAudioElement[] = []
    ;(window as any).__testMedia = media
    window.Audio = class extends NativeAudio {
      constructor(src?: string) { super(src); media.push(this) }
    }
  })
  await page.goto('/?debug=map')
  await page.evaluate(async () => {
    // Observe existing production methods; no debug API is shipped in the game.
    const ambienceModule = '/src/game/audio/naval-ambience.ts'
    const { NavalAmbience } = await import(/* @vite-ignore */ ambienceModule)
    const update = NavalAmbience.prototype.update
    NavalAmbience.prototype.update = function(ship: any, weather: string, active: boolean) {
      ;(window as any).__testPropulsion = { speed: ship?.speed, active }
      return update.call(this, ship, weather, active)
    }
    const soundModule = '/src/game/audio/sounds.ts'
    const { SoundSystem } = await import(/* @vite-ignore */ soundModule)
    const pause = SoundSystem.prototype.setPaused
    SoundSystem.prototype.setPaused = function(paused: boolean) {
      ;(window as any).__testSound = this
      return pause.call(this, paused)
    }
  })
  await page.locator('canvas#game-canvas').click({ position: { x: 600, y: 350 } })
  await expect.poll(() => page.evaluate(() => (window as any).__testPropulsion?.active)).toBe(true)
  await page.keyboard.press('ArrowUp')
  await expect.poll(() => page.evaluate(() => Math.abs((window as any).__testPropulsion?.speed ?? 0))).toBeGreaterThan(0)
  await page.keyboard.press('KeyP')
  await expect.poll(() => page.evaluate(() => (window as any).__testPropulsion?.active)).toBe(false)
  await expect.poll(() => page.evaluate(() => (window as any).__testMedia.every((audio: HTMLAudioElement) => audio.paused))).toBe(true)
  await page.keyboard.press('KeyP')
  await expect.poll(() => page.evaluate(() => (window as any).__testPropulsion?.active)).toBe(true)
  await page.getByText('音設定', { exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('audio-settings.png') })
  await page.getByRole('checkbox', { name: 'すべての音を消す' }).check()
  await expect.poll(() => page.evaluate(() => Math.max(0, ...(window as any).__testMedia.filter((audio: HTMLAudioElement) => !audio.paused && !audio.ended).map((audio: HTMLAudioElement) => audio.volume)))).toBe(0)
  await expect.poll(() => page.evaluate(() => (window as any).__testSound.getEffectsDestination().gain.value)).toBeLessThan(0.0001)
  // Return to title and ensure engine/wash do not persist through the screen change.
  await page.locator('canvas#game-canvas').click({ position: { x: 700, y: 400 } })
  await page.keyboard.press('KeyR')
  await expect.poll(() => page.evaluate(() => (window as any).__testPropulsion?.active)).toBe(false)
  expect(errors).toEqual([])
})
