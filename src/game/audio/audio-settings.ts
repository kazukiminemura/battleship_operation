interface AudioSettingsCallbacks {
  onMusicVolume: (volume: number) => void
  onEffectsVolume: (volume: number) => void
  onVoiceVolume: (volume: number) => void
}

const STORAGE_KEY = 'battleship.audio-settings.v1'
const DEFAULTS = { music: 0.7, effects: 0.8, voice: 0.9, muted: false }

/** Independent channel levels; mute preserves each slider's previous setting. */
export function createAudioSettings(callbacks: AudioSettingsCallbacks): {
  element: HTMLDetailsElement
  dispose: () => void
} {
  const settings = { ...DEFAULTS }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      for (const key of ['music', 'effects', 'voice'] as const) {
        const value = (saved as Record<string, unknown>)[key]
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) settings[key] = value
      }
      settings.muted = (saved as Record<string, unknown>).muted === true
    }
  } catch { /* Audio controls still work when storage is unavailable. */ }

  const element = document.createElement('details')
  element.dataset.testid = 'audio-settings'
  element.style.cssText = 'position:fixed;top:12px;right:12px;z-index:110;color:#e6eff6;background:#111e2df5;border:1px solid #30485d;border-radius:10px;padding:10px 14px;font:13px "Segoe UI",sans-serif;box-shadow:0 8px 32px #0005;max-width:calc(100vw - 24px);box-sizing:border-box'
  const summary = document.createElement('summary')
  summary.textContent = '音設定'
  summary.style.cssText = 'cursor:pointer;font-weight:600;letter-spacing:.03em'
  element.append(summary)
  const panel = document.createElement('div')
  panel.style.cssText = 'display:grid;gap:12px;margin-top:14px;width:220px;max-width:100%'
  element.append(panel)
  const notify = (): void => {
    callbacks.onMusicVolume(settings.muted ? 0 : settings.music)
    callbacks.onEffectsVolume(settings.muted ? 0 : settings.effects)
    callbacks.onVoiceVolume(settings.muted ? 0 : settings.voice)
  }
  const save = (): void => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* Keep session settings. */ }
    notify()
  }
  for (const [key, title] of [['music', 'BGM'], ['effects', '効果音'], ['voice', '音声']] as const) {
    const label = document.createElement('label')
    const caption = document.createElement('span')
    const input = document.createElement('input')
    input.type = 'range'
    input.min = '0'
    input.max = '100'
    input.step = '1'
    input.value = String(Math.round(settings[key] * 100))
    input.setAttribute('aria-label', `${title}の音量`)
    input.style.cssText = 'display:block;width:100%;margin:6px 0 0;accent-color:#7ec9ff'
    const updateCaption = (): void => { caption.textContent = `${title}　${input.value}%` }
    updateCaption()
    input.addEventListener('input', () => {
      settings[key] = Number(input.value) / 100
      updateCaption()
      save()
    })
    label.append(caption, input)
    panel.append(label)
  }
  const muteLabel = document.createElement('label')
  const mute = document.createElement('input')
  mute.type = 'checkbox'
  mute.checked = settings.muted
  mute.addEventListener('change', () => { settings.muted = mute.checked; save() })
  muteLabel.append(mute, ' すべての音を消す')
  panel.append(muteLabel)
  // Keyboard adjustments must not also steer the ship, fire, or pause combat.
  element.addEventListener('keydown', event => event.stopPropagation())
  notify()
  return { element, dispose: () => element.remove() }
}
