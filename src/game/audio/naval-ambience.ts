import type { ShipEntity, WeatherCondition } from '../simulation/types'

/** Continuous machinery and bow wash, synthesized locally rather than recorded ship audio. */
export function propulsionMix(ship: ShipEntity, weather: WeatherCondition) {
  const speed = Math.min(1, Math.abs(ship.speed) / Math.max(0.01, ship.maxSpeed))
  const load = Math.min(1, Math.abs(ship.targetSpeed) / Math.max(0.01, ship.maxSpeed))
  const heavy = /battleship|\.bb\.|boss/.test(ship.templateId)
  const cruiser = /cruiser|\.c[al]\./.test(ship.templateId)
  const base = heavy ? 28 : cruiser ? 36 : 46
  return {
    engineHz: base * (1 + speed * 1.25 + load * 0.2),
    engineGain: ship.destroyed ? 0 : 0.025 + speed * 0.042 + load * 0.012,
    propellerHz: 2 + speed * 9,
    washGain: ship.destroyed ? 0 : speed * speed * 0.065,
    seaGain: weather === 'rain' ? 0.045 : 0.018,
    seaCutoff: weather === 'rain' ? 2600 : 900,
  }
}

export class NavalAmbience {
  private readonly master: GainNode
  private readonly engine: OscillatorNode
  private readonly harmonic: OscillatorNode
  private readonly engineGain: GainNode
  private readonly propeller: OscillatorNode
  private readonly propellerDepth: GainNode
  private readonly sea: AudioBufferSourceNode
  private readonly seaFilter: BiquadFilterNode
  private readonly seaGain: GainNode
  private readonly wash: AudioBufferSourceNode
  private readonly washGain: GainNode

  constructor(private readonly ctx: AudioContext, destination: AudioNode) {
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(destination)

    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    this.engineGain.connect(this.master)
    this.engine = ctx.createOscillator()
    this.engine.type = 'sine'
    this.engine.frequency.value = 35
    this.engine.connect(this.engineGain)
    this.harmonic = ctx.createOscillator()
    this.harmonic.type = 'triangle'
    const harmonicGain = ctx.createGain()
    harmonicGain.gain.value = 0.2
    this.harmonic.connect(harmonicGain).connect(this.engineGain)
    // Amplitude modulation gives a rotating propeller beat without allocating per frame.
    this.propeller = ctx.createOscillator()
    this.propellerDepth = ctx.createGain()
    this.propellerDepth.gain.value = 0.006
    this.propeller.connect(this.propellerDepth).connect(this.engineGain.gain)

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // Cosmetic audio randomness never touches simulation RNG streams.
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.sea = ctx.createBufferSource()
    this.sea.buffer = buffer
    this.sea.loop = true
    this.seaFilter = ctx.createBiquadFilter()
    this.seaFilter.type = 'lowpass'
    this.seaGain = ctx.createGain()
    this.seaGain.gain.value = 0
    this.sea.connect(this.seaFilter).connect(this.seaGain).connect(this.master)
    this.wash = ctx.createBufferSource()
    this.wash.buffer = buffer
    this.wash.loop = true
    const washFilter = ctx.createBiquadFilter()
    washFilter.type = 'bandpass'
    washFilter.frequency.value = 750
    washFilter.Q.value = 0.5
    this.washGain = ctx.createGain()
    this.washGain.gain.value = 0
    this.wash.connect(washFilter).connect(this.washGain).connect(this.master)
    this.engine.start()
    this.harmonic.start()
    this.propeller.start()
    this.sea.start()
    this.wash.start(0, 1.37)
  }

  update(ship: ShipEntity | undefined, weather: WeatherCondition, active: boolean): void {
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(active && ship && !ship.destroyed ? 1 : 0, now, 0.15)
    if (!ship || !active) return
    const mix = propulsionMix(ship, weather)
    this.engine.frequency.setTargetAtTime(mix.engineHz, now, 0.3)
    this.harmonic.frequency.setTargetAtTime(mix.engineHz * 2, now, 0.3)
    this.engineGain.gain.setTargetAtTime(mix.engineGain, now, 0.3)
    this.propeller.frequency.setTargetAtTime(mix.propellerHz, now, 0.3)
    this.washGain.gain.setTargetAtTime(mix.washGain, now, 0.3)
    this.seaGain.gain.setTargetAtTime(mix.seaGain, now, 0.5)
    this.seaFilter.frequency.setTargetAtTime(mix.seaCutoff, now, 0.5)
  }

  dispose(): void {
    for (const source of [this.engine, this.harmonic, this.propeller, this.sea, this.wash]) {
      source.stop()
      source.disconnect()
    }
    this.master.disconnect()
  }
}
