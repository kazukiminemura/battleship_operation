import * as THREE from 'three'
import type { CombatEvent, CombatState, MapObstacle, ShipEntity, Vec3 } from '../simulation/types'
import { WORLD_SIZE } from '../simulation/movement'
import { SHIP_DIMS, SHIP_SHAPES, type ShipShapeClass } from './ship-rendering-data'
import { HULL_CATALOG, type HullCatalogEntry } from '../data/hull-catalog'
import { buildShip, type ShipDesignerPreviewConfig } from './three-ship-designer-renderer'
import type { WeatherMode } from './canvas'

interface ProjectionContext {
  scale: number
}

type WorldToScreen = (wx: number, wy: number) => [number, number]

interface ShipVisual {
  group: THREE.Group
  wake: THREE.Mesh
  weaponMounts: THREE.Group[]
  templateId: string
  scale: number
  team: string
  designKey: string
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
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.9

    // Add lighting for 3D ship rendering
    const ambientLight = new THREE.AmbientLight(0xb8d7f5, 0.30)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xfff0d2, 1.35)
    directionalLight.position.set(200, 300, 400)
    directionalLight.castShadow = false
    this.scene.add(directionalLight)

    const hemisphereLight = new THREE.HemisphereLight(0xa7cff0, 0x102032, 0.52)
    this.scene.add(hemisphereLight)

    const rimLight = new THREE.DirectionalLight(0x6db7ff, 0.55)
    rimLight.position.set(-260, 90, -220)
    this.scene.add(rimLight)

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
      if (!visual || visual.templateId !== ship.templateId || visual.scale !== iso.scale || visual.team !== ship.team || visual.designKey !== shipDesignKey(ship)) {
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
      if (lifetime === undefined || lifetime >= 1) continue
      
      // Apply gravity
      const velIdx = i * 3 + 1
      if (this.splashVelocities[velIdx] !== undefined) {
        this.splashVelocities[velIdx] -= gravity
      }
      
      // Update position
      const posIdx = i * 3
      if (this.splashPositions[posIdx] !== undefined && this.splashVelocities[posIdx] !== undefined) {
        this.splashPositions[posIdx] += this.splashVelocities[posIdx]
      }
      if (this.splashPositions[velIdx] !== undefined && this.splashVelocities[velIdx] !== undefined) {
        this.splashPositions[velIdx] += this.splashVelocities[velIdx]
      }
      
      // Update lifetime
      this.splashLifetimes[i] = (this.splashLifetimes[i] ?? 0) + 0.033
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
    {
      const designerShip = buildShip(combatShipPreviewConfig(ship))
      const designerScale = modelScale / 0.04725
      designerShip.rotation.x = Math.PI / 2
      designerShip.scale.setScalar(designerScale)
      designerShip.position.set(0, 0, 10)
      group.add(designerShip)

      const shadow = new THREE.Mesh(
        ellipseShapeGeometry(l * 0.58, w * 0.72, 36),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.30, depthWrite: false }),
      )
      shadow.position.set(-l * 0.02, 5, -5)
      shadow.scale.y = 0.58
      group.add(shadow)

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

      return { group, wake, weaponMounts: collectWeaponMounts(designerShip), templateId: ship.templateId, scale, team: ship.team, designKey: shipDesignKey(ship) }
    }

    const h = Math.max(4, dim.h * modelScale * 0.55)
    const hullThickness = h * 0.35 // Thickness for extruded hull
    const palette = shipPalette(ship, shape)

    // Create standard materials for 3D rendering
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: palette.hullTop,
      roughness: 0.6,
      metalness: 0.3,
      transparent: true,
      opacity: 0.98,
    })
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: palette.deck,
      roughness: 0.7,
      metalness: 0.2,
      transparent: true,
      opacity: 0.96,
    })
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: palette.side,
      roughness: 0.55,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92,
    })
    const superstructureMaterial = new THREE.MeshStandardMaterial({
      color: palette.superstructure,
      roughness: 0.65,
      metalness: 0.25,
      transparent: true,
      opacity: 0.96,
    })
    const bridgeMaterial = new THREE.MeshStandardMaterial({
      color: palette.bridge,
      roughness: 0.6,
      metalness: 0.25,
      transparent: true,
      opacity: 0.96,
    })
    const turretMaterial = new THREE.MeshStandardMaterial({
      color: palette.turret,
      roughness: 0.5,
      metalness: 0.4,
      transparent: true,
      opacity: 0.98,
    })
    const funnelMaterial = new THREE.MeshStandardMaterial({
      color: palette.funnel,
      roughness: 0.55,
      metalness: 0.35,
      transparent: true,
      opacity: 0.94,
    })
    const barrelMaterial = new THREE.MeshStandardMaterial({
      color: palette.barrel,
      roughness: 0.45,
      metalness: 0.5,
      transparent: true,
      opacity: 0.95,
    })
    const secondaryMaterial = new THREE.MeshStandardMaterial({
      color: palette.secondary,
      roughness: 0.55,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    })
    const mastMaterial = new THREE.MeshStandardMaterial({
      color: palette.barrel,
      roughness: 0.5,
      metalness: 0.4,
      transparent: true,
      opacity: 0.80,
    })
    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: palette.highlight,
      roughness: 0.5,
      metalness: 0.3,
      transparent: true,
      opacity: 0.86,
    })
    const beltMaterial = new THREE.MeshStandardMaterial({
      color: palette.belt,
      roughness: 0.45,
      metalness: 0.45,
      transparent: true,
      opacity: 0.80,
    })

    // Shadow (keep 2D for compatibility)
    const shadow = new THREE.Mesh(
      ellipseShapeGeometry(l * 0.58, w * 0.72, 36),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.30, depthWrite: false }),
    )
    shadow.position.set(-l * 0.02, 5, -5)
    shadow.scale.y = 0.58
    group.add(shadow)

    // === 3D HULL (ExtrudeGeometry with bevel) ===
    const hullShape = createHullShape(shape, l, w)
    const hullExtrudeSettings = {
      depth: hullThickness,
      bevelEnabled: true,
      bevelThickness: Math.max(1, hullThickness * 0.15),
      bevelSize: Math.max(0.8, hullThickness * 0.12),
      bevelSegments: 3,
    }
    const hullGeometry = new THREE.ExtrudeGeometry(hullShape, hullExtrudeSettings)
    // Rotate to lay flat on the deck
    hullGeometry.rotateX(Math.PI / 2)
    const hullMesh = new THREE.Mesh(hullGeometry, hullMaterial)
    hullMesh.position.set(0, -h + hullThickness * 0.3, 5)
    group.add(hullMesh)

    // === 3D DECK ===
    const deckShape = createDeckShape(shape, l * 0.84, w * 0.58)
    const deckExtrudeSettings = {
      depth: hullThickness * 0.4,
      bevelEnabled: true,
      bevelThickness: Math.max(0.5, hullThickness * 0.08),
      bevelSize: Math.max(0.4, hullThickness * 0.06),
      bevelSegments: 2,
    }
    const deckGeometry = new THREE.ExtrudeGeometry(deckShape, deckExtrudeSettings)
    deckGeometry.rotateX(Math.PI / 2)
    const deckMesh = new THREE.Mesh(deckGeometry, deckMaterial)
    deckMesh.position.set(-l * 0.03, -h - 0.2, 9)
    group.add(deckMesh)

    // === BOW DECK (front section) ===
    const bowDeckShape = createDeckShape(shape, l * 0.30, w * 0.38)
    const bowDeckGeometry = new THREE.ExtrudeGeometry(bowDeckShape, deckExtrudeSettings)
    bowDeckGeometry.rotateX(Math.PI / 2)
    const bowDeckMesh = new THREE.Mesh(bowDeckGeometry, hullMaterial)
    bowDeckMesh.position.set(l * 0.28, -h - 0.4, 10)
    group.add(bowDeckMesh)

    // === SIDE/RAIL (3D) ===
    const sideShape = createHullShape(shape, l, w)
    const sideExtrudeSettings = {
      depth: hullThickness * 0.25,
      bevelEnabled: false,
    }
    const sideGeometry = new THREE.ExtrudeGeometry(sideShape, sideExtrudeSettings)
    sideGeometry.rotateX(Math.PI / 2)
    const sideMesh = new THREE.Mesh(sideGeometry, sideMaterial)
    sideMesh.position.set(0, 0, 2)
    sideMesh.scale.set(1.02, 1.04, 1)
    group.add(sideMesh)

    // === ARMOR BELT (3D) ===
    const armorBeltGeometry = new THREE.BoxGeometry(l * 0.86, Math.max(2, w * 0.13), hullThickness * 0.5)
    for (const side of [-1, 1] as const) {
      const armorBeltMesh = new THREE.Mesh(armorBeltGeometry, beltMaterial)
      armorBeltMesh.position.set(-l * 0.04, -h + side * w * 0.46, 8)
      group.add(armorBeltMesh)
    }

    // === DECK PLANKS (3D) ===
    for (let i = 0; i < 4; i++) {
      const x = -l * 0.32 + i * l * 0.17
      const plankGeometry = new THREE.BoxGeometry(l * 0.09, Math.max(1, w * 0.035), 0.3)
      const plankMaterial = new THREE.MeshStandardMaterial({
        color: palette.deckLine,
        roughness: 0.75,
        metalness: 0.15,
        transparent: true,
        opacity: 0.42,
      })
      const plank = new THREE.Mesh(plankGeometry, plankMaterial)
      plank.position.set(x, -h, 13)
      group.add(plank)
    }

    // === SUPERSTRUCTURE (3D Box) ===
    const superstructureGeometry = new THREE.BoxGeometry(
      l * superstructureLength(shape),
      Math.max(4, w * 0.36),
      hullThickness * 0.6,
    )
    const superstructureMesh = new THREE.Mesh(superstructureGeometry, superstructureMaterial)
    superstructureMesh.position.set(-l * 0.06, -h - w * 0.02, 17)
    group.add(superstructureMesh)

    // === BRIDGE (3D Box) ===
    const bridgeGeometry = new THREE.BoxGeometry(l * 0.15, Math.max(4, w * 0.30), hullThickness * 0.5)
    const bridgeMesh = new THREE.Mesh(bridgeGeometry, bridgeMaterial)
    bridgeMesh.position.set(l * 0.03, -h - w * 0.05, 23)
    group.add(bridgeMesh)

    // === BRIDGE TOP (3D) ===
    const bridgeTopGeometry = new THREE.CylinderGeometry(
      Math.max(2.5, w * 0.15),
      Math.max(2.5, w * 0.15),
      hullThickness * 0.25,
      18,
    )
    const bridgeTopMesh = new THREE.Mesh(bridgeTopGeometry, highlightMaterial)
    bridgeTopMesh.position.set(l * 0.04, -h - w * 0.05, 27)
    group.add(bridgeTopMesh)

    // === FUNNELS (3D Cylinder) ===
    for (const stack of funnelLayout(shape, l, w)) {
      const funnelHeight = stack.rY * 2.5
      const funnelGeometry = new THREE.CylinderGeometry(stack.rX * 0.85, stack.rX, funnelHeight, 16)
      const funnelMesh = new THREE.Mesh(funnelGeometry, funnelMaterial)
      funnelMesh.position.set(stack.x, -h + stack.y + funnelHeight / 2, 25)
      group.add(funnelMesh)

      // Funnel cap
      const capGeometry = new THREE.CylinderGeometry(stack.rX * 0.5, stack.rX * 0.6, hullThickness * 0.2, 16)
      const capMesh = new THREE.Mesh(capGeometry, beltMaterial)
      capMesh.position.set(stack.x + stack.rX * 0.10, -h + stack.y + funnelHeight * 0.55, 28)
      group.add(capMesh)
    }

    // === TURRETS (3D Cylinder) ===
    for (const mount of turretLayout(shape, l, w)) {
      const turretHeight = mount.r * 0.7
      const turretGeometry = new THREE.CylinderGeometry(mount.r * 0.9, mount.r, turretHeight, 22)
      const turretMesh = new THREE.Mesh(turretGeometry, turretMaterial)
      turretMesh.position.set(mount.x, -h + mount.y + turretHeight / 2, 30)
      group.add(turretMesh)

      // Turret cap (dome)
      const turretCapGeometry = new THREE.SphereGeometry(mount.r * 0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2)
      const turretCapMesh = new THREE.Mesh(turretCapGeometry, highlightMaterial)
      turretCapMesh.position.set(mount.x + mount.r * 0.05, -h + mount.y + turretHeight, 31)
      turretCapMesh.rotation.x = -Math.PI / 2
      group.add(turretCapMesh)

      // === BARRELS (3D Cylinder) ===
      for (let i = 0; i < mount.barrels; i++) {
        const barrelLength = Math.max(8, mount.r * 3.8)
        const barrelRadius = Math.max(0.6, mount.r * 0.09)
        const barrelGeometry = new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.1, barrelLength, 8)
        const barrelMesh = new THREE.Mesh(barrelGeometry, barrelMaterial)
        // Position barrels pointing forward
        barrelMesh.rotation.z = Math.PI / 2
        barrelMesh.position.set(
          mount.x + mount.r * 1.9 + barrelLength / 2,
          -h + mount.y + (i - (mount.barrels - 1) / 2) * mount.r * 0.30,
          32,
        )
        group.add(barrelMesh)
      }
    }

    // === SECONDARY GUNS (3D) ===
    for (const aa of secondaryLayout(shape, l, w)) {
      const aaHeight = aa.r * 0.6
      const aaGeometry = new THREE.CylinderGeometry(aa.r * 0.8, aa.r, aaHeight, 12)
      const aaMesh = new THREE.Mesh(aaGeometry, secondaryMaterial)
      aaMesh.position.set(aa.x, -h + aa.y + aaHeight / 2, 29)
      group.add(aaMesh)
    }

    // === MASTS (3D Cylinder) ===
    for (const mast of mastLayout(shape, l, w)) {
      const mastHeight = Math.max(8, w * 0.58)
      const mastRadius = Math.max(0.5, w * 0.018)
      const mastGeometry = new THREE.CylinderGeometry(mastRadius, mastRadius, mastHeight, 6)
      const mastMesh = new THREE.Mesh(mastGeometry, mastMaterial)
      mastMesh.position.set(mast.x, -h + mast.y - w * 0.11 + mastHeight / 2, 34)
      mastMesh.rotation.z = mast.tilt
      group.add(mastMesh)
    }

    addFineShipDetails(group, shape, l, w, h, palette)
    addRealisticShipDetails(group, shape, l, w, h, hullThickness, palette)

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

    return { group, wake, weaponMounts: [], templateId: ship.templateId, scale, team: ship.team, designKey: shipDesignKey(ship) }
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
    const screenHeading = -Math.atan2(svy, svx)
    visual.group.rotation.set(-0.50, 0.08, screenHeading)

    const speedF = ship.maxSpeed > 0 ? Math.min(1, Math.abs(ship.speed / ship.maxSpeed)) : 0
    const wakeMat = visual.wake.material as THREE.MeshBasicMaterial
    wakeMat.opacity = speedF * (0.24 + 0.06 * Math.sin(state.tick * 0.16 + ship.id.length))
    visual.wake.scale.set(1 + speedF * 0.16, 0.90 + Math.sin(state.tick * 0.09 + ship.pos.x * 0.01) * 0.06, 1)

    this.updateWeaponTraverse(visual, ship, state)
  }

  private updateWeaponTraverse(visual: ShipVisual, ship: ShipEntity, state: CombatState): void {
    if (visual.weaponMounts.length === 0) return

    for (const mount of visual.weaponMounts) {
      if (!mount.userData['canTraverse']) continue
      const weaponId = String(mount.userData['weaponId'] ?? '')
      const target = weaponAimTarget(ship, weaponId, state)
      const baseRotationY = Number(mount.userData['baseRotationY'] ?? 0)
      const desired = target ? turretYawToWorldTarget(ship, target) : baseRotationY
      const current = mount.rotation.y
      mount.rotation.y = current + angularDelta(current, desired) * 0.16
    }
  }
}

function screenDepth(worldY: number): number {
  return Math.max(-30, Math.min(30, (worldY / WORLD_SIZE) * 60 - 30))
}

function shipDesignKey(ship: ShipEntity): string {
  return JSON.stringify([ship.armorBonus, ship.towerMount, ship.designLayout,
    ship.weapons.map(weapon => [weapon.id, weapon.instanceId, weapon.mount, weapon.mounts, weapon.barrels])])
}

function collectWeaponMounts(root: THREE.Object3D): THREE.Group[] {
  const mounts: THREE.Group[] = []
  root.traverse(child => {
    if (child instanceof THREE.Group && child.userData['weaponId']) mounts.push(child)
  })
  return mounts
}

function weaponAimTarget(ship: ShipEntity, weaponId: string, state: CombatState): Vec3 | null {
  const recent = recentWeaponTarget(ship, weaponId, state)
  if (recent) return recent
  return nearestHostileTarget(ship, state)
}

function recentWeaponTarget(ship: ShipEntity, weaponId: string, state: CombatState): Vec3 | null {
  let best: CombatEvent | null = null
  for (const ev of state.eventLog) {
    if (ev.type !== 'weapon.fired' || ev.sourceId !== ship.id || !ev.targetPosition) continue
    if (weaponId && ev.weaponId !== weaponId) continue
    if (!best || ev.tick > best.tick) best = ev
  }
  return best?.targetPosition ?? null
}

function nearestHostileTarget(ship: ShipEntity, state: CombatState): Vec3 | null {
  let best: { pos: Vec3; d2: number } | null = null
  for (const entity of state.entities.values()) {
    if (entity.kind !== 'ship') continue
    const target = entity as ShipEntity
    if (target.destroyed || target.team === ship.team) continue
    if (ship.team === 'player' && !state.detectedByPlayer.has(target.id)) continue
    const dx = target.pos.x - ship.pos.x
    const dy = target.pos.y - ship.pos.y
    const d2 = dx * dx + dy * dy
    if (!best || d2 < best.d2) best = { pos: target.pos, d2 }
  }
  return best?.pos ?? null
}

function turretYawToWorldTarget(ship: ShipEntity, target: Vec3): number {
  const dx = target.x - ship.pos.x
  const dy = target.y - ship.pos.y
  const forward = dx * Math.cos(ship.angle) + dy * Math.sin(ship.angle)
  const starboard = dx * Math.sin(ship.angle) - dy * Math.cos(ship.angle)
  return Math.atan2(-forward, -starboard)
}

function angularDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

export function combatShipPreviewConfig(ship: ShipEntity): ShipDesignerPreviewConfig {
  const hull = hullEntryForShip(ship)
  return {
    hull,
    armorBonus: ship.armorBonus ?? 0,
    towerMount: ship.towerMount ?? bridgeMountForHull(hull),
    structures: ship.designLayout?.structures,
    weapons: ship.designLayout ? ship.designLayout.weapons.map(weapon => ({ ...weapon, selected: false })) : ship.weapons.flatMap((weapon, index) => weapon.mounts?.length ? weapon.mounts.map(mount => ({
      id: weapon.id,
      instanceId: mount.instanceId,
      name: weapon.name,
      type: weapon.type,
      mount: mount.mount ?? combatVisualMount(ship, weapon, index),
      barrels: mount.barrels ?? weapon.barrels,
      selected: false,
    })) : [{
      id: weapon.id,
      name: weapon.name,
      type: weapon.type,
      mount: combatVisualMount(ship, weapon, index),
      barrels: weapon.barrels,
      selected: false,
    }]),
  }
}

function hullEntryForShip(ship: ShipEntity): HullCatalogEntry {
  const exact = HULL_CATALOG.find(hull => hull.templateId === ship.templateId)
  if (exact) return exact

  const shipType =
    ship.templateId.includes('cruiser') ? 'cruiser' :
      ship.templateId.includes('battleship') || ship.templateId.includes('boss') ? 'battleship' :
        'destroyer'
  const fallback = HULL_CATALOG.find(hull => hull.shipType === shipType)
  if (fallback) return { ...fallback, templateId: ship.templateId, shipType, name: ship.templateId, className: ship.team === 'enemy' ? '敵艦' : fallback.className }

  return {
    templateId: ship.templateId,
    shipType,
    name: ship.templateId,
    className: ship.team === 'enemy' ? '敵艦' : '艦船',
    minStage: 1,
    hp: ship.maxHp,
    armor: ship.armor,
    maxSpeed: ship.maxSpeed,
    turnRate: ship.turnRate,
    slots: [],
  }
}

function bridgeMountForHull(hull: HullCatalogEntry): { x: number; y: number } {
  if (hull.shipType === 'destroyer') return { x: 0, y: -0.12 }
  if (hull.shipType === 'cruiser') return { x: 0, y: -0.04 }
  return { x: 0, y: 0 }
}

function combatVisualMount(ship: ShipEntity, weapon: ShipEntity['weapons'][number], index: number): { x: number; y: number } {
  if (weapon.mount) return weapon.mount
  const dim = SHIP_DIMS[ship.templateId] ?? { l: 100, w: 22, h: 12 }
  const offset = visualWeaponLocalOffset(weapon.id, index, dim)
  return {
    x: -offset.lat / (dim.w * 0.30),
    y: -offset.lon / (dim.l * 0.42),
  }
}

function visualWeaponLocalOffset(weaponId: string, weaponIdx: number, dim: { l: number; w: number }): { lon: number; lat: number } {
  if (weaponId.includes('forward')) return { lon: dim.l * 0.34, lat: 0 }
  if (weaponId.includes('center')) return { lon: dim.l * 0.10, lat: 0 }
  if (weaponId.includes('aft')) return { lon: -dim.l * 0.32, lat: 0 }
  if (weaponId.includes('port')) return { lon: -dim.l * 0.08, lat: dim.w * 0.28 }
  if (weaponId.includes('starboard')) return { lon: -dim.l * 0.08, lat: -dim.w * 0.28 }
  if (weaponId.includes('torpedo')) return { lon: -dim.l * 0.03, lat: weaponIdx % 2 === 0 ? dim.w * 0.36 : -dim.w * 0.36 }
  if (weaponId.includes('aa')) return { lon: -dim.l * 0.02, lat: 0 }
  if (weaponId.includes('missile')) return { lon: -dim.l * 0.18, lat: 0 }
  if (weaponIdx === 0) return { lon: dim.l * 0.26, lat: 0 }
  if (weaponIdx === 1) return { lon: -dim.l * 0.26, lat: 0 }
  const t = Math.max(0, Math.min(1, weaponIdx / 6))
  return {
    lon: THREE.MathUtils.lerp(dim.l * 0.22, -dim.l * 0.28, t),
    lat: 0,
  }
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
  const shapePath = createHullShape(shape, l, w)
  return new THREE.ShapeGeometry(shapePath)
}

// New function: Create hull shape for ExtrudeGeometry
function createHullShape(shape: ShipShapeClass, l: number, w: number): THREE.Shape {
  const halfL = l / 2
  const halfW = w / 2
  const pts = shipHullPoints(shape, halfL, halfW)
  const shapePath = new THREE.Shape()
  shapePath.moveTo(pts[0]![0], pts[0]![1])
  for (const [x, y] of pts.slice(1)) shapePath.lineTo(x, y)
  shapePath.closePath()
  return shapePath
}

function deckShapeGeometry(shape: ShipShapeClass, l: number, w: number): THREE.ShapeGeometry {
  const shapePath = createDeckShape(shape, l, w)
  return new THREE.ShapeGeometry(shapePath)
}

// New function: Create deck shape for ExtrudeGeometry
function createDeckShape(shape: ShipShapeClass, l: number, w: number): THREE.Shape {
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
  return path
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

function addRealisticShipDetails(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  hullThickness: number,
  palette: ShipPalette,
): void {
  const deckY = -h
  const metal = shipPartMaterial(palette.turret, 0.54, 0.42)
  const dark = shipPartMaterial(palette.darkDetail, 0.58, 0.56)
  const light = shipPartMaterial(palette.highlight, 0.48, 0.34)
  const deckLine = shipPartMaterial(palette.deckLine, 0.82, 0.08, 0.70)
  const brass = shipPartMaterial(shape === 'yukimura' ? 0xd6ba77 : 0xc59b54, 0.38, 0.62)
  const glass = new THREE.MeshBasicMaterial({ color: shape === 'yukimura' ? 0xbdeaff : 0x9bd7f7, transparent: true, opacity: 0.58 })
  const rail = shipPartMaterial(palette.rail, 0.48, 0.28, 0.72)

  addDeckScoring(group, shape, l, w, deckY, deckLine)
  addArmorRibs(group, shape, l, w, h, dark)
  addPagodaBridge(group, shape, l, w, h, hullThickness, metal, light, glass)
  addDetailedTurrets(group, shape, l, w, h, metal, dark, light)
  addFunnelCollars(group, shape, l, w, h, dark, light)
  addRealisticMasts(group, shape, l, w, h, dark)
  addDeckFittings(group, shape, l, w, h, dark, light, brass)
  addRealisticRailings(group, shape, l, w, h, rail)
  addLaunchersAndBoatGear(group, shape, l, w, h, dark, light, brass)
  addRangefindersAndSensors(group, shape, l, w, h, dark, light, glass)
  addRigging(group, shape, l, w, h, dark)
  addHullWeathering(group, shape, l, w, h, palette)
}

function shipPartMaterial(color: number, roughness: number, metalness: number, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
  })
}

function addBoxPart(
  group: THREE.Group,
  size: [number, number, number],
  material: THREE.Material,
  position: [number, number, number],
  rotationZ = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.rotation.z = rotationZ
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function addDiskPart(
  group: THREE.Group,
  radiusTop: number,
  radiusBottom: number,
  depth: number,
  material: THREE.Material,
  position: [number, number, number],
  segments = 28,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, depth, segments), material)
  mesh.rotation.x = Math.PI / 2
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function addBarrelPart(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  length: number,
  radius: number,
  direction: 1 | -1,
  material: THREE.Material,
): void {
  const breech = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.20, radius * 1.34, length * 0.34, 14), material)
  breech.rotation.z = Math.PI / 2
  breech.position.set(x + direction * length * 0.18, y, z)
  group.add(breech)

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.70, radius * 1.00, length * 0.72, 16), material)
  barrel.rotation.z = Math.PI / 2
  barrel.position.set(x + direction * length * 0.58, y, z + 0.35)
  group.add(barrel)

  for (const t of [0.08, 0.36, 0.70]) {
    addDiskPart(group, radius * 1.45, radius * 1.45, Math.max(0.55, radius * 0.82), material, [x + direction * length * t, y, z + 0.55], 18)
  }
}

function addDeckScoring(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  deckY: number,
  material: THREE.Material,
): void {
  const length = l * (shape === 'destroyer' ? 0.54 : 0.68)
  const lineCount = shape === 'destroyer' ? 6 : 10
  for (let i = 0; i < lineCount; i++) {
    const y = deckY + ((i + 1) / (lineCount + 1) - 0.5) * w * 0.48
    addBoxPart(group, [length, Math.max(0.28, w * 0.006), 0.42], material, [-l * 0.06, y, 41])
  }
  const crossCount = shape === 'destroyer' ? 5 : 9
  for (let i = 0; i < crossCount; i++) {
    const x = l * 0.30 - i * l * 0.075
    addBoxPart(group, [Math.max(0.28, w * 0.006), w * 0.36, 0.40], material, [x, deckY, 41.2])
  }
}

function addArmorRibs(group: THREE.Group, shape: ShipShapeClass, l: number, w: number, h: number, material: THREE.Material): void {
  const count = shape === 'destroyer' ? 9 : shape === 'cruiser' ? 13 : 18
  for (let i = 0; i < count; i++) {
    const u = i / Math.max(1, count - 1)
    const x = THREE.MathUtils.lerp(l * 0.38, -l * 0.42, u)
    const taper = Math.pow(Math.sin(Math.PI * THREE.MathUtils.clamp(0.18 + u * 0.64, 0, 1)), 0.45)
    const sideY = w * (0.42 + taper * 0.05)
    addBoxPart(group, [Math.max(0.38, w * 0.010), Math.max(1.0, w * 0.09), 1.0], material, [x, -h + sideY, 18])
    addBoxPart(group, [Math.max(0.38, w * 0.010), Math.max(1.0, w * 0.09), 1.0], material, [x, -h - sideY, 18])
  }
}

function addPagodaBridge(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  hullThickness: number,
  metal: THREE.Material,
  light: THREE.Material,
  glass: THREE.Material,
): void {
  const layers: Array<[number, number, number]> = shape === 'destroyer'
    ? [[0.12, 0.25, 0.34], [0.09, 0.19, 0.40]]
    : [[0.18, 0.36, 0.36], [0.145, 0.29, 0.45], [0.115, 0.23, 0.54], [0.090, 0.18, 0.63], [0.066, 0.14, 0.72]]
  const baseX = shape === 'destroyer' ? l * 0.08 : l * 0.04
  const baseY = -h - w * 0.04
  for (const [sx, sy, zMul] of layers) {
    const z = 18 + hullThickness * zMul
    addBoxPart(group, [l * sx, Math.max(2.5, w * sy), Math.max(1.1, hullThickness * 0.08)], metal, [baseX, baseY, z])
    addBoxPart(group, [l * sx * 0.70, Math.max(0.65, w * sy * 0.10), 0.55], glass, [baseX + l * sx * 0.12, baseY - w * sy * 0.40, z + 0.9])
  }
  addDiskPart(group, Math.max(1.8, w * 0.055), Math.max(2.2, w * 0.070), Math.max(1.2, hullThickness * 0.10), light, [baseX, baseY, 18 + hullThickness * 0.86], 24)
}

function addDetailedTurrets(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  metal: THREE.Material,
  dark: THREE.Material,
  light: THREE.Material,
): void {
  for (const mount of turretLayout(shape, l, w)) {
    const direction: 1 | -1 = mount.x < -l * 0.12 ? -1 : 1
    const z = 46
    addDiskPart(group, mount.r * 1.08, mount.r * 1.22, Math.max(1.1, mount.r * 0.30), dark, [mount.x, -h + mount.y, z - 1], 34)
    addBoxPart(group, [mount.r * 2.05, mount.r * 1.50, Math.max(1.3, mount.r * 0.38)], metal, [mount.x + direction * mount.r * 0.16, -h + mount.y, z], 0)
    addBoxPart(group, [mount.r * 1.35, mount.r * 0.22, Math.max(0.65, mount.r * 0.16)], light, [mount.x - direction * mount.r * 0.18, -h + mount.y, z + 1.2])

    const spacing = mount.barrels === 1 ? 0 : mount.r * 0.34
    for (let i = 0; i < mount.barrels; i++) {
      const offset = (i - (mount.barrels - 1) / 2) * spacing
      addBarrelPart(group, mount.x + direction * mount.r * 0.92, -h + mount.y + offset, z + 0.3, mount.r * 3.2, Math.max(0.38, mount.r * 0.090), direction, dark)
    }
  }
}

function addFunnelCollars(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  dark: THREE.Material,
  light: THREE.Material,
): void {
  for (const stack of funnelLayout(shape, l, w)) {
    const y = -h + stack.y
    const z = 45
    addDiskPart(group, stack.rX * 1.08, stack.rX * 1.20, Math.max(2, stack.rY * 0.72), dark, [stack.x, y, z], 28)
    addDiskPart(group, stack.rX * 0.70, stack.rX * 0.88, Math.max(1, stack.rY * 0.35), light, [stack.x + stack.rX * 0.12, y, z + 2.4], 28)
    addBoxPart(group, [stack.rX * 2.0, Math.max(0.45, w * 0.012), 0.7], dark, [stack.x, y, z + 3.2], 0)
  }
}

function addRealisticMasts(group: THREE.Group, shape: ShipShapeClass, l: number, w: number, h: number, material: THREE.Material): void {
  for (const mast of mastLayout(shape, l, w)) {
    const baseY = -h + mast.y
    const height = shape === 'destroyer' ? w * 0.34 : w * 0.46
    addBoxPart(group, [Math.max(0.45, w * 0.014), Math.max(0.45, w * 0.014), height], material, [mast.x, baseY, 50], mast.tilt)
    for (const t of [0.28, 0.52, 0.74]) {
      addBoxPart(group, [w * (0.25 - t * 0.06), Math.max(0.35, w * 0.010), 0.55], material, [mast.x, baseY, 50 + height * (t - 0.38)], 0)
      addBoxPart(group, [Math.max(0.35, w * 0.010), w * (0.20 - t * 0.04), 0.55], material, [mast.x, baseY, 50 + height * (t - 0.38)], 0)
    }
  }
}

function addDeckFittings(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  dark: THREE.Material,
  light: THREE.Material,
  brass: THREE.Material,
): void {
  const deckY = -h
  for (const side of [-1, 1] as const) {
    addDiskPart(group, Math.max(0.8, w * 0.022), Math.max(0.8, w * 0.022), 0.75, dark, [l * 0.43, deckY + side * w * 0.18, 48], 18)
    addBoxPart(group, [l * 0.030, Math.max(0.35, w * 0.010), 0.55], dark, [l * 0.405, deckY + side * w * 0.18, 48.5], side * 0.55)
    addDiskPart(group, Math.max(1.0, w * 0.032), Math.max(0.8, w * 0.026), 0.65, brass, [-l * 0.47, deckY + side * w * 0.20, 34], 18)
  }

  const ventCount = shape === 'destroyer' ? 3 : shape === 'cruiser' ? 5 : 7
  for (let i = 0; i < ventCount; i++) {
    const x = l * 0.24 - i * l * 0.085
    const y = deckY + (i % 2 === 0 ? -1 : 1) * w * 0.22
    addDiskPart(group, Math.max(0.7, w * 0.025), Math.max(0.9, w * 0.032), 1.0, light, [x, y, 44], 14)
  }
}

function addRealisticRailings(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  material: THREE.Material,
): void {
  const deckY = -h
  const postCount = shape === 'destroyer' ? 14 : shape === 'cruiser' ? 18 : 24
  const railZ = 43.5
  const railTopZ = 47
  const x0 = l * 0.40
  const x1 = -l * 0.48
  const railInset = shape === 'destroyer' ? 0.38 : 0.41

  for (const side of [-1, 1] as const) {
    const y = deckY + side * w * railInset
    addLinePart(group, [[x0, y, railTopZ], [x1, y, railTopZ]], material)
    addLinePart(group, [[x0, y, railZ + 1.3], [x1, y, railZ + 1.3]], material)
    for (let i = 0; i < postCount; i++) {
      const t = i / Math.max(1, postCount - 1)
      const x = THREE.MathUtils.lerp(x0, x1, t)
      const taper = Math.sin(Math.PI * t)
      const py = y - side * w * 0.035 * taper
      addBoxPart(group, [Math.max(0.28, w * 0.006), Math.max(0.28, w * 0.006), 3.6], material, [x, py, railZ + 1.8])
    }
  }

  addLinePart(group, [[l * 0.44, deckY - w * 0.22, railTopZ], [l * 0.44, deckY + w * 0.22, railTopZ]], material)
  addLinePart(group, [[-l * 0.53, deckY - w * 0.26, railTopZ], [-l * 0.53, deckY + w * 0.26, railTopZ]], material)
}

function addLaunchersAndBoatGear(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  dark: THREE.Material,
  light: THREE.Material,
  brass: THREE.Material,
): void {
  const deckY = -h
  const launcherCount = shape === 'destroyer' ? 1 : 2
  for (let i = 0; i < launcherCount; i++) {
    const x = -l * (0.02 + i * 0.13)
    const side = i % 2 === 0 ? 1 : -1
    addBoxPart(group, [l * 0.065, w * 0.075, 2.2], dark, [x, deckY + side * w * 0.17, 46], side * 0.18)
    for (let tube = 0; tube < 3; tube++) {
      addBoxPart(
        group,
        [l * 0.052, Math.max(0.45, w * 0.012), Math.max(0.45, w * 0.012)],
        light,
        [x, deckY + side * (w * 0.14 + tube * w * 0.027), 47.3],
        side * 0.18,
      )
    }
  }

  const boatRows = shape === 'destroyer' ? 1 : 2
  for (let i = 0; i < boatRows; i++) {
    const x = -l * (0.16 + i * 0.12)
    for (const side of [-1, 1] as const) {
      addBoxPart(group, [Math.max(0.4, w * 0.010), w * 0.19, 0.65], dark, [x, deckY + side * w * 0.31, 48.2], side * 0.18)
      addLinePart(group, [[x - l * 0.030, deckY + side * w * 0.23, 49], [x, deckY + side * w * 0.33, 53]], dark)
      addLinePart(group, [[x + l * 0.030, deckY + side * w * 0.23, 49], [x, deckY + side * w * 0.33, 53]], dark)
      addDiskPart(group, Math.max(0.9, w * 0.024), Math.max(1.1, w * 0.030), 0.65, brass, [x + l * 0.04, deckY + side * w * 0.30, 48], 16)
    }
  }
}

function addRangefindersAndSensors(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  dark: THREE.Material,
  light: THREE.Material,
  glass: THREE.Material,
): void {
  const deckY = -h
  const bridgeX = shape === 'destroyer' ? l * 0.08 : l * 0.04
  const bridgeY = deckY - w * 0.04
  const towerZ = shape === 'destroyer' ? 52 : 55

  addBoxPart(group, [Math.max(4, w * 0.20), Math.max(1.0, w * 0.030), 1.4], dark, [bridgeX, bridgeY, towerZ], 0)
  addBoxPart(group, [Math.max(1.8, w * 0.060), Math.max(1.5, w * 0.050), 1.1], light, [bridgeX, bridgeY, towerZ + 0.4], 0)
  addBoxPart(group, [Math.max(0.9, w * 0.024), Math.max(0.75, w * 0.020), 0.5], glass, [bridgeX + w * 0.09, bridgeY - w * 0.02, towerZ + 1.2])
  addBoxPart(group, [Math.max(0.9, w * 0.024), Math.max(0.75, w * 0.020), 0.5], glass, [bridgeX - w * 0.09, bridgeY - w * 0.02, towerZ + 1.2])

  const radarX = shape === 'destroyer' ? l * 0.02 : -l * 0.10
  const radarY = deckY + w * 0.02
  addBoxPart(group, [Math.max(0.45, w * 0.012), Math.max(0.45, w * 0.012), w * 0.20], dark, [radarX, radarY, 55])
  addBoxPart(group, [Math.max(6, w * 0.28), Math.max(0.45, w * 0.012), 0.65], light, [radarX, radarY, 55 + w * 0.12], 0.08)
  addBoxPart(group, [Math.max(0.45, w * 0.012), Math.max(4, w * 0.18), 0.65], light, [radarX, radarY, 55 + w * 0.12], -0.08)
}

function addRigging(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  material: THREE.Material,
): void {
  const deckY = -h
  const masts = mastLayout(shape, l, w)
  const mastTopZ = shape === 'destroyer' ? 58 : 62
  const bow: [number, number, number] = [l * 0.42, deckY, 48]
  const stern: [number, number, number] = [-l * 0.50, deckY, 47]

  for (const mast of masts) {
    const top: [number, number, number] = [mast.x, deckY + mast.y, mastTopZ]
    addLinePart(group, [bow, top], material, 0.34)
    addLinePart(group, [stern, top], material, 0.28)
    addLinePart(group, [[mast.x, deckY + mast.y - w * 0.18, mastTopZ - 3], [mast.x, deckY + mast.y + w * 0.18, mastTopZ - 3]], material, 0.36)
  }
  if (masts.length >= 2) {
    addLinePart(
      group,
      [[masts[0]!.x, deckY + masts[0]!.y, mastTopZ], [masts[1]!.x, deckY + masts[1]!.y, mastTopZ - 2]],
      material,
      0.32,
    )
  }
}

function addHullWeathering(
  group: THREE.Group,
  shape: ShipShapeClass,
  l: number,
  w: number,
  h: number,
  palette: ShipPalette,
): void {
  const deckY = -h
  const rust = new THREE.MeshBasicMaterial({ color: 0x8b4a2f, transparent: true, opacity: shape === 'destroyer' ? 0.20 : 0.16, depthWrite: false })
  const shadow = new THREE.MeshBasicMaterial({ color: palette.darkDetail, transparent: true, opacity: 0.24, depthWrite: false })

  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 8; i++) {
      const x = l * (0.32 - i * 0.105)
      const y = deckY + side * w * (0.47 + Math.abs(signedNoise(x, w, i + 4400)) * 0.025)
      const len = l * (0.030 + Math.abs(signedNoise(x, y, i + 4500)) * 0.030)
      const z = 22 + Math.abs(signedNoise(y, x, i + 4600)) * 10
      addBoxPart(group, [len, Math.max(0.28, w * 0.008), 0.45], i % 3 === 0 ? rust : shadow, [x, y, z], side * 0.08)
    }
  }

  addBoxPart(group, [l * 0.10, Math.max(0.8, w * 0.018), 0.55], shadow, [l * 0.42, deckY, 48], 0)
  addBoxPart(group, [l * 0.09, Math.max(0.8, w * 0.018), 0.55], shadow, [-l * 0.50, deckY, 44], 0)
}

function addLinePart(
  group: THREE.Group,
  points: Array<[number, number, number]>,
  material: THREE.Material,
  opacity?: number,
): THREE.Line {
  const lineMaterial = material instanceof THREE.LineBasicMaterial
    ? material
    : new THREE.LineBasicMaterial({
      color: material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial ? material.color : 0xd7dee2,
      transparent: true,
      opacity: opacity ?? (material.transparent ? material.opacity : 0.55),
      depthWrite: false,
    })
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  const line = new THREE.Line(geometry, lineMaterial)
  group.add(line)
  return line
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

export function visualScaleForShip(shape: ShipShapeClass): number {
  if (shape === 'destroyer') return 2.78
  if (shape === 'cruiser') return 2.66
  if (shape === 'boss') return 2.40
  return 2.72
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

function signedNoise(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}
