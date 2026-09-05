export type Point = { x: number; y: number; z: number }
export type SiteKind = 'wreck' | 'arch' | 'vent' | 'coral' | 'bones'
export interface Site { id: string; name: string; kind: SiteKind; x: number; z: number; note: string; depth: number }
export const SITES: readonly Site[] = [
  { id: '01', name: '眠れる貨物船', kind: 'wreck', x: 30, z: -8, depth: 0, note: '船体に残る積荷の跡。長い年月を経た船は、いま小さな魚たちのすみかになっている。' },
  { id: '02', name: '忘れられた回廊', kind: 'arch', x: -62, z: -57, depth: 0, note: '砂に埋もれた石のアーチ。誰が築いたのだろう。測量データを持ち帰れば、輪郭が見えてくるかもしれない。' },
  { id: '03', name: '海底の煙突', kind: 'vent', x: 73, z: -104, depth: 0, note: '黒い煙のように見えるのは、熱水に含まれる細かな鉱物。太陽の届かない海にも、生命を支えるエネルギーがある。' },
  { id: '04', name: '青い光の庭', kind: 'coral', x: -93, z: -153, depth: 0, note: '青い光を放つ群落を記録した。光のパターンは、ゆるやかな海流に合わせて変化している。' },
  { id: '05', name: '巨人のゆりかご', kind: 'bones', x: 2, z: -193, depth: 0, note: '海底に横たわる大きな骨。ひとつの生命が終わった場所で、別の生態系が育ち始めている。' },
]
export const BASE: Point = { x: 0, y: -19, z: 63 }
export const SCAN_RADIUS = 16
export const OXYGEN_SECONDS = 540
export function seabed(x: number, z: number): number {
  return -44 + Math.sin(x * 0.025) * 4 + Math.cos(z * 0.028) * 3 + Math.sin(x * 0.08 + z * 0.06) * 1.4
}
export function sitePosition(site: Site): Point { return { x: site.x, y: seabed(site.x, site.z) + 6, z: site.z } }
export function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }
export interface Controls { thrust: number; turn: number; vertical: number; boost: boolean; scan: boolean }
export interface DiveState {
  phase: 'ready' | 'diving' | 'paused' | 'complete' | 'failed'
  pos: Point; yaw: number; speed: number; oxygen: number; battery: number; hull: number
  elapsed: number; sonarCooldown: number; sonarAge: number; revealed: string[]; scanned: string[]
  scanning: string | null; scanProgress: number; target: string; message: string; messageTime: number
}
export function newDive(): DiveState {
  return { phase: 'ready', pos: { ...BASE }, yaw: 0, speed: 0, oxygen: 100, battery: 100, hull: 100,
    elapsed: 0, sonarCooldown: 0, sonarAge: 99, revealed: [], scanned: [], scanning: null, scanProgress: 0,
    target: '01', message: 'ソナーを使って、海底の反応を探そう。', messageTime: 8 }
}
export function message(state: DiveState, text: string): void { state.message = text; state.messageTime = 4 }
export function pulseSonar(state: DiveState): boolean {
  if (state.phase !== 'diving' || state.sonarCooldown > 0 || state.battery < 4) return false
  state.battery -= 4; state.sonarCooldown = 5; state.sonarAge = 0
  for (const site of SITES) if (distance(state.pos, sitePosition(site)) < 155 && !state.revealed.includes(site.id)) state.revealed.push(site.id)
  message(state, 'ソナー送信 — 近くの反応をマップに記録しました。')
  return true
}
export function closestSite(state: DiveState): Site | undefined {
  return [...SITES].filter(s => !state.scanned.includes(s.id)).sort((a, b) => distance(state.pos, sitePosition(a)) - distance(state.pos, sitePosition(b)))[0]
}
export function targetPosition(state: DiveState): Point {
  return state.target === 'base' ? BASE : sitePosition(SITES.find(s => s.id === state.target) ?? SITES[0]!)
}
export function stepDive(state: DiveState, input: Controls, dt: number): void {
  if (state.phase !== 'diving') return
  dt = Math.max(0, Math.min(dt, 0.1))
  state.elapsed += dt; state.sonarCooldown = Math.max(0, state.sonarCooldown - dt); state.sonarAge += dt
  state.messageTime = Math.max(0, state.messageTime - dt)
  const boost = input.boost && state.battery > 1 && input.thrust !== 0
  state.yaw += input.turn * dt * 1.05
  const desired = input.thrust * (boost ? 25 : 14)
  state.speed += (desired - state.speed) * (1 - Math.exp(-dt * 2.2))
  state.pos.x += Math.sin(state.yaw) * state.speed * dt
  state.pos.z -= Math.cos(state.yaw) * state.speed * dt
  state.pos.y += input.vertical * dt * 8
  state.battery = Math.max(0, Math.min(100, state.battery + dt * (boost ? -2.3 : 0.65)))
  state.oxygen = Math.max(0, state.oxygen - dt * 100 / OXYGEN_SECONDS * (boost ? 1.35 : 1))
  state.pos.y = Math.min(-4, state.pos.y)
  state.pos.x = Math.max(-230, Math.min(230, state.pos.x))
  state.pos.z = Math.max(-260, Math.min(120, state.pos.z))
  const floor = seabed(state.pos.x, state.pos.z) + 2.2
  if (state.pos.y < floor) {
    state.pos.y = floor
    if (input.vertical < 0) { state.hull = Math.max(0, state.hull - dt * 5); message(state, '海底に接触しています。Qで上昇してください。') }
  }
  const nearby = closestSite(state)
  if (input.scan && nearby && distance(state.pos, sitePosition(nearby)) < SCAN_RADIUS) {
    if (Math.abs(state.speed) > 4) { state.scanProgress = 0; message(state, '調査するには推進を止めてください。') }
    else {
      if (state.scanning !== nearby.id) state.scanProgress = 0
      state.scanning = nearby.id; state.scanProgress += dt / 2.5
      if (state.scanProgress >= 1) {
        state.scanned.push(nearby.id)
        if (!state.revealed.includes(nearby.id)) state.revealed.push(nearby.id)
        state.scanProgress = 0; state.scanning = null
        message(state, `${nearby.name}を記録しました。${state.scanned.length >= 3 ? '基地へ帰還できます。' : '次の反応を探しましょう。'}`)
        state.target = state.scanned.length >= 3 ? 'base' : closestSite(state)?.id ?? 'base'
      }
    }
  } else { state.scanProgress = 0; state.scanning = null }
  if (distance(state.pos, BASE) < 11) {
    state.oxygen = Math.min(100, state.oxygen + dt * 10)
    state.hull = Math.min(100, state.hull + dt * 6)
    if (input.scan && state.scanned.length >= 3) { state.phase = 'complete'; state.speed = 0 }
  }
  if (state.oxygen <= 0 || state.hull <= 0) { state.phase = 'failed'; state.speed = 0 }
}
