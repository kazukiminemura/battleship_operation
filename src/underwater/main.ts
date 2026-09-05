import './styles.css'
import { DiveWorld } from './world'
import { DiveAudio } from './audio'
import { BASE, SITES, SCAN_RADIUS, closestSite, distance, message, newDive, pulseSonar, sitePosition, stepDive, targetPosition } from './simulation'

const host = document.querySelector<HTMLDivElement>('#abyss')!
host.innerHTML = `
  <div class="vignette" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="underwater.html"><span class="brand-mark">≋</span> ABYSS <small>DEEP SEA EXPLORER</small></a>
    <div class="compass"><span>NW</span><i></i><b id="bearing">000° N</b><i></i><span>NE</span></div>
    <nav><button id="journal-button" title="調査記録を開く">調査記録 <span id="log-count">0</span></button><button id="sound" aria-label="効果音を切り替え" aria-pressed="true">音 ON</button><button id="pause" aria-label="一時停止">Ⅱ</button></nav>
  </header>
  <section class="mission panel">
    <div class="eyebrow"><span class="live-dot"></span> EXPEDITION 001</div>
    <h2>静寂の海へ</h2><p>海底の痕跡を調査し、基地へ帰還する。</p>
    <div class="mission-progress"><strong id="progress">00</strong><span>/ 03 <small>調査完了</small></span><div class="progress-dots"><i></i><i></i><i></i></div></div>
    <div id="site-list" class="site-list">${SITES.map(s => `<button data-target="${s.id}"><span class="site-number">${s.id}</span><span class="site-name">未確認の反応</span><span class="site-check">↗</span></button>`).join('')}</div>
    <button id="home-target" class="home-target" data-target="base">⌂ 基地に進路を設定 <span>↗</span></button>
  </section>
  <div class="reticle" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div id="site-labels" aria-hidden="true">${SITES.map(s => `<span class="world-label" id="label-${s.id}">${s.id} <b>${s.name}</b></span>`).join('')}</div>
  <div class="destination"><span id="target-name">未確認の反応 01</span><b id="target-distance">000 m</b><small id="target-hint">前方</small></div>
  <section class="telemetry panel">
    <div class="eyebrow">NEREID–07 <span class="telemetry-status">● 航行システム正常</span></div>
    <div class="readouts"><div><small>深度</small><strong id="depth">019.0</strong><span>m</span></div><div><small>速度</small><strong id="speed">0.0</strong><span>kn</span></div></div>
    <div class="gauge"><label>O₂ <span>酸素</span></label><meter id="oxygen-meter" min="0" max="100" value="100"></meter><b id="oxygen">100%</b></div>
    <div class="gauge"><label>BAT <span>バッテリー</span></label><meter id="battery-meter" min="0" max="100" value="100"></meter><b id="battery">100%</b></div>
    <div class="gauge"><label>HULL <span>船体</span></label><meter id="hull-meter" min="0" max="100" value="100"></meter><b id="hull">100%</b></div>
  </section>
  <div class="action-area"><div id="notice" role="status"></div><div id="interaction"></div><div class="scan-track"><i id="scan-fill"></i></div><button id="sonar">◎ ソナー送信 <kbd>SPACE</kbd></button></div>
  <section class="radar panel"><div class="eyebrow">SONAR MAP <span>155 m</span></div><canvas id="radar" width="360" height="360" aria-label="自艇を中心とした周辺のソナーマップ"></canvas><div class="radar-legend"><i></i>未調査 <i></i>調査済 <b>⌂</b>基地</div></section>
  <footer class="key-guide"><span><kbd>W</kbd><kbd>S</kbd> 前進 / 後退</span><span><kbd>A</kbd><kbd>D</kbd> 旋回</span><span><kbd>Q</kbd><kbd>E</kbd> 上昇 / 潜航</span><span><kbd>SHIFT</kbd> 加速</span><span><kbd>F</kbd> 調査</span><span><kbd>ESC</kbd> 停止</span></footer>
  <div class="touch-controls" aria-label="タッチ操縦"><button data-hold="KeyA">左旋回</button><button data-hold="KeyW">前進</button><button data-hold="KeyD">右旋回</button><button data-hold="KeyS">後退</button><button data-hold="KeyQ">上昇</button><button data-hold="KeyE">潜航</button><button data-hold="KeyF">調査</button></div>
  <section id="intro" class="intro">
    <div class="intro-content"><div class="eyebrow"><span class="live-dot"></span> OCEAN RESEARCH PROGRAM</div><h1>ABYSS<span>静寂の、その先へ。</span></h1><p class="intro-copy">灯りを頼りに、まだ見ぬ海底へ。<br>小さな潜水艇で、海に眠る物語を集めよう。</p>
    <div class="briefing"><span>YOUR MISSION</span><p>ソナーで発見 → <b>3か所</b>を調査 → 基地へ帰還</p><small>探索時間は約9分。基地に戻れば酸素と船体を回復できます。</small></div>
    <button id="start" class="primary">探索をはじめる <span>→</span></button><div class="intro-keys"><kbd>W A S D</kbd> 航行 <kbd>Q / E</kbd> 深度 <kbd>SPACE</kbd> ソナー</div></div>
    <div class="intro-coordinate">NEREID–07 <span>REMOTE SURVEY SUBMERSIBLE</span><b>海底探査艇 / 1名乗り</b></div>
  </section>
  <section id="overlay" class="overlay" hidden><div class="modal panel"><div class="eyebrow" id="overlay-kicker"></div><h2 id="overlay-title"></h2><p id="overlay-copy"></p><div id="overlay-records"></div><button id="resume" class="primary">探索を続ける →</button><button id="restart" class="secondary">新しい探索をはじめる</button></div></section>
  <section id="journal" class="journal panel" hidden><div class="journal-head"><div><div class="eyebrow">FIELD NOTES</div><h2>深海の調査記録</h2></div><button id="close-journal" aria-label="調査記録を閉じる">×</button></div><div id="journal-content"></div></section>
`
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T
let world: DiveWorld
try { world = new DiveWorld(host) } catch {
  element('start').textContent = '3D表示を利用できません'
  element<HTMLButtonElement>('start').disabled = true
  document.querySelector('.intro-copy')!.textContent = 'ブラウザのハードウェアアクセラレーションを有効にして再読み込みしてください。'
  throw new Error('WebGL renderer unavailable')
}
const audio = new DiveAudio(), keys = new Set<string>()
let state = newDive(), journalWasDiving = false
let discoveredCount = 0
const counters = ['oxygen', 'battery', 'hull'] as const
const radar = element<HTMLCanvasElement>('radar').getContext('2d')!
let best = 0
try { best = Math.max(0, Math.min(5, Number(localStorage.getItem('abyss-best') ?? 0))) || 0 } catch { /* Storage may be disabled. */ }

function start(): void {
  state = newDive(); state.phase = 'diving'; keys.clear(); discoveredCount = 0
  element('intro').hidden = true; element('overlay').hidden = true; element('journal').hidden = true
  audio.unlock(); audio.tone(260, 0.45); pulseSonar(state)
}
function sonar(): void { if (pulseSonar(state)) audio.tone(900, 1.1) }
function pause(): void {
  if (state.phase === 'diving') { state.phase = 'paused'; keys.clear(); showOverlay() }
  else if (state.phase === 'paused' && element('journal').hidden) { state.phase = 'diving'; element('overlay').hidden = true }
}
function showOverlay(): void {
  const paused = state.phase === 'paused', won = state.phase === 'complete'
  element('overlay').hidden = false
  element('overlay-kicker').textContent = paused ? 'DIVE PAUSED' : won ? 'EXPEDITION COMPLETE' : 'RESCUE SIGNAL SENT'
  element('overlay-title').textContent = paused ? 'ひと息、海の中で。' : won ? 'おかえりなさい、探査員。' : '探索を終了しました。'
  element('overlay-copy').textContent = paused ? '時間と酸素の消費を停止しています。' : won ? `${state.scanned.length}か所の記録を持ち帰りました。探索時間 ${Math.floor(state.elapsed / 60)}分${Math.floor(state.elapsed % 60)}秒。` : `${state.oxygen <= 0 ? '酸素がなくなりました。' : '船体が損傷しました。'}次の探索では、早めに基地へ戻って補給しましょう。`
  element('overlay-records').textContent = paused ? '' : `今回の調査 ${state.scanned.length} / 5　 ·　 最高記録 ${Math.max(best, won ? state.scanned.length : 0)} / 5`
  element('resume').hidden = !paused
}
function openJournal(): void {
  journalWasDiving = state.phase === 'diving'
  if (journalWasDiving) { state.phase = 'paused'; keys.clear() }
  element('journal-content').innerHTML = SITES.map(site => `<article><span>${site.id} / ${state.scanned.includes(site.id) ? 'RECORDED' : 'UNEXPLORED'}</span><h3>${state.revealed.includes(site.id) ? site.name : '未確認の反応'}</h3><p>${state.scanned.includes(site.id) ? site.note : '反応の近くで停止し、Fを長押しして調査してください。'}</p></article>`).join('')
  element('journal').hidden = false
}
function closeJournal(): void { element('journal').hidden = true; if (journalWasDiving && state.phase === 'paused') state.phase = 'diving'; journalWasDiving = false }
element('start').onclick = start; element('restart').onclick = start; element('resume').onclick = pause
element('pause').onclick = pause; element('sonar').onclick = sonar
element('sound').onclick = () => { audio.enabled = !audio.enabled; element('sound').textContent = `音 ${audio.enabled ? 'ON' : 'OFF'}`; element('sound').setAttribute('aria-pressed', String(audio.enabled)) }
element('journal-button').onclick = openJournal; element('close-journal').onclick = closeJournal
document.querySelectorAll<HTMLButtonElement>('[data-target]').forEach(button => button.onclick = () => {
  state.target = button.dataset.target!; message(state, state.target === 'base' ? '基地に進路を設定しました。' : '選択した反応に進路を設定しました。')
})
const boundKeys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight', 'Space', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
window.addEventListener('keydown', event => {
  if (!boundKeys.has(event.code) || event.target instanceof HTMLInputElement) return
  event.preventDefault()
  if (event.code === 'Escape' && !event.repeat) { if (!element('journal').hidden) closeJournal(); else pause(); return }
  if (event.code === 'Space' && !event.repeat) { sonar(); return }
  keys.add(event.code)
})
window.addEventListener('keyup', event => keys.delete(event.code))
window.addEventListener('blur', () => { keys.clear(); if (state.phase === 'diving') pause() })
document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'diving') pause() })
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
  button.onpointerdown = event => { event.preventDefault(); keys.add(button.dataset.hold!); button.setPointerCapture(event.pointerId) }
  button.onpointerup = button.onpointercancel = () => keys.delete(button.dataset.hold!)
  button.onlostpointercapture = () => keys.delete(button.dataset.hold!)
}

function drawRadar(): void {
  const ctx = radar, c = 180, scale = 1.03
  ctx.clearRect(0, 0, 360, 360); ctx.save(); ctx.translate(c, c)
  ctx.strokeStyle = '#73d4be25'; ctx.lineWidth = 1
  for (const r of [55, 110, 166]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke() }
  ctx.beginPath(); ctx.moveTo(-166, 0); ctx.lineTo(166, 0); ctx.moveTo(0, -166); ctx.lineTo(0, 166); ctx.stroke()
  if (state.sonarAge < 3.7) { ctx.strokeStyle = '#9cf8d4'; ctx.globalAlpha = 1 - state.sonarAge / 3.7; ctx.beginPath(); ctx.arc(0, 0, state.sonarAge * 45, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 }
  const dot = (x: number, z: number, color: string, selected: boolean, home = false) => {
    const dx = x - state.pos.x, dz = z - state.pos.z
    const rx = (dx * Math.cos(state.yaw) + dz * Math.sin(state.yaw)) * scale
    const ry = (-dx * Math.sin(state.yaw) + dz * Math.cos(state.yaw)) * scale
    if (Math.hypot(rx, ry) > 158) return
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(rx, ry, home ? 5 : 4, 0, Math.PI * 2); ctx.fill()
    if (selected) { ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(rx, ry, 10, 0, Math.PI * 2); ctx.stroke() }
  }
  for (const site of SITES) if (state.revealed.includes(site.id)) dot(site.x, site.z, state.scanned.includes(site.id) ? '#6bf1ba' : '#f3b874', state.target === site.id)
  dot(BASE.x, BASE.z, '#e6f8f2', state.target === 'base', true)
  ctx.fillStyle = '#e9fff5'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-5, 5); ctx.lineTo(0, 2); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill()
  ctx.restore()
}
function updateHud(): void {
  host.dataset.phase = state.phase; host.dataset.x = state.pos.x.toFixed(3); host.dataset.y = state.pos.y.toFixed(3); host.dataset.z = state.pos.z.toFixed(3); host.dataset.yaw = state.yaw.toFixed(5); host.dataset.scanned = String(state.scanned.length)
  element('depth').textContent = (-state.pos.y).toFixed(1).padStart(5, '0')
  element('speed').textContent = (Math.abs(state.speed) * 1.94).toFixed(1)
  element('bearing').textContent = `${String(Math.round((state.yaw * 180 / Math.PI % 360 + 360) % 360)).padStart(3, '0')}°`
  for (const id of counters) {
    element<HTMLMeterElement>(`${id}-meter`).value = state[id]
    element(id).textContent = `${Math.ceil(state[id])}%`
    element(id).classList.toggle('warning', state[id] < 25)
  }
  element('progress').textContent = String(state.scanned.length).padStart(2, '0')
  element('log-count').textContent = String(state.scanned.length)
  document.querySelectorAll('.progress-dots i').forEach((dot, i) => dot.classList.toggle('done', i < state.scanned.length))
  for (const site of SITES) {
    const button = document.querySelector<HTMLButtonElement>(`[data-target="${site.id}"]`)!
    button.classList.toggle('selected', state.target === site.id); button.classList.toggle('surveyed', state.scanned.includes(site.id))
    button.querySelector('.site-name')!.textContent = state.revealed.includes(site.id) ? site.name : '未確認の反応'
    button.querySelector('.site-check')!.textContent = state.scanned.includes(site.id) ? '✓' : '↗'
    const label = element(`label-${site.id}`), screen = world.screenPoint(site)
    label.hidden = !screen.visible || !state.revealed.includes(site.id) || state.scanned.includes(site.id) || state.phase === 'ready'
    label.style.transform = `translate(${screen.x}px,${screen.y}px) translate(-50%,-100%)`
  }
  const target = targetPosition(state), targetSite = SITES.find(s => s.id === state.target)
  element('target-name').textContent = state.target === 'base' ? '帰還基地' : state.revealed.includes(state.target) ? targetSite!.name : `未確認の反応 ${state.target}`
  element('target-distance').textContent = `${Math.round(distance(state.pos, target))} m`
  const heading = Math.atan2(target.x - state.pos.x, -(target.z - state.pos.z))
  const angle = Math.atan2(Math.sin(heading - state.yaw), Math.cos(heading - state.yaw))
  element('target-hint').textContent = `${Math.abs(angle) < 0.2 ? '↑ 前方' : angle > 0 ? '右へ旋回 →' : '← 左へ旋回'}　${target.y < state.pos.y - 5 ? 'Eで潜航' : target.y > state.pos.y + 5 ? 'Qで上昇' : '深度良好'}`
  const near = closestSite(state), atBase = distance(state.pos, BASE) < 11
  const canScan = near && distance(state.pos, sitePosition(near)) < SCAN_RADIUS
  element('interaction').textContent = atBase ? state.scanned.length >= 3 ? 'F で帰還を完了する' : '基地に接続中 · 酸素と船体を回復' : canScan ? '停止して F を長押し · 調査する' : state.scanned.length >= 3 ? '3か所の調査完了 · 基地へ帰還しよう' : '光を頼りに、海底の反応へ'
  element('scan-fill').style.width = `${state.scanProgress * 100}%`
  element('notice').textContent = state.messageTime > 0 ? state.message : state.oxygen < 25 ? '酸素残量が少なくなっています。基地へ帰還してください。' : ''
  element<HTMLButtonElement>('sonar').disabled = state.phase !== 'diving' || state.sonarCooldown > 0
  element('sonar').innerHTML = state.sonarCooldown > 0 ? `◎ ソナー充填中 ${Math.ceil(state.sonarCooldown)}s` : '◎ ソナー送信 <kbd>SPACE</kbd>'
  drawRadar()
}
let last = performance.now(), hudTime = 0
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1); last = now
  const phase = state.phase
  const has = (...codes: string[]) => codes.some(code => keys.has(code)) ? 1 : 0
  stepDive(state, { thrust: has('KeyW', 'ArrowUp') - has('KeyS', 'ArrowDown'), turn: has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft'), vertical: has('KeyQ') - has('KeyE'), boost: !!has('ShiftLeft', 'ShiftRight'), scan: !!has('KeyF') }, dt)
  if (state.scanned.length > discoveredCount) { audio.tone(660, 0.7); discoveredCount = state.scanned.length }
  if (phase === 'diving' && (state.phase === 'complete' || state.phase === 'failed')) {
    if (state.phase === 'complete') { best = Math.max(best, state.scanned.length); try { localStorage.setItem('abyss-best', String(best)) } catch { /* Optional record. */ } }
    keys.clear(); audio.tone(state.phase === 'complete' ? 520 : 160, 0.8); showOverlay()
  }
  world.render(state, dt, now / 1000)
  hudTime += dt
  if (hudTime > 0.08) { updateHud(); hudTime = 0 }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
