import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { HullCatalogEntry } from '../data/hull-catalog'
import type { WeaponType } from '../simulation/types'
import { SHIP_DIMS, SHIP_SHAPES, scaledShipDims, type ShipShapeClass } from './ship-rendering-data'

export interface ShipDesignerPreviewWeapon {
  id: string
  name: string
  type: WeaponType
  mount: { x: number; y: number }
  barrels?: number
  selected: boolean
}

export interface ShipDesignerPreviewConfig {
  hull: HullCatalogEntry
  weapons: ShipDesignerPreviewWeapon[]
  towerMount: { x: number; y: number }
  armorBonus: number
}

const MATERIALS = {
  hull: new THREE.MeshStandardMaterial({ color: 0x46545a, roughness: 0.64, metalness: 0.32 }),
  lowerHull: new THREE.MeshStandardMaterial({ color: 0x6f2326, roughness: 0.78, metalness: 0.15 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x9b7447, roughness: 0.86, metalness: 0.04 }),
  armor: new THREE.MeshStandardMaterial({ color: 0x273036, roughness: 0.58, metalness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x56636a, roughness: 0.5, metalness: 0.48 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x12181c, roughness: 0.48, metalness: 0.55 }),
  glass: new THREE.MeshBasicMaterial({ color: 0x87d8ff }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc7923c, roughness: 0.38, metalness: 0.65 }),
  selection: new THREE.MeshBasicMaterial({ color: 0xf4cf6a, transparent: true, opacity: 0.78 }),
  torpedo: new THREE.MeshStandardMaterial({ color: 0x2f7687, roughness: 0.52, metalness: 0.38 }),
  aa: new THREE.MeshStandardMaterial({ color: 0x3f8d5b, roughness: 0.55, metalness: 0.32 }),
  missile: new THREE.MeshStandardMaterial({ color: 0x6a5bb5, roughness: 0.52, metalness: 0.38 }),
}

const MOUNT_LENGTH_SCALE = 0.42
const MOUNT_BEAM_SCALE = 0.30

export class ThreeShipDesignerRenderer {
  private readonly container: HTMLDivElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly shipRoot = new THREE.Group()
  private readonly clock = new THREE.Clock()
  private readonly oceanGeometry = new THREE.PlaneGeometry(220, 220, 96, 96)
  private readonly onResizeRef = () => this.resize()
  private currentKey = ''
  private visible = false

  constructor() {
    this.container = document.createElement('div')
    this.container.id = 'ship-designer-3d'
    this.container.style.position = 'fixed'
    this.container.style.left = '0'
    this.container.style.top = '0'
    this.container.style.width = '1px'
    this.container.style.height = '1px'
    this.container.style.zIndex = '110'
    this.container.style.pointerEvents = 'auto'
    this.container.style.display = 'none'
    document.body.appendChild(this.container)

    this.scene.background = this.createSkyTexture()
    this.scene.fog = new THREE.FogExp2(0x0c1d26, 0.018)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000)
    this.camera.position.set(12, 7, 12)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.92
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.enableZoom = true
    this.controls.enablePan = false
    this.controls.enabled = true
    this.controls.target.set(0, 0.7, 0)
    this.controls.minDistance = 7
    this.controls.maxDistance = 22
    this.controls.maxPolarAngle = Math.PI * 0.48

    this.setupLighting()
    this.setupOcean()
    this.scene.add(this.shipRoot)
    window.addEventListener('resize', this.onResizeRef)
  }

  setViewportFromCanvas(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
    const rect = canvas.getBoundingClientRect()
    const scaleX = rect.width / Math.max(1, canvas.width)
    const scaleY = rect.height / Math.max(1, canvas.height)
    this.container.style.left = `${rect.left + x * scaleX}px`
    this.container.style.top = `${rect.top + y * scaleY}px`
    this.container.style.width = `${Math.max(1, w * scaleX)}px`
    this.container.style.height = `${Math.max(1, h * scaleY)}px`
    this.resize()
  }

  setViewportFromElement(element: HTMLElement): void {
    const rect = element.getBoundingClientRect()
    this.container.style.left = `${rect.left}px`
    this.container.style.top = `${rect.top}px`
    this.container.style.width = `${Math.max(1, rect.width)}px`
    this.container.style.height = `${Math.max(1, rect.height)}px`
    this.resize()
  }

  show(config: ShipDesignerPreviewConfig): void {
    const key = previewKey(config)
    if (key !== this.currentKey) {
      this.currentKey = key
      this.rebuildShip(config)
    }
    this.visible = true
    this.container.style.display = 'block'
  }

  hide(): void {
    this.visible = false
    this.container.style.display = 'none'
  }

  update(): void {
    if (!this.visible) return
    const elapsed = this.clock.getElapsedTime()
    const pos = this.oceanGeometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      pos.setZ(i, Math.sin(x * 0.12 + elapsed) * 0.52 + Math.cos(y * 0.17 + elapsed * 0.8) * 0.36)
    }
    pos.needsUpdate = true
    this.oceanGeometry.computeVertexNormals()
    this.shipRoot.rotation.y = Math.sin(elapsed * 0.18) * 0.05
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResizeRef)
    this.controls.dispose()
    this.renderer.dispose()
    this.container.remove()
  }

  private setupLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xc7dfef, 0x07131a, 1.0))

    const sun = new THREE.DirectionalLight(0xffefd0, 3.6)
    sun.position.set(9, 14, 7)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -18
    sun.shadow.camera.right = 18
    sun.shadow.camera.top = 18
    sun.shadow.camera.bottom = -18
    this.scene.add(sun)

    const rim = new THREE.DirectionalLight(0x72b8ff, 1.15)
    rim.position.set(-8, 5, -10)
    this.scene.add(rim)
  }

  private setupOcean(): void {
    const ocean = new THREE.Mesh(
      this.oceanGeometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x0d4b5c,
        roughness: 0.34,
        metalness: 0.36,
        clearcoat: 0.42,
        clearcoatRoughness: 0.2,
      }),
    )
    ocean.rotation.x = -Math.PI / 2
    ocean.position.y = -0.42
    ocean.receiveShadow = true
    this.scene.add(ocean)

    const grid = new THREE.GridHelper(34, 34, 0x91d4df, 0x2b6672)
    grid.position.y = -0.39
    this.scene.add(grid)
  }

  private rebuildShip(config: ShipDesignerPreviewConfig): void {
    this.shipRoot.clear()
    const ship = buildShip(config)
    this.shipRoot.add(ship)
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect()
    if (rect.width <= 1 || rect.height <= 1) return
    this.camera.aspect = rect.width / rect.height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(rect.width, rect.height, false)
  }

  private createSkyTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#071018')
    gradient.addColorStop(0.55, '#163342')
    gradient.addColorStop(1, '#4a7c86')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}

export function buildShip(config: ShipDesignerPreviewConfig): THREE.Group {
  const dims = scaledShipDims(config.hull.templateId ?? config.hull.shipType, config.armorBonus)
  const shape = SHIP_SHAPES[config.hull.templateId] ?? config.hull.shipType
  const l = dims.l * 0.045
  const w = dims.w * 0.045
  const h = Math.max(0.48, dims.h * 0.045)
  const ship = new THREE.Group()
  ship.name = config.hull.name

  addHull(ship, shape, l, w, h, config.armorBonus)
  addSuperstructure(ship, shape, l, w, h, config.towerMount)

  for (const weapon of config.weapons) {
    const mount = createWeapon(weapon)
    mount.name = weapon.name
    mount.position.set(-weapon.mount.y * l * MOUNT_LENGTH_SCALE, h * 0.54, weapon.mount.x * w * MOUNT_BEAM_SCALE)
    mount.rotation.y = weapon.mount.y > 0.34 ? Math.PI : 0
    mount.userData = {
      ...mount.userData,
      weaponId: weapon.id,
      weaponType: weapon.type,
      baseRotationY: mount.rotation.y,
      canTraverse: weapon.type === 'gun' || weapon.type === 'secondary' || weapon.type === 'aa' || weapon.type === 'missile',
    }
    if (weapon.selected) mount.add(selectionRing(weapon.type === 'gun' ? 0.58 : 0.42))
    ship.add(mount)
  }

  ship.scale.setScalar(1.05)
  return ship
}

function addHull(parent: THREE.Group, shape: ShipShapeClass, length: number, beam: number, height: number, armorBonus: number): void {
  const bowType = shape === 'destroyer' ? 'sharp' : shape === 'cruiser' ? 'round' : 'flat'
  parent.add(mesh(hullGeometry(length, beam, height, bowType), MATERIALS.hull))

  const lower = mesh(hullGeometry(length * 0.98, beam * 0.9, height * 0.48, bowType), MATERIALS.lowerHull)
  lower.position.y = -height * 0.32
  parent.add(lower)

  const deck = mesh(deckGeometry(length * 0.92, beam * 0.72, bowType), MATERIALS.deck)
  deck.rotation.x = -Math.PI / 2
  deck.position.y = height * 0.44
  parent.add(deck)

  const beltThickness = 0.14 + Math.min(0.16, armorBonus / 900)
  const belt = mesh(new THREE.BoxGeometry(length * 0.78, height * beltThickness, beam * 0.74), MATERIALS.armor)
  belt.position.y = height * 0.05
  parent.add(belt)

  for (const side of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(length * 0.78, 0.025, 0.025), MATERIALS.dark)
    rail.position.set(-length * 0.03, height * 0.58, side * beam * 0.43)
    parent.add(rail)
  }
}

function addSuperstructure(
  parent: THREE.Group,
  shape: ShipShapeClass,
  length: number,
  beam: number,
  height: number,
  towerMount: { x: number; y: number },
): void {
  const bridge = new THREE.Group()
  bridge.position.set(-towerMount.y * length * 0.36, height * 0.54, towerMount.x * beam * 0.34)
  parent.add(bridge)

  const baseW = shape === 'destroyer' ? 0.82 : shape === 'cruiser' ? 1.10 : 1.38
  const citadel = mesh(new THREE.BoxGeometry(baseW, 0.28, beam * 0.42), MATERIALS.armor)
  citadel.position.set(0, 0.08, 0)
  bridge.add(citadel)

  const layers = shape === 'destroyer' ? 2 : shape === 'cruiser' ? 3 : 4
  for (let i = 0; i < layers; i++) {
    const layer = mesh(new THREE.BoxGeometry(baseW * (0.70 - i * 0.08), 0.22, beam * (0.28 - i * 0.025)), MATERIALS.metal)
    layer.position.set(0.14, 0.32 + i * 0.23, 0)
    bridge.add(layer)
  }

  const mast = mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.12, 10), MATERIALS.dark)
  mast.position.set(0.10, 1.16, 0)
  bridge.add(mast)

  const yard = mesh(new THREE.BoxGeometry(0.92, 0.025, 0.025), MATERIALS.dark)
  yard.position.set(0.10, 1.46, 0)
  bridge.add(yard)

  const funnel = mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.78, 24), MATERIALS.dark)
  funnel.position.set(-length * 0.08, 0.35, beam * 0.08)
  funnel.rotation.z = -0.12
  parent.add(funnel)

  const cap = mesh(new THREE.CylinderGeometry(0.20, 0.18, 0.10, 24), MATERIALS.dark)
  cap.position.set(-length * 0.085, 0.74, beam * 0.08)
  cap.rotation.z = -0.12
  parent.add(cap)
}

function createWeapon(weapon: ShipDesignerPreviewWeapon): THREE.Group {
  const barrels = barrelsFor(weapon)
  if (weapon.type === 'torpedo') return torpedoLauncher(barrels)
  if (weapon.type === 'aa') return aaGun(barrels)
  if (weapon.type === 'missile') return missileRack(barrels)
  return gunTurret(weapon.type === 'gun' ? 1 : 0.58, barrels)
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material)
  item.castShadow = true
  item.receiveShadow = true
  return item
}

function selectionRing(radius: number): THREE.Mesh {
  const ring = mesh(new THREE.TorusGeometry(radius, 0.018, 8, 72), MATERIALS.selection)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.025
  ring.castShadow = false
  ring.receiveShadow = false
  return ring
}

function hullGeometry(length: number, beam: number, height: number, bowType: 'sharp' | 'round' | 'flat'): THREE.BufferGeometry {
  const segments = 28
  const vertices: number[] = []
  const indices: number[] = []
  const ringPoints = 7
  const bowSharpness = bowType === 'sharp' ? 0.48 : bowType === 'round' ? 0.62 : 0.82

  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const x = (u - 0.5) * length
    const taper = Math.pow(Math.sin(Math.PI * u), bowSharpness)
    const half = beam * 0.5 * taper
    const lift = Math.max(0, Math.abs(u - 0.5) * 2 - 0.72) * height * 0.26
    const ring: Array<[number, number, number]> = [
      [x, height * 0.44 + lift, -half * 0.7],
      [x, height * 0.08 + lift * 0.55, -half],
      [x, -height * 0.34 + lift * 0.2, -half * 0.62],
      [x, -height * 0.48 + lift * 0.1, 0],
      [x, -height * 0.34 + lift * 0.2, half * 0.62],
      [x, height * 0.08 + lift * 0.55, half],
      [x, height * 0.44 + lift, half * 0.7],
    ]
    ring.forEach(point => vertices.push(...point))
  }

  for (let i = 0; i < segments; i++) {
    const a = i * ringPoints
    const b = (i + 1) * ringPoints
    for (let j = 0; j < ringPoints - 1; j++) {
      indices.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function deckGeometry(length: number, beam: number, bowType: 'sharp' | 'round' | 'flat'): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  const points = deckOutlinePoints(length, beam, bowType)
  const first = points[0]!
  shape.moveTo(first.x, first.z)
  for (const point of points.slice(1)) shape.lineTo(point.x, point.z)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function deckOutlinePoints(
  length: number,
  beam: number,
  bowType: 'sharp' | 'round' | 'flat',
): Array<{ x: number; z: number }> {
  const halfBeam = beam * 0.5
  const stations = 34
  const maxHalf = halfBeam * (bowType === 'sharp' ? 0.58 : bowType === 'round' ? 0.64 : 0.70)
  const bowExponent = bowType === 'sharp' ? 0.38 : bowType === 'round' ? 0.52 : 0.72
  const sternExponent = bowType === 'flat' ? 0.55 : 0.42
  const starboard: Array<{ x: number; z: number }> = []
  const port: Array<{ x: number; z: number }> = []

  for (let i = 0; i <= stations; i++) {
    const u = i / stations
    const x = (u - 0.5) * length
    const bowTaper = Math.pow(Math.sin(Math.PI * Math.min(1, u / 0.23) * 0.5), bowExponent)
    const sternTaper = Math.pow(Math.sin(Math.PI * Math.min(1, (1 - u) / 0.18) * 0.5), sternExponent)
    const midshipShoulder = 0.92 + Math.sin(Math.PI * u) * 0.08
    const flatStern = bowType === 'flat' && u > 0.92 ? 0.78 + (1 - u) * 1.22 : 1
    const half = maxHalf * bowTaper * sternTaper * midshipShoulder * flatStern
    starboard.push({ x, z: -half })
    port.unshift({ x, z: half })
  }

  return [...starboard, ...port]
}

function gunTurret(scale: number, barrels: number): THREE.Group {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(0.36 * scale, 0.42 * scale, 0.12 * scale, 32), MATERIALS.dark))

  const body = mesh(new THREE.BoxGeometry(0.72 * scale, 0.28 * scale, 0.58 * scale), MATERIALS.metal)
  body.position.y = 0.16 * scale
  group.add(body)

  const spacing = 0.18 * scale
  const first = -((barrels - 1) * spacing) / 2
  for (let i = 0; i < barrels; i++) {
    const barrel = mesh(new THREE.CylinderGeometry(0.026 * scale, 0.04 * scale, 1.18 * scale, 18), MATERIALS.dark)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(first + i * spacing, 0.23 * scale, -0.66 * scale)
    group.add(barrel)
  }
  return group
}

function torpedoLauncher(barrels: number): THREE.Group {
  const group = new THREE.Group()
  group.add(mesh(new THREE.BoxGeometry(0.72, 0.18, 0.32), MATERIALS.torpedo))
  const count = Math.min(4, Math.max(1, barrels))
  for (let i = 0; i < count; i++) {
    const tube = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 16), MATERIALS.metal)
    tube.rotation.x = Math.PI / 2
    tube.position.set((i - (count - 1) / 2) * 0.09, 0.08, 0)
    group.add(tube)
  }
  return group
}

function aaGun(barrels: number): THREE.Group {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 16), MATERIALS.aa))
  const count = Math.min(4, Math.max(1, barrels))
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * 0.05
    const barrel = mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.5, 10), MATERIALS.dark)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(x, 0.12, -0.24)
    group.add(barrel)
  }
  return group
}

function missileRack(barrels: number): THREE.Group {
  const group = new THREE.Group()
  const rack = mesh(new THREE.BoxGeometry(0.46, 0.30, 0.46), MATERIALS.missile)
  rack.position.y = 0.12
  group.add(rack)
  const positions = [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]] as const
  const count = Math.min(4, Math.max(1, barrels))
  for (let i = 0; i < count; i++) {
    const [x, z] = positions[i]!
    const cell = mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), MATERIALS.dark)
    cell.position.set(x, 0.16, z)
    group.add(cell)
  }
  return group
}

function barrelsFor(weapon: ShipDesignerPreviewWeapon): number {
  if (weapon.barrels) return Math.min(4, Math.max(1, Math.round(weapon.barrels)))
  if (weapon.id.includes('single')) return 1
  if (weapon.id.includes('460mm') || weapon.id.includes('406mm')) return 3
  return 2
}

function previewKey(config: ShipDesignerPreviewConfig): string {
  return JSON.stringify({
    hull: config.hull.templateId,
    armor: config.armorBonus,
    tower: config.towerMount,
    weapons: config.weapons.map(w => [w.id, w.type, w.mount.x, w.mount.y, w.barrels, w.selected]),
  })
}
