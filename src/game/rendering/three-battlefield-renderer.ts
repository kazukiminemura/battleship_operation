import * as THREE from 'three'
import { projectShipWaterline } from './ship-waterline'
import type { CombatEvent, CombatState, ShipEntity } from '../simulation/types'
import { createShipVisual, shipDesignKey, type ShipVisual } from './combat-ship-visual'
import { setShipScreenPose, type WorldToScreen } from './ship-projection'
import { updateWeaponTraverse } from './ship-turret-traverse'
import type { WeatherMode } from './canvas'

interface ProjectionContext {
  scale: number
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
          vec3 clearA = vec3(0.16, 0.31, 0.36);
          vec3 clearB = vec3(0.07, 0.19, 0.25);
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
        visual = createShipVisual(ship, iso.scale)
        this.shipVisuals.set(ship.id, visual)
        this.scene.add(visual.group)
      }
      setShipScreenPose(visual.group, ship, w2s, iso.scale, this.width, this.height)
      updateWeaponTraverse(visual.weaponMounts, ship, state)
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

  shipWaterlinePoint(id: string, longitudinal: number, lateral = 0): [number, number] | undefined {
    const model = this.shipVisuals.get(id)?.model
    return model ? projectShipWaterline(model, this.camera, this.width, this.height, longitudinal, lateral) : undefined
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

}
