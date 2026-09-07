import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { bowSheer, hullHalfWidth, navalHull, navalDeck, timberTexture } from './naval-geometry'
import { historicalProfile } from './historical-ship-profiles'
import { buildYukimuraSnowman } from './yukimura-snowman'
import { blenderBattleshipPart, BLENDER_REFERENCE_LENGTH } from './blender-battleship'
import { addHistoricalSuperstructure } from './historical-superstructure'
import { addDesignedStructures } from './designed-structures'
import type { DesignedStructure } from '../data/ship-design-layout'
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
  instanceId?: string
  rotation?: number
}

export interface ShipDesignerPreviewConfig {
  hull: HullCatalogEntry
  weapons: ShipDesignerPreviewWeapon[]
  towerMount: { x: number; y: number }
  armorBonus: number
  structures?: DesignedStructure[]
}

const MATERIALS = {
  hull: new THREE.MeshStandardMaterial({ color: 0x59666a, roughness: 0.76, metalness: 0.18 }),
  lowerHull: new THREE.MeshStandardMaterial({ color: 0x65272a, roughness: 0.72, metalness: 0.22 }),
  deck: new THREE.MeshStandardMaterial({ color: 0xffffff, map: timberTexture(), roughness: 0.92, metalness: 0 }),
  steelDeck: new THREE.MeshStandardMaterial({ color: 0x555956, roughness: 0.88, metalness: 0.12 }),
  armor: new THREE.MeshStandardMaterial({ color: 0x303a3e, roughness: 0.48, metalness: 0.52 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x56636a, roughness: 0.5, metalness: 0.48 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x12181c, roughness: 0.48, metalness: 0.55 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x223f49, roughness: 0.17, metalness: 0.65 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc7923c, roughness: 0.38, metalness: 0.65 }),
  selection: new THREE.MeshBasicMaterial({ color: 0xf4cf6a, transparent: true, opacity: 0.78 }),
  torpedo: new THREE.MeshStandardMaterial({ color: 0x4c5555, roughness: 0.72, metalness: 0.25 }),
  aa: new THREE.MeshStandardMaterial({ color: 0x505a57, roughness: 0.72, metalness: 0.25 }),
  missile: new THREE.MeshStandardMaterial({ color: 0x515b5c, roughness: 0.72, metalness: 0.25 }),
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
  private framedHull = ''
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

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000)
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
    this.resize()
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
      pos.setZ(i, Math.sin(x * 0.9 + elapsed) * 0.055 + Math.cos(y * 1.3 + elapsed * 0.8) * 0.035)
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
    sun.shadow.normalBias = 0.025
    sun.shadow.bias = -0.0002
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
    ocean.position.y = -0.08
    ocean.receiveShadow = true
    this.scene.add(ocean)

  }

  private rebuildShip(config: ShipDesignerPreviewConfig): void {
    this.shipRoot.clear()
    const ship = buildShip(config)
    this.shipRoot.add(ship)
    if (this.framedHull !== config.hull.templateId) {
      this.framedHull = config.hull.templateId
      const bounds = new THREE.Box3().setFromObject(ship)
      const size = bounds.getSize(new THREE.Vector3())
      const distance = designerCameraDistance(size.x)
      this.controls.target.set(0, size.y * 0.28, 0)
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3(0.96, 0.48, 1.12).normalize().multiplyScalar(distance))
      this.controls.minDistance = size.x * 0.46
      this.controls.maxDistance = size.x * 2.8
      this.controls.update()
    }
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

/** Hero framing for the designer; geometry and gameplay dimensions stay intact. */
export function designerCameraDistance(shipLength: number): number {
  return shipLength * 0.90
}

export function buildShip(config: ShipDesignerPreviewConfig): THREE.Group {
  const dims = scaledShipDims(config.hull.templateId ?? config.hull.shipType, config.armorBonus)
  const shape = SHIP_SHAPES[config.hull.templateId] ?? config.hull.shipType
  const l = dims.l * 0.045
  const profile = historicalProfile(shape)
  const w = l / profile.lengthToBeam
  const h = l * profile.freeboard / 0.44
  const ship = new THREE.Group()
  ship.name = config.hull.name

  if (shape === 'yukimura') ship.add(buildYukimuraSnowman(l))
  else addHull(ship, shape, l, w, h, config.armorBonus)
  ship.userData['historicalClass'] = profile.kind
  ship.userData['designInspiration'] = profile.inspiration
  if (shape === 'yukimura') {
    ship.userData['designInspiration'] = 'Green-hat plush snowman with red-green scarf'
  } else if (config.structures !== undefined) {
    addDesignedStructures(ship, config.structures, profile, l, w, h, MATERIALS)
  } else addHistoricalSuperstructure(ship, profile, l, w, h * 0.44, config.towerMount, MATERIALS,
    config.weapons.map(weapon => ({
      x: -weapon.mount.y * l * MOUNT_LENGTH_SCALE,
      z: weapon.mount.x * w * MOUNT_BEAM_SCALE,
      radius: weapon.type === 'gun' ? profile.gunScale * 0.43 : 0.13,
    })))

  for (const weapon of config.weapons) {
    const mount = createWeapon(weapon, profile.kind === 'battleship')
    const weaponScale = weapon.type === 'gun' ? profile.gunScale : Math.min(0.85, profile.gunScale)
    mount.scale.setScalar(weaponScale)
    mount.name = weapon.name
    const superfiring = weapon.type === 'gun' && Math.abs(weapon.mount.x) < 0.1 && weapon.mount.y < -0.2 && weapon.mount.y > -0.6
    const barbetteHeight = superfiring ? profile.gunScale * 0.24 : 0
    if (barbetteHeight > 0) {
      const barbette = mesh(new THREE.CylinderGeometry(profile.gunScale * 0.35, profile.gunScale * 0.35, barbetteHeight, 24), MATERIALS.hull)
      barbette.position.set(-weapon.mount.y * l * MOUNT_LENGTH_SCALE, h * 0.44 + bowSheer(0.5 - weapon.mount.y * MOUNT_LENGTH_SCALE, h) + barbetteHeight / 2, weapon.mount.x * w * MOUNT_BEAM_SCALE)
      ship.add(barbette)
    }
    const seatY = h * 0.44 + bowSheer(0.5 - weapon.mount.y * MOUNT_LENGTH_SCALE, h)
    mount.position.set(-weapon.mount.y * l * MOUNT_LENGTH_SCALE, seatY + 0.06 * weaponScale + barbetteHeight, weapon.mount.x * w * MOUNT_BEAM_SCALE)
    mount.rotation.y = weapon.rotation !== undefined ? -Math.PI / 2 - weapon.rotation * Math.PI / 180 : weapon.mount.y > 0.34 ? Math.PI / 2 : -Math.PI / 2
    mount.userData = {
      ...mount.userData,
      weaponId: weapon.id,
      designInstanceId: weapon.instanceId,
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
  if (historicalProfile(shape).kind === 'battleship') {
    parent.add(blenderBattleshipPart('hull', length / BLENDER_REFERENCE_LENGTH))
    return
  }
  parent.add(mesh(navalHull(length, beam, -height * 0.12, height * 0.44), MATERIALS.hull))

  const lower = mesh(navalHull(length, beam * 0.91, -height * 0.48, -height * 0.12, true), MATERIALS.lowerHull)
  parent.add(lower)

  const deck = mesh(navalDeck(length, beam * 0.99, height), historicalProfile(shape).timberDeck ? MATERIALS.deck : MATERIALS.steelDeck)
  deck.rotation.x = -Math.PI / 2
  deck.position.y = height * 0.44 + 0.005
  parent.add(deck)

  const beltThickness = 0.14 + Math.min(0.16, armorBonus / 900)
  const belt = mesh(navalHull(length, beam * 0.932, -height * 0.12, -height * 0.12 + height * beltThickness), MATERIALS.armor)
  parent.add(belt)


  addHullDetails(parent, shape, length, beam, height)
}

/** Adds scale-readable naval construction features without changing collision geometry. */
function addHullDetails(parent: THREE.Group, shape: ShipShapeClass, length: number, beam: number, height: number): void {
  const deckY = height * 0.44 + 0.01
  const isCapitalShip = shape === 'battleship' || shape === 'boss' || shape === 'yukimura'
  const detail = new THREE.MeshStandardMaterial({ color: 0x263136, roughness: 0.48, metalness: 0.55 })
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa4a1, roughness: 0.34, metalness: 0.72 })

  // Waterline, armor-belt seam and portholes give the hull its characteristic layered profile.
  for (const side of [-1, 1]) {

    const portholeCount = isCapitalShip ? 11 : 7
    for (let i = 0; i < portholeCount; i++) {
      const porthole = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.016, 10), MATERIALS.brass)
      porthole.rotation.x = Math.PI / 2
      porthole.position.set(
        THREE.MathUtils.lerp(-length * 0.30, length * 0.27, i / Math.max(1, portholeCount - 1)),
        height * 0.03,
        side * hullHalfWidth(THREE.MathUtils.lerp(0.20, 0.77, i / Math.max(1, portholeCount - 1)), beam) * 0.952,
      )
      parent.add(porthole)
    }

    // Two rail runs with stanchions remain visible even at the tactical camera distance.
    const railPoints: THREE.Vector3[] = []
    for (let i = 0; i <= 28; i++) {
      const u = 0.025 + i / 28 * 0.95
      const x = (u - 0.5) * length, z = side * hullHalfWidth(u, beam) * 0.965
      const railY = deckY + bowSheer(u, height)
      railPoints.push(new THREE.Vector3(x, railY + 0.12, z))
      const post = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 5), railMaterial)
      post.position.set(x, railY + 0.06, z)
      parent.add(post)
    }
    parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPoints), new THREE.LineBasicMaterial({ color: 0x899795 })))
  }

  // Anchor windlass and chain lockers distinguish the bow from a generic vehicle hull.
  const windlass = mesh(new THREE.CylinderGeometry(0.065, 0.065, beam * 0.34, 12), detail)
  windlass.rotation.x = Math.PI / 2
  windlass.position.set(length * 0.34, deckY + bowSheer(0.84, height) + 0.06, 0)
  parent.add(windlass)
  for (const side of [-1, 1]) {
    const anchor = mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 12), detail)
    anchor.rotation.x = Math.PI / 2
    anchor.position.set(length * 0.40, deckY + bowSheer(0.90, height) + 0.015, side * hullHalfWidth(0.90, beam) * 0.5)
    parent.add(anchor)
  }
}


function createWeapon(weapon: ShipDesignerPreviewWeapon, useBlender = false): THREE.Group {
  const barrels = barrelsFor(weapon)
  if (weapon.type === 'torpedo') return torpedoLauncher(barrels)
  if (weapon.type === 'aa') return aaGun(barrels)
  if (weapon.type === 'missile') return missileRack(barrels)
  return gunTurret(weapon.type === 'gun' ? 1 : 0.58, barrels, useBlender)
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


function gunTurret(scale: number, barrels: number, useBlender = false): THREE.Group {
  const group = new THREE.Group()
  if (useBlender) group.add(blenderBattleshipPart('turret', scale))
  else {
  group.add(mesh(new THREE.CylinderGeometry(0.36 * scale, 0.42 * scale, 0.12 * scale, 32), MATERIALS.dark))

  const armorShape = new THREE.Shape()
  armorShape.moveTo(-0.35, 0.28); armorShape.lineTo(0.35, 0.28)
  armorShape.lineTo(0.39, -0.12); armorShape.lineTo(0.24, -0.34)
  armorShape.lineTo(-0.24, -0.34); armorShape.lineTo(-0.39, -0.12); armorShape.closePath()
  const armorGeometry = new THREE.ExtrudeGeometry(armorShape, { depth: 0.20, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.045, bevelSegments: 1, steps: 1 })
  armorGeometry.rotateX(Math.PI / 2)
  const body = mesh(armorGeometry, MATERIALS.metal)
  body.scale.setScalar(scale)
  body.position.y = 0.32 * scale
  group.add(body)
  }

  const spacing = 0.18 * scale
  const first = -((barrels - 1) * spacing) / 2
  for (let i = 0; i < barrels; i++) {
    if (useBlender) {
      const barrel = blenderBattleshipPart('barrel', scale)
      barrel.name = `gun-barrel-${i + 1}`
      barrel.position.x = first + i * spacing
      group.add(barrel)
      continue
    }
    const barrel = mesh(new THREE.CylinderGeometry(0.026 * scale, 0.04 * scale, 1.18 * scale, 18), MATERIALS.metal)
    barrel.name = `gun-barrel-${i + 1}`
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(first + i * spacing, 0.23 * scale, -0.66 * scale)
    group.add(barrel)
    const sleeve = mesh(new THREE.CylinderGeometry(0.049 * scale, 0.055 * scale, 0.30 * scale, 12), MATERIALS.hull)
    sleeve.rotation.x = Math.PI / 2
    sleeve.position.set(first + i * spacing, 0.23 * scale, -0.36 * scale)
    group.add(sleeve)
    const blastBag = mesh(new THREE.SphereGeometry(1, 12, 8), MATERIALS.dark)
    blastBag.scale.set(0.075 * scale, 0.070 * scale, 0.13 * scale)
    blastBag.position.set(first + i * spacing, 0.23 * scale, -0.24 * scale)
    group.add(blastBag)
    const bore = mesh(new THREE.CircleGeometry(0.021 * scale, 12), MATERIALS.dark)
    bore.rotation.y = Math.PI
    bore.position.set(first + i * spacing, 0.23 * scale, -1.253 * scale)
    group.add(bore)
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
    weapons: config.weapons.map(w => [w.id, w.instanceId, w.type, w.mount.x, w.mount.y, w.rotation, w.barrels, w.selected]),
    structures: config.structures,
  })
}
