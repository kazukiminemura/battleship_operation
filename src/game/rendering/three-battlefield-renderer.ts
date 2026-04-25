import * as THREE from 'three'
import type { CombatEvent, CombatState, MapObstacle, ShipEntity } from '../simulation/types'
import { WORLD_SIZE } from '../simulation/movement'
import { SHIP_DIMS, SHIP_SHAPES, type ShipShapeClass } from './ship-rendering-data'
import type { WeatherMode } from './canvas'

interface ProjectionContext {
  scale: number
}

type WorldToScreen = (wx: number, wy: number) => [number, number]

interface ShipVisual {
  group: THREE.Group
  wake: THREE.Mesh
  templateId: string
  scale: number
  team: string
}

interface ShipPalette {
  hullTop: number
  deck: number
  deckLine: number
  rail: number
  side: number
  belt: number
  superstructure: number
  bridge: number
  highlight: number
  funnel: number
  turret: number
  secondary: number
  lifeboat: number
  darkDetail: number
  barrel: number
}

export class ThreeBattlefieldRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
  private readonly oceanMaterial: THREE.ShaderMaterial
  private readonly ocean: THREE.Mesh
  private readonly shipVisuals = new Map<string, ShipVisual>()
  private readonly splashParticles: THREE.Points
  private readonly splashGeometry: THREE.BufferGeometry
  private readonly splashPositions: Float32Array
  private readonly splashVelocities: Float32Array
  private readonly splashLifetimes: Float32Array
  private readonly splashMaxCount = 2000
  private width = 1
  private height = 1

  constructor(overlayCanvas: HTMLCanvasElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'three-battlefield-canvas'
    this.canvas.setAttribute('aria-hidden', 'true')
    this.canvas.style.position = 'fixed'
    this.canvas.style.inset = '0'
    this.canvas.style.width = '100vw'
    this.canvas.style.height = '100vh'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '0'
    overlayCanvas.style.position = 'fixed'
    overlayCanvas.style.inset = '0'
    overlayCanvas.style.zIndex = '1'
    overlayCanvas.style.background = 'transparent'
    overlayCanvas.parentElement?.insertBefore(this.canvas, overlayCanvas)

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.oceanMaterial = new THREE.ShaderMaterial({
      transparent: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWeather: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCameraPos: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float uTime;
        uniform float uWeather;
        uniform vec2 uResolution;
        uniform vec2 uCameraPos;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        // Gerstner wave function for realistic ocean waves
        vec3 gerstnerWave(vec2 pos, float steepness, float wavelength, vec2 direction, float time) {
          float k = 2.0 * 3.14159 / wavelength;
          float c = sqrt(9.8 / k);
          vec2 d = normalize(direction);
          float f = k * (dot(d, pos) - c * time);
          float a = steepness / k;
          return vec3(
            d.x * (a * cos(f)),
            a * sin(f),
            d.y * (a * cos(f))
          );
        }

        // FBM for more complex wave patterns
        float fbm(vec2 p) {
          float f = 0.0;
          float w = 0.5;
          for (int i = 0; i < 5; i++) {
            f += w * noise(p);
            p *= 2.0;
            w *= 0.5;
          }
          return f;
        }

        void main() {
          vec2 uv = vUv;
          float storm = uWeather;
          
          // Calculate world position for wave displacement
          vec2 worldUV = (uv - 0.5) * 2.0;
          worldUV.x += uCameraPos.x * 0.0001;
          worldUV.y += uCameraPos.y * 0.0001;
          
          // Base ocean colors
          vec3 clearA = vec3(0.09, 0.46, 0.66);
          vec3 clearB = vec3(0.03, 0.26, 0.44);
          vec3 stormA = vec3(0.03, 0.16, 0.25);
          vec3 stormB = vec3(0.01, 0.06, 0.11);
          vec3 base = mix(mix(clearA, clearB, uv.y), mix(stormA, stormB, uv.y), storm);

          // Multiple Gerstner waves for realistic ocean surface
          vec3 wave1 = gerstnerWave(worldUV * 8.0, 0.25, 1.0, vec2(1.0, 0.3), uTime * 0.85);
          vec3 wave2 = gerstnerWave(worldUV * 12.0, 0.15, 0.6, vec2(-0.7, 0.7), uTime * 1.25);
          vec3 wave3 = gerstnerWave(worldUV * 18.0, 0.1, 0.35, vec2(0.3, -1.0), uTime * 1.65);
          vec3 wave4 = gerstnerWave(worldUV * 25.0, 0.08, 0.2, vec2(-0.5, -0.5), uTime * 2.1);
          
          vec3 totalWave = wave1 + wave2 + wave3 + wave4;
          
          // Add noise-based choppy waves
          float chopped = fbm(worldUV * vec2(42.0, 24.0) + vec2(uTime * 0.16, -uTime * 0.11));
          
          // Calculate wave height for shading
          float waveHeight = totalWave.y * 0.5 + (chopped - 0.5) * 0.15;
          
          // Foam on wave crests
          float foamThreshold = 0.7 + storm * 0.1;
          float foam = smoothstep(foamThreshold - 0.15, foamThreshold + 0.05, waveHeight + chopped * 0.3);
          foam *= smoothstep(0.0, 0.3, waveHeight + 0.2);
          
          // Secondary foam from wave peaks
          float crestFoam = max(
            smoothstep(0.982, 0.998, sin(uv.x * 128.0 + uv.y * 57.0 + uTime * 1.8)),
            smoothstep(0.985, 0.999, sin(uv.x * -112.0 + uv.y * 91.0 + uTime * 1.35))
          );
          
          // Combine foam effects
          float totalFoam = max(foam * 0.6, crestFoam * mix(0.045, 0.030, storm));
          totalFoam *= (0.65 + chopped * 0.35);
          
          // Foam colors
          vec3 foamWhite = vec3(0.92, 0.96, 0.98);
          vec3 foamBlue = vec3(0.72, 0.85, 0.92);
          vec3 foamColor = mix(foamBlue, foamWhite, foam);
          
          // Apply wave displacement to color
          vec3 waveColor = base + vec3(waveHeight * 0.15);
          vec3 color = mix(waveColor, foamColor, totalFoam);
          
          // Specular highlights on wave peaks
          float specular = pow(max(0.0, waveHeight + 0.3), 3.0) * 0.4;
          color += vec3(specular) * vec3(1.0, 0.98, 0.95);
          
          // Subsurface scattering effect (light through waves)
          float sss = smoothstep(-0.2, 0.3, waveHeight) * 0.15;
          color += vec3(0.1, 0.3, 0.4) * sss;
          
          // Vignette effect
          float vignette = distance(uv, vec2(0.5, 0.52));
          color *= 1.0 - smoothstep(0.35, 0.78, vignette) * mix(0.22, 0.42, storm);
          
          // Add subtle caustic-like patterns
          float caustic = noise(worldUV * 30.0 + vec2(uTime * 0.3, uTime * 0.2));
          caustic = pow(caustic, 3.0) * 0.08;
          color += vec3(caustic) * vec3(0.6, 0.8, 1.0);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.oceanMaterial)
    this.ocean.position.z = -40
    this.scene.add(this.ocean)
    
    // Initialize splash particle system
    this.splashPositions = new Float32Array(this.splashMaxCount * 3)
    this.splashVelocities = new Float32Array(this.splashMaxCount * 3)
    this.splashLifetimes = new Float32Array(this.splashMaxCount)
    this.splashGeometry = new THREE.BufferGeometry()
    this.splashGeometry.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3))
    
    const splashMaterial = new THREE.PointsMaterial({
      color: 0xaaddff,
      size: 3,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.splashParticles = new THREE.Points(this.splashGeometry, splashMaterial)
    this.splashParticles.position.z = -30
    this.scene.add(this.splashParticles)
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(this.width, this.height, false)
    this.camera.left = -this.width / 2
    this.camera.right = this.width / 2
    this.camera.top = this.height / 2
    this.camera.bottom = -this.height / 2
    this.camera.position.set(0, 0, 500)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
    this.ocean.scale.set(this.width, this.height, 1)
    ;(this.oceanMaterial.uniforms.uResolution!.value as THREE.Vector2).set(this.width, this.height)
  }

  render(
    state: CombatState,
    ships: readonly ShipEntity[],
    weather: WeatherMode,
    iso: ProjectionContext,
    w2s: WorldToScreen,
  ): void {
    this.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight)
    this.oceanMaterial.uniforms.uTime!.value = state.tick / 60
    this.oceanMaterial.uniforms.uWeather!.value = weather === 'storm' ? 1 : 0
    
    // Get camera position from world-to-screen transform context
    // The camera position is stored in the iso object indirectly
    const camX = (w2s(0, 0)[0] - iso.scale * 5000) || 0
    const camY = (w2s(0, 0)[1] - iso.scale * 5000) || 0
    ;(this.oceanMaterial.uniforms.uCameraPos!.value as THREE.Vector2).set(camX, camY)

    const visibleIds = new Set<string>()
    for (const ship of ships) {
      visibleIds.add(ship.id)
      let visual = this.shipVisuals.get(ship.id)
      if (!visual || visual.templateId !== ship.templateId || visual.scale !== iso.scale || visual.team !== ship.team) {
        if (visual) this.scene.remove(visual.group)
        visual = this.createShipVisual(ship, iso.scale)
        this.shipVisuals.set(ship.id, visual)
        this.scene.add(visual.group)
      }
      this.updateShipVisual(visual, ship, state, iso, w2s)
    }

    for (const [id, visual] of this.shipVisuals) {
      if (visibleIds.has(id)) continue
      this.scene.remove(visual.group)
      this.shipVisuals.delete(id)
    }

    // Update splash particles
    this.updateSplashParticles(state.tick, state.eventLog, iso, w2s)

    this.renderer.render(this.scene, this.camera)
  }

  private updateSplashParticles(tick: number, eventLog: readonly CombatEvent[], iso: ProjectionContext, w2s: WorldToScreen): void {
    const gravity = 0.15
    let activeCount = 0
    
    // Process combat events to spawn new splash particles
    for (const ev of eventLog) {
      if (ev.type !== 'weapon.missed' || !ev.position) continue
      
      const age = tick - ev.tick
      if (age < 0 || age > 30) continue
      
      const [sx, sy] = w2s(ev.position.x, ev.position.y)
      const splashCount = Math.floor(8 + Math.random() * 12)
      
      for (let i = 0; i < splashCount && activeCount < this.splashMaxCount; i++) {
        const idx = activeCount
        
        // Random velocity in a cone pattern
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 4
        const upwardBias = 1 + Math.random() * 3
        
        this.splashPositions[idx * 3] = sx
        this.splashPositions[idx * 3 + 1] = sy
        this.splashPositions[idx * 3 + 2] = 0
        
        this.splashVelocities[idx * 3] = Math.cos(angle) * speed
        this.splashVelocities[idx * 3 + 1] = Math.sin(angle) * speed + upwardBias
        this.splashVelocities[idx * 3 + 2] = 0
        
        this.splashLifetimes[idx] = age / 30 // Normalized lifetime
        
        activeCount++
      }
    }
    
    // Update existing particles
    for (let i = 0; i < activeCount; i++) {
      const lifetime = this.splashLifetimes[i]
      if (lifetime >= 1) continue
      
      // Apply gravity
      this.splashVelocities[i * 3 + 1] -= gravity
      
      // Update position
      this.splashPositions[i * 3] += this.splashVelocities[i * 3]
      this.splashPositions[i * 3 + 1] += this.splashVelocities[i * 3 + 1]
      
      // Update lifetime
      this.splashLifetimes[i] += 0.033
    }
    
    // Update geometry
    this.splashGeometry.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3))
    this.splashGeometry.setDrawRange(0, activeCount)
  }

  private createShipVisual(ship: ShipEntity, scale: number): ShipVisual {
    const group = new THREE.Group()
    const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
    const shape = SHIP_SHAPES[ship.templateId] ?? 'destroyer'
    const modelScale = scale * visualScaleForShip(shape)
    const l = dim.l * modelScale
    const w = dim.w * modelScale
    const h = Math.max(4, dim.h * modelScale * 0.55)
    const palette = shipPalette(ship, shape)

    const shadow = new THREE.Mesh(
      ellipseShapeGeometry(l * 0.58, w * 0.72, 36),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.30, depthWrite: false }),
    )
    shadow.position.set(-l * 0.02, 5, -5)
    shadow.scale.y = 0.58
    group.add(shadow)

    const hullTop = new THREE.Mesh(
      hullShapeGeometry(shape, l, w),
      new THREE.MeshBasicMaterial({ color: palette.hullTop, transparent: true, opacity: 0.98 }),
    )
    hullTop.position.set(0, -h, 5)
    group.add(hullTop)

    const deck = new THREE.Mesh(
      deckShapeGeometry(shape, l * 0.84, w * 0.58),
      new THREE.MeshBasicMaterial({ color: palette.deck, transparent: true, opacity: 0.96 }),
    )
    deck.position.set(-l * 0.03, -h - 0.5, 9)
    group.add(deck)

    const bowDeck = new THREE.Mesh(
      deckShapeGeometry(shape, l * 0.30, w * 0.38),
      new THREE.MeshBasicMaterial({ color: palette.hullTop, transparent: true, opacity: 0.98 }),
    )
    bowDeck.position.set(l * 0.28, -h - 0.8, 10)
    group.add(bowDeck)

    const side = new THREE.Mesh(
      hullShapeGeometry(shape, l, w),
      new THREE.MeshBasicMaterial({ color: palette.side, transparent: true, opacity: 0.92 }),
    )
    side.position.set(0, 0, 2)
    side.scale.set(1.02, 1.04, 1)
    group.add(side)

    const armorBelt = new THREE.Mesh(
      new THREE.PlaneGeometry(l * 0.86, Math.max(2, w * 0.13)),
      new THREE.MeshBasicMaterial({ color: palette.belt, transparent: true, opacity: 0.80 }),
    )
    armorBelt.position.set(-l * 0.04, -h + w * 0.14, 8)
    group.add(armorBelt)

    for (let i = 0; i < 4; i++) {
      const x = -l * 0.32 + i * l * 0.17
      const plank = new THREE.Mesh(
        new THREE.PlaneGeometry(l * 0.09, Math.max(1, w * 0.035)),
        new THREE.MeshBasicMaterial({ color: palette.deckLine, transparent: true, opacity: 0.42 }),
      )
      plank.position.set(x, -h, 13)
      group.add(plank)
    }

    const superstructure = new THREE.Mesh(
      roundedBoxGeometry(l * superstructureLength(shape), Math.max(4, w * 0.36), 6),
      new THREE.MeshBasicMaterial({ color: palette.superstructure, transparent: true, opacity: 0.96 }),
    )
    superstructure.position.set(-l * 0.06, -h - w * 0.02, 17)
    group.add(superstructure)

    const bridge = new THREE.Mesh(
      roundedBoxGeometry(l * 0.15, Math.max(4, w * 0.30), 6),
      new THREE.MeshBasicMaterial({ color: palette.bridge, transparent: true, opacity: 0.96 }),
    )
    bridge.position.set(l * 0.03, -h - w * 0.05, 23)
    group.add(bridge)

    const bridgeTop = new THREE.Mesh(
      ellipseShapeGeometry(Math.max(4, l * 0.045), Math.max(2.5, w * 0.15), 18),
      new THREE.MeshBasicMaterial({ color: palette.highlight, transparent: true, opacity: 0.86 }),
    )
    bridgeTop.position.set(l * 0.04, -h - w * 0.05, 27)
    group.add(bridgeTop)

    for (const stack of funnelLayout(shape, l, w)) {
      const funnel = new THREE.Mesh(
        ellipseShapeGeometry(stack.rX, stack.rY, 16),
        new THREE.MeshBasicMaterial({ color: palette.funnel, transparent: true, opacity: 0.94 }),
      )
      funnel.position.set(stack.x, -h + stack.y, 25)
      group.add(funnel)
      const cap = new THREE.Mesh(
        ellipseShapeGeometry(stack.rX * 0.72, stack.rY * 0.60, 16),
        new THREE.MeshBasicMaterial({ color: palette.belt, transparent: true, opacity: 0.88 }),
      )
      cap.position.set(stack.x + stack.rX * 0.10, -h + stack.y, 28)
      group.add(cap)
    }

    for (const mount of turretLayout(shape, l, w)) {
      const turret = new THREE.Mesh(
        ellipseShapeGeometry(mount.r, mount.r * 0.82, 22),
        new THREE.MeshBasicMaterial({ color: palette.turret, transparent: true, opacity: 0.98 }),
      )
      turret.position.set(mount.x, -h + mount.y, 30)
      group.add(turret)

      const turretCap = new THREE.Mesh(
        ellipseShapeGeometry(mount.r * 0.58, mount.r * 0.44, 18),
        new THREE.MeshBasicMaterial({ color: palette.highlight, transparent: true, opacity: 0.75 }),
      )
      turretCap.position.set(mount.x + mount.r * 0.05, -h + mount.y - mount.r * 0.05, 31)
      group.add(turretCap)

      for (let i = 0; i < mount.barrels; i++) {
        const barrel = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.max(8, mount.r * 3.8), Math.max(1.2, mount.r * 0.18)),
          new THREE.MeshBasicMaterial({ color: palette.barrel, transparent: true, opacity: 0.95 }),
        )
        barrel.position.set(mount.x + mount.r * 1.9, -h + mount.y + (i - (mount.barrels - 1) / 2) * mount.r * 0.30, 32)
        group.add(barrel)
      }
    }

    for (const aa of secondaryLayout(shape, l, w)) {
      const mount = new THREE.Mesh(
        ellipseShapeGeometry(aa.r, aa.r * 0.75, 12),
        new THREE.MeshBasicMaterial({ color: palette.secondary, transparent: true, opacity: 0.88 }),
      )
      mount.position.set(aa.x, -h + aa.y, 29)
      group.add(mount)
    }

    for (const mast of mastLayout(shape, l, w)) {
      const pole = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(1, w * 0.035), Math.max(8, w * 0.58)),
        new THREE.MeshBasicMaterial({ color: palette.barrel, transparent: true, opacity: 0.80 }),
      )
      pole.position.set(mast.x, -h + mast.y - w * 0.11, 34)
      pole.rotation.z = mast.tilt
      group.add(pole)
    }

    addFineShipDetails(group, shape, l, w, h, palette)

    const wake = new THREE.Mesh(
      wakeGeometry(Math.max(90, l * 2.6), Math.max(28, w * 2.6)),
      new THREE.MeshBasicMaterial({
        color: 0xe8fbff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    wake.position.set(-l * 0.92, w * 0.12, -2)
    group.add(wake)

    return { group, wake, templateId: ship.templateId, scale, team: ship.team }
  }

  private updateShipVisual(
    visual: ShipVisual,
    ship: ShipEntity,
    state: CombatState,
    iso: ProjectionContext,
    w2s: WorldToScreen,
  ): void {
    const [sx, sy] = w2s(ship.pos.x, ship.pos.y)
    visual.group.position.set(sx - this.width / 2, this.height / 2 - sy, screenDepth(ship.pos.y))

    const cosA = Math.cos(ship.angle)
    const sinA = Math.sin(ship.angle)
    const svx = (cosA - sinA) * iso.scale
    const svy = (cosA + sinA) * iso.scale * 0.5
    visual.group.rotation.z = -Math.atan2(svy, svx)

    const speedF = ship.maxSpeed > 0 ? Math.min(1, Math.abs(ship.speed / ship.maxSpeed)) : 0
    const wakeMat = visual.wake.material as THREE.MeshBasicMaterial
    wakeMat.opacity = speedF * (0.18 + 0.04 * Math.sin(state.tick * 0.16 + ship.id.length))
    visual.wake.scale.y = 0.86 + Math.sin(state.tick * 0.09 + ship.pos.x * 0.01) * 0.05
  }
}

function screenDepth(worldY: number): number {
  return Math.max(-30, Math.min(30, (worldY / WORLD_SIZE) * 60 - 30))
}

function shipPalette(ship: ShipEntity, shape: ShipShapeClass): ShipPalette {
  if (ship.team === 'player') {
    return {
      hullTop: shape === 'yukimura' ? 0xe2eef2 : 0x6f8791,
      deck: shape === 'yukimura' ? 0xf0f7fb : 0x9a7b54,
      deckLine: 0xc7a06c,
      rail: 0xd9e2e5,
      side: shape === 'yukimura' ? 0x9fb0b6 : 0x26353b,
      belt: 0x1b2c33,
      superstructure: shape === 'yukimura' ? 0xf6fbff : 0x8ea3aa,
      bridge: shape === 'yukimura' ? 0xdbeafe : 0xa7b8bd,
      highlight: 0xcbd9dc,
      funnel: 0x49565b,
      turret: shape === 'yukimura' ? 0xcbd5e1 : 0x4b5f66,
      secondary: 0x5e7379,
      lifeboat: 0xd4b779,
      darkDetail: 0x17242b,
      barrel: 0x1e2930,
    }
  }
  if (shape === 'boss') {
    return {
      hullTop: 0x676d76,
      deck: 0x8e714f,
      deckLine: 0xb08a5a,
      rail: 0xbec3c8,
      side: 0x1b1d22,
      belt: 0x0f1116,
      superstructure: 0x8a8581,
      bridge: 0xa29a92,
      highlight: 0xc2c5c7,
      funnel: 0x3e4248,
      turret: 0x545b63,
      secondary: 0x5b6269,
      lifeboat: 0xc8ad77,
      darkDetail: 0x101318,
      barrel: 0x151820,
    }
  }
  return {
    hullTop: shape === 'cruiser' ? 0x777b6c : 0x697464,
    deck: shape === 'cruiser' ? 0x87693f : 0x715437,
    deckLine: 0xa98555,
    rail: 0xbbbca6,
    side: 0x222618,
    belt: 0x12170d,
    superstructure: 0x8a8774,
    bridge: 0xa9a38c,
    highlight: 0xc7c2a9,
    funnel: 0x464a3c,
    turret: 0x62654f,
    secondary: 0x5a6049,
    lifeboat: 0xb99d61,
    darkDetail: 0x171a12,
    barrel: 0x171a12,
  }
}

function hullShapeGeometry(shape: ShipShapeClass, l: number, w: number): THREE.ShapeGeometry {
  const halfL = l / 2
  const halfW = w / 2
  const pts = shipHullPoints(shape, halfL, halfW)
  const shapePath = new THREE.Shape()
  shapePath.moveTo(pts[0]![0], pts[0]![1])
  for (const [x, y] of pts.slice(1)) shapePath.lineTo(x, y)
  shapePath.closePath()
  return new THREE.ShapeGeometry(shapePath)
}

function deckShapeGeometry(shape: ShipShapeClass, l: number, w: number): THREE.ShapeGeometry {
  const halfL = l / 2
  const halfW = w / 2
  const taper = shape === 'destroyer' ? 0.30 : 0.22
  const stern = shape === 'boss' ? 0.72 : 0.58
  const pts: [number, number][] = [
    [halfL, 0],
    [halfL * 0.74, -halfW * taper],
    [halfL * 0.35, -halfW],
    [-halfL * 0.72, -halfW * 0.82],
    [-halfL, -halfW * stern],
    [-halfL, halfW * stern],
    [-halfL * 0.72, halfW * 0.82],
    [halfL * 0.35, halfW],
    [halfL * 0.74, halfW * taper],
  ]
  const path = new THREE.Shape()
  path.moveTo(pts[0]![0], pts[0]![1])
  for (const [x, y] of pts.slice(1)) path.lineTo(x, y)
  path.closePath()
  return new THREE.ShapeGeometry(path)
}

function roundedBoxGeometry(w: number, h: number, segments: number): THREE.ShapeGeometry {
  const r = Math.min(w, h) * 0.18
  const x = -w / 2
  const y = -h / 2
  const path = new THREE.Shape()
  path.moveTo(x + r, y)
  path.lineTo(x + w - r, y)
  path.quadraticCurveTo(x + w, y, x + w, y + r)
  path.lineTo(x + w, y + h - r)
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  path.lineTo(x + r, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - r)
  path.lineTo(x, y + r)
  path.quadraticCurveTo(x, y, x + r, y)
  return new THREE.ShapeGeometry(path, segments)
}

function addFineShipDetails(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  palette: ShipPalette,
): void {
  const deckY = -h
  const railOpacity = shape === 'destroyer' ? 0.42 : 0.55

  addPlane(group, l * 0.80, Math.max(0.8, w * 0.018), palette.rail, railOpacity, -l * 0.04, deckY - w * 0.42, 36)
  addPlane(group, l * 0.80, Math.max(0.8, w * 0.018), palette.rail, railOpacity, -l * 0.04, deckY + w * 0.42, 36)
  addPlane(group, l * 0.54, Math.max(0.7, w * 0.014), palette.darkDetail, 0.42, -l * 0.05, deckY, 37)

  const plankCount = shape === 'destroyer' ? 5 : shape === 'cruiser' ? 7 : 9
  for (let i = 0; i < plankCount; i++) {
    const y = deckY + ((i + 1) / (plankCount + 1) - 0.5) * w * 0.48
    addPlane(group, l * 0.58, Math.max(0.45, w * 0.010), palette.deckLine, 0.24, -l * 0.08, y, 38)
  }

  const ribCount = shape === 'destroyer' ? 4 : shape === 'cruiser' ? 6 : 8
  for (let i = 0; i < ribCount; i++) {
    const x = l * (0.28 - i * 0.095)
    addPlane(group, Math.max(0.5, w * 0.015), w * 0.42, palette.darkDetail, 0.22, x, deckY, 38)
  }

  for (const hatch of hatchLayout(shape, l, w)) {
    addPlane(group, hatch.w, hatch.h, palette.darkDetail, 0.54, hatch.x, deckY + hatch.y, 39, hatch.rot)
    addPlane(group, hatch.w * 0.72, Math.max(0.45, hatch.h * 0.16), palette.highlight, 0.22, hatch.x, deckY + hatch.y - hatch.h * 0.10, 40, hatch.rot)
  }

  for (const boat of lifeboatLayout(shape, l, w)) {
    addEllipse(group, boat.rx, boat.ry, palette.lifeboat, 0.82, boat.x, deckY + boat.y, 42, 16, boat.rot)
    addPlane(group, boat.rx * 1.45, Math.max(0.45, boat.ry * 0.20), palette.darkDetail, 0.34, boat.x, deckY + boat.y, 43, boat.rot)
  }

  for (const anchor of anchorLayout(l, w)) {
    addEllipse(group, Math.max(1.2, w * 0.035), Math.max(0.8, w * 0.025), palette.darkDetail, 0.72, anchor.x, deckY + anchor.y, 44, 10, 0)
    addPlane(group, l * 0.055, Math.max(0.45, w * 0.012), palette.darkDetail, 0.55, anchor.x - l * 0.028, deckY + anchor.y, 44, anchor.y > 0 ? -0.42 : 0.42)
  }

  const portholes = shape === 'destroyer' ? 5 : shape === 'cruiser' ? 7 : 9
  for (let i = 0; i < portholes; i++) {
    const x = l * (0.28 - i * 0.085)
    addEllipse(group, Math.max(0.6, w * 0.018), Math.max(0.35, w * 0.010), palette.highlight, 0.42, x, deckY + w * 0.47, 41, 8)
    addEllipse(group, Math.max(0.6, w * 0.018), Math.max(0.35, w * 0.010), palette.highlight, 0.32, x, deckY - w * 0.47, 41, 8)
  }

  const craneCount = shape === 'destroyer' ? 1 : 2
  for (let i = 0; i < craneCount; i++) {
    const x = -l * (0.08 + i * 0.13)
    const side = i % 2 === 0 ? -1 : 1
    addPlane(group, Math.max(7, l * 0.10), Math.max(0.7, w * 0.018), palette.barrel, 0.62, x, deckY + side * w * 0.20, 46, side * 0.58)
  }

  addBridgeWindows(group, l, w, deckY, palette)
}

function addBridgeWindows(group: THREE.Group, l: number, w: number, deckY: number, palette: ShipPalette): void {
  const count = 5
  for (let i = 0; i < count; i++) {
    addPlane(
      group,
      Math.max(0.8, w * 0.030),
      Math.max(0.45, w * 0.018),
      palette.darkDetail,
      0.56,
      l * 0.03 + (i - 2) * w * 0.055,
      deckY - w * 0.18,
      48,
    )
  }
}

function addPlane(
  group: THREE.Group,
  width: number,
  height: number,
  color: number,
  opacity: number,
  x: number,
  y: number,
  z: number,
  rotation = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  )
  mesh.position.set(x, y, z)
  mesh.rotation.z = rotation
  group.add(mesh)
  return mesh
}

function addEllipse(
  group: THREE.Group,
  rx: number,
  ry: number,
  color: number,
  opacity: number,
  x: number,
  y: number,
  z: number,
  steps = 16,
  rotation = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    ellipseShapeGeometry(rx, ry, steps),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  )
  mesh.position.set(x, y, z)
  mesh.rotation.z = rotation
  group.add(mesh)
  return mesh
}

function hatchLayout(shape: ShipShapeClass, l: number, w: number): Array<{ x: number; y: number; w: number; h: number; rot: number }> {
  const base = [
    { x: l * 0.22, y: 0, w: l * 0.070, h: w * 0.16, rot: 0 },
    { x: l * 0.08, y: w * 0.16, w: l * 0.055, h: w * 0.13, rot: 0.06 },
    { x: -l * 0.20, y: -w * 0.13, w: l * 0.060, h: w * 0.13, rot: -0.04 },
  ]
  if (shape === 'destroyer') return base.slice(0, 2)
  return [
    ...base,
    { x: -l * 0.34, y: w * 0.10, w: l * 0.050, h: w * 0.12, rot: 0.04 },
    { x: l * 0.34, y: -w * 0.10, w: l * 0.045, h: w * 0.11, rot: -0.06 },
  ]
}

function lifeboatLayout(shape: ShipShapeClass, l: number, w: number): Array<{ x: number; y: number; rx: number; ry: number; rot: number }> {
  if (shape === 'destroyer') {
    return [{ x: -l * 0.12, y: w * 0.24, rx: Math.max(2, l * 0.030), ry: Math.max(1, w * 0.055), rot: 0.08 }]
  }
  return [
    { x: -l * 0.04, y: w * 0.27, rx: Math.max(2.5, l * 0.028), ry: Math.max(1.2, w * 0.050), rot: 0.04 },
    { x: -l * 0.04, y: -w * 0.27, rx: Math.max(2.5, l * 0.028), ry: Math.max(1.2, w * 0.050), rot: -0.04 },
    { x: -l * 0.22, y: w * 0.24, rx: Math.max(2.5, l * 0.025), ry: Math.max(1.2, w * 0.046), rot: 0.08 },
    { x: -l * 0.22, y: -w * 0.24, rx: Math.max(2.5, l * 0.025), ry: Math.max(1.2, w * 0.046), rot: -0.08 },
  ]
}

function anchorLayout(l: number, w: number): Array<{ x: number; y: number }> {
  return [
    { x: l * 0.38, y: -w * 0.17 },
    { x: l * 0.38, y: w * 0.17 },
  ]
}

function shipHullPoints(shape: ShipShapeClass, l: number, w: number): [number, number][] {
  if (shape === 'destroyer') {
    return [[l, 0], [l * 0.62, -w * 0.72], [-l * 0.68, -w], [-l, -w * 0.42], [-l, w * 0.42], [-l * 0.68, w], [l * 0.62, w * 0.72]]
  }
  if (shape === 'cruiser') {
    return [[l, 0], [l * 0.78, -w * 0.80], [l * 0.12, -w], [-l * 0.78, -w * 0.88], [-l, -w * 0.55], [-l, w * 0.55], [-l * 0.78, w * 0.88], [l * 0.12, w], [l * 0.78, w * 0.80]]
  }
  if (shape === 'yukimura') {
    return [[l, 0], [l * 0.82, -w * 0.50], [l * 0.35, -w * 0.96], [-l * 0.48, -w * 0.88], [-l, -w * 0.30], [-l, w * 0.30], [-l * 0.48, w * 0.88], [l * 0.35, w * 0.96], [l * 0.82, w * 0.50]]
  }
  const stern = shape === 'boss' ? 0.76 : 0.62
  return [[l, 0], [l * 0.88, -w * 0.62], [l * 0.40, -w], [-l * 0.72, -w], [-l, -w * stern], [-l, w * stern], [-l * 0.72, w], [l * 0.40, w], [l * 0.88, w * 0.62]]
}

function ellipseShapeGeometry(rx: number, ry: number, steps: number): THREE.ShapeGeometry {
  const path = new THREE.Shape()
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
  return new THREE.ShapeGeometry(path)
}

function wakeGeometry(length: number, width: number): THREE.BufferGeometry {
  const vertices = new Float32Array([
    0, 0, 0,
    -length, -width * 0.5, 0,
    -length * 0.88, 0, 0,
    -length, width * 0.5, 0,
  ])
  const uvs = new Float32Array([1, 0.5, 0, 0, 0.1, 0.5, 0, 1])
  const indices = [0, 1, 2, 0, 2, 3]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function superstructureLength(shape: ShipShapeClass): number {
  if (shape === 'destroyer') return 0.18
  if (shape === 'cruiser') return 0.23
  if (shape === 'boss') return 0.34
  return 0.28
}

function visualScaleForShip(shape: ShipShapeClass): number {
  if (shape === 'destroyer') return 2.15
  if (shape === 'cruiser') return 1.95
  if (shape === 'boss') return 1.82
  return 1.88
}

function turretLayout(shape: ShipShapeClass, l: number, w: number): Array<{ x: number; y: number; r: number; barrels: number }> {
  if (shape === 'destroyer') return [{ x: l * 0.18, y: 0, r: Math.max(2.5, w * 0.16), barrels: 1 }]
  if (shape === 'cruiser') {
    return [
      { x: l * 0.23, y: 0, r: Math.max(3, w * 0.13), barrels: 2 },
      { x: -l * 0.25, y: 0, r: Math.max(3, w * 0.13), barrels: 2 },
    ]
  }
  if (shape === 'boss') {
    return [
      { x: l * 0.30, y: 0, r: Math.max(4, w * 0.13), barrels: 3 },
      { x: l * 0.08, y: 0, r: Math.max(4, w * 0.12), barrels: 3 },
      { x: -l * 0.31, y: 0, r: Math.max(4, w * 0.13), barrels: 3 },
      { x: -l * 0.08, y: -w * 0.24, r: Math.max(2.5, w * 0.08), barrels: 2 },
      { x: -l * 0.08, y: w * 0.24, r: Math.max(2.5, w * 0.08), barrels: 2 },
    ]
  }
  return [
    { x: l * 0.30, y: 0, r: Math.max(3.5, w * 0.12), barrels: 2 },
    { x: l * 0.08, y: 0, r: Math.max(3.5, w * 0.11), barrels: 2 },
    { x: -l * 0.28, y: 0, r: Math.max(3.5, w * 0.12), barrels: 2 },
    { x: -l * 0.08, y: -w * 0.24, r: Math.max(2.4, w * 0.075), barrels: 2 },
    { x: -l * 0.08, y: w * 0.24, r: Math.max(2.4, w * 0.075), barrels: 2 },
  ]
}

function funnelLayout(shape: ShipShapeClass, l: number, w: number): Array<{ x: number; y: number; rX: number; rY: number }> {
  if (shape === 'destroyer') return [{ x: -l * 0.05, y: 0, rX: Math.max(2, w * 0.07), rY: Math.max(1.5, w * 0.11) }]
  if (shape === 'cruiser') {
    return [
      { x: -l * 0.03, y: -w * 0.07, rX: Math.max(2.4, w * 0.065), rY: Math.max(1.8, w * 0.10) },
      { x: -l * 0.14, y: w * 0.08, rX: Math.max(2.4, w * 0.065), rY: Math.max(1.8, w * 0.10) },
    ]
  }
  return [
    { x: -l * 0.02, y: -w * 0.08, rX: Math.max(3, w * 0.065), rY: Math.max(2, w * 0.11) },
    { x: -l * 0.15, y: w * 0.08, rX: Math.max(3, w * 0.065), rY: Math.max(2, w * 0.11) },
  ]
}

function secondaryLayout(shape: ShipShapeClass, l: number, w: number): Array<{ x: number; y: number; r: number }> {
  if (shape === 'destroyer') return []
  const count = shape === 'boss' ? 8 : shape === 'cruiser' ? 4 : 6
  const mounts: Array<{ x: number; y: number; r: number }> = []
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const row = Math.floor(i / 2)
    mounts.push({
      x: l * (0.14 - row * 0.10),
      y: side * w * 0.34,
      r: Math.max(1.8, w * 0.045),
    })
  }
  return mounts
}

function mastLayout(shape: ShipShapeClass, l: number, w: number): Array<{ x: number; y: number; tilt: number }> {
  if (shape === 'destroyer') return [{ x: l * 0.08, y: 0, tilt: -0.16 }]
  if (shape === 'cruiser') return [{ x: l * 0.06, y: 0, tilt: -0.12 }, { x: -l * 0.18, y: 0, tilt: 0.10 }]
  return [{ x: l * 0.08, y: 0, tilt: -0.10 }, { x: -l * 0.18, y: 0, tilt: 0.10 }]
}
