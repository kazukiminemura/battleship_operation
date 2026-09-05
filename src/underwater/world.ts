import * as THREE from 'three'
import { BASE, SITES, seabed, sitePosition, type DiveState, type Site } from './simulation'

const material = (color: number, roughness = 0.85, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const steel = material(0xd0a347, 0.42, 0.45), dark = material(0x183b40), rock = material(0x31564d)
const rust = material(0x655148), stone = material(0x668274), bone = material(0x9fa38b)
const cyan = new THREE.MeshStandardMaterial({ color: 0x83ffdb, emissive: 0x27debe, emissiveIntensity: 1.8 })
function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const object = new THREE.Mesh(geometry, mat)
  object.position.set(x, y, z); parent.add(object)
  return object
}
function rod(parent: THREE.Object3D, a: number[], b: number[], radius: number, mat: THREE.Material): void {
  const start = new THREE.Vector3(a[0]!, a[1]!, a[2]!), end = new THREE.Vector3(b[0]!, b[1]!, b[2]!)
  const delta = end.clone().sub(start)
  const m = mesh(parent, new THREE.CylinderGeometry(radius, radius, delta.length(), 8), mat)
  m.position.copy(start).add(end).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
}
function rng(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296 }
}

export class DiveWorld {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600)
  private readonly submarine = new THREE.Group()
  private readonly propeller = new THREE.Group()
  private readonly markers = new Map<string, THREE.Mesh>()
  private readonly fish: THREE.InstancedMesh
  private readonly dust: THREE.Points
  private readonly sonar: THREE.Mesh
  private readonly dummy = new THREE.Object3D()
  private readonly cameraPosition = new THREE.Vector3()
  private readonly lookTarget = new THREE.Vector3()
  private readonly sonarOrigin = new THREE.Vector3()
  private lastSonarAge = 99
  private width = 0
  private height = 0

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.domElement.id = 'ocean-view'
    this.renderer.domElement.setAttribute('aria-label', '潜水艇から見た海中の3D風景')
    host.prepend(this.renderer.domElement)
    this.scene.background = new THREE.Color(0x073b48)
    this.scene.fog = new THREE.FogExp2(0x073b48, 0.014)
    this.scene.add(new THREE.HemisphereLight(0x81e1e5, 0x102822, 2.3))
    const sun = new THREE.DirectionalLight(0xc7f4df, 2.8)
    sun.position.set(-30, 80, 15); this.scene.add(sun)
    this.buildTerrain()
    this.buildSubmarine()
    this.buildBase()
    for (const site of SITES) this.buildSite(site)
    this.fish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.65, 5), material(0x9edcce, 0.35, 0.25), 110)
    this.fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.scene.add(this.fish)
    const random = rng(311)
    const positions = new Float32Array(1400 * 3)
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (random() - 0.5) * 190; positions[i + 1] = -random() * 57; positions[i + 2] = (random() - 0.5) * 230
    }
    const dustGeometry = new THREE.BufferGeometry()
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xb4ece1, size: 0.09, transparent: true, opacity: 0.40, depthWrite: false }))
    this.scene.add(this.dust)
    this.sonar = mesh(this.scene, new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=-p.xyz; gl_Position=projectionMatrix*p; }`,
      fragmentShader: `varying vec3 n; varying vec3 v; void main(){ float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.); gl_FragColor=vec4(.32,.95,.75,rim*.24); }`,
    }))
    this.camera.position.set(0, -10, 83)
    this.resize()
  }

  private buildTerrain(): void {
    const geometry = new THREE.PlaneGeometry(540, 540, 140, 140)
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(0, 0, -80)
    const pos = geometry.getAttribute('position'), colors = new Float32Array(pos.count * 3)
    const color = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = seabed(x, z)
      pos.setY(i, y)
      color.setHSL(0.43 + Math.sin(x * 0.1) * 0.014, 0.18, 0.24 + (y + 44) * 0.014 + Math.sin(z * 1.2 + x * 0.4) * 0.014)
      colors.set([color.r, color.g, color.b], i * 3)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals()
    mesh(this.scene, geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
    const random = rng(493)
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), rock, 180)
    const object = new THREE.Object3D()
    for (let i = 0; i < rocks.count; i++) {
      const x = (random() - 0.5) * 420, z = random() * -370 + 100, s = 0.6 + random() * 3.4
      object.position.set(x, seabed(x, z) - 0.2, z); object.scale.set(s * 1.5, s * 0.65, s)
      object.rotation.set(random(), random() * 6, random() * 0.3); object.updateMatrix(); rocks.setMatrixAt(i, object.matrix)
    }
    this.scene.add(rocks)
    const kelp = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1, 5), material(0x386f5c), 240)
    for (let i = 0; i < kelp.count; i++) {
      const x = (random() - 0.5) * 310, z = random() * -300 + 85, h = random() * 3 + 0.7
      object.position.set(x, seabed(x, z) + h / 2, z); object.scale.set(1, h, 1)
      object.rotation.set(0, random() * 6, 0.1); object.updateMatrix(); kelp.setMatrixAt(i, object.matrix)
    }
    this.scene.add(kelp)
    const rayMaterial = new THREE.MeshBasicMaterial({ color: 0x9debe0, transparent: true, opacity: 0.021, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    for (let i = 0; i < 9; i++) {
      const ray = mesh(this.scene, new THREE.ConeGeometry(7 + i % 3, 70, 16, 1, true), rayMaterial, (i - 4) * 24, -12, -40 - i * 12)
      ray.rotation.z = -0.22
    }
  }

  private buildSubmarine(): void {
    const sub = this.submarine
    sub.name = 'NEREID-07'
    mesh(sub, new THREE.SphereGeometry(1, 32, 20), steel).scale.set(1.13, 1.02, 2.8)
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x194651, metalness: 0.65, roughness: 0.13, clearcoat: 1 })
    mesh(sub, new THREE.SphereGeometry(0.92, 24, 16), glass, 0, 0.04, -2.1).scale.z = 0.8
    const rim = mesh(sub, new THREE.TorusGeometry(0.89, 0.065, 8, 32), dark, 0, 0.04, -2.34)
    rim.scale.y = 0.98
    mesh(sub, new THREE.BoxGeometry(1.1, 0.3, 1.5), steel, 0, 0.96, 0.25)
    rod(sub, [0, 1, 0.5], [0, 1.85, 0.5], 0.055, dark)
    mesh(sub, new THREE.SphereGeometry(0.10, 8, 8), cyan, 0, 1.87, 0.5)
    for (const side of [-1, 1]) {
      const thruster = mesh(sub, new THREE.CylinderGeometry(0.38, 0.38, 1.2, 16), dark, side * 1.3, -0.1, 1.1)
      thruster.rotation.x = Math.PI / 2
      mesh(sub, new THREE.BoxGeometry(1.1, 0.10, 0.75), steel, side * 1.35, 0, 0.5)
      rod(sub, [side * 0.8, -1.25, -1.6], [side * 0.8, -1.25, 1.9], 0.065, dark)
      for (const z of [-0.8, 1]) rod(sub, [side * 0.8, -0.5, z], [side * 0.8, -1.25, z], 0.055, dark)
      mesh(sub, new THREE.SphereGeometry(0.14, 8, 8), cyan, side * 0.75, -0.25, -2.25)
    }
    this.propeller.position.z = 2.85
    sub.add(this.propeller)
    mesh(this.propeller, new THREE.SphereGeometry(0.16, 10, 8), dark)
    for (let i = 0; i < 4; i++) {
      const blade = mesh(this.propeller, new THREE.BoxGeometry(0.13, 0.7, 0.06), steel)
      blade.rotation.z = i * Math.PI / 2; blade.position.set(Math.sin(i * Math.PI / 2) * 0.29, Math.cos(i * Math.PI / 2) * 0.29, 0)
    }
    const lamp = new THREE.SpotLight(0xc7fff1, 140, 65, Math.PI / 5, 0.6, 1.3)
    lamp.position.set(0, -0.15, -2); lamp.target.position.set(0, -5, -23)
    sub.add(lamp, lamp.target)
    const beam = mesh(sub, new THREE.ConeGeometry(5, 21, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xafffe9, transparent: true, opacity: 0.026, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -1.8, -12)
    beam.rotation.x = Math.PI / 2 + 0.10
    sub.position.set(BASE.x, BASE.y, BASE.z); this.scene.add(sub)
  }

  private buildBase(): void {
    const base = new THREE.Group(); base.position.set(BASE.x, BASE.y - 5, BASE.z); this.scene.add(base)
    mesh(base, new THREE.CylinderGeometry(6, 7, 0.8, 32), material(0x2f666b), 0, 0)
    const ring = mesh(base, new THREE.TorusGeometry(5, 0.10, 8, 48), cyan, 0, 0.5); ring.rotation.x = Math.PI / 2
    for (const x of [-4, 4]) for (const z of [-4, 4]) rod(base, [x, -1, z], [x, -22, z], 0.15, dark)
    mesh(base, new THREE.BoxGeometry(2, 2.2, 1.5), steel, 0, 1.5, 4)
    const beacon = new THREE.PointLight(0x6dffcf, 25, 22); beacon.position.y = 2; base.add(beacon)
  }

  private buildSite(site: Site): void {
    const group = new THREE.Group(); group.position.set(site.x, seabed(site.x, site.z), site.z); this.scene.add(group)
    if (site.kind === 'wreck') {
      const hull = mesh(group, new THREE.SphereGeometry(1, 20, 12), rust, 0, 1.4, 0)
      hull.scale.set(4.2, 2, 12); hull.rotation.z = -0.14
      mesh(group, new THREE.BoxGeometry(6, 0.35, 18), dark, 0, 3, 0)
      mesh(group, new THREE.BoxGeometry(3.8, 3.1, 4.8), rust, 0, 4.2, 3)
      for (const side of [-1, 1]) for (let i = 0; i < 7; i++) mesh(group, new THREE.BoxGeometry(0.4, 0.16, 1.5), stone, side * 2.8, 3.3, -7 + i * 2)
      rod(group, [0, 4, 4], [-1.5, 11, 7], 0.14, rust)
      rod(group, [-3, 9, 7], [2, 9, 7], 0.08, rust)
    } else if (site.kind === 'arch') {
      for (const z of [-5, 3]) {
        for (const x of [-4.5, 4.5]) mesh(group, new THREE.CylinderGeometry(0.8, 1, 5, 12), stone, x, 2.5, z)
        mesh(group, new THREE.TorusGeometry(4.5, 0.85, 8, 20, Math.PI), stone, 0, 5, z)
      }
      mesh(group, new THREE.BoxGeometry(13, 0.3, 14), stone, 0, 0.1, 0)
    } else if (site.kind === 'vent') {
      for (let i = 0; i < 5; i++) {
        mesh(group, new THREE.CylinderGeometry(0.5, 1.4, 4 + i, 7), rock, Math.sin(i * 2) * 4, (4 + i) / 2, Math.cos(i * 2) * 4)
        mesh(group, new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffa36f, emissive: 0xff6827, emissiveIntensity: 2 }), Math.sin(i * 2) * 4, 4 + i, Math.cos(i * 2) * 4)
      }
      const smoke = mesh(group, new THREE.ConeGeometry(3.8, 16, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x163b3c, transparent: true, opacity: 0.4, depthWrite: false }), 0, 13, 0)
      smoke.rotation.z = Math.PI
    } else if (site.kind === 'coral') {
      for (let i = 0; i < 22; i++) {
        const x = Math.sin(i * 2.4) * (2 + i / 4), z = Math.cos(i * 2.4) * (2 + i / 4), h = 1.5 + i % 4
        rod(group, [x, 0, z], [x, h, z], 0.12, cyan)
        rod(group, [x, h * 0.5, z], [x + 0.8, h * 0.85, z + 0.6], 0.07, cyan)
        mesh(group, new THREE.SphereGeometry(0.26, 8, 6), cyan, x, h, z)
      }
    } else {
      rod(group, [0, 1.2, -11], [0, 1.2, 9], 0.35, bone)
      for (let i = 0; i < 8; i++) {
        const rib = mesh(group, new THREE.TorusGeometry(3.2 - i * 0.18, 0.15, 6, 18, Math.PI), bone, 0, 1, -7 + i * 1.9)
        rib.rotation.z = 0.08
      }
      mesh(group, new THREE.SphereGeometry(1, 12, 10), bone, 0, 1.1, 11).scale.set(1.6, 0.8, 3.4)
    }
    const marker = mesh(group, new THREE.TorusGeometry(1, 0.055, 6, 32), cyan, 0, 11)
    this.markers.set(site.id, marker)
  }

  resize(): void {
    if (innerWidth === this.width && innerHeight === this.height) return
    this.width = innerWidth; this.height = innerHeight
    this.renderer.setSize(this.width, this.height); this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix()
  }
  render(state: DiveState, dt: number, time: number): void {
    this.resize()
    const x = state.pos.x, y = state.pos.y, z = state.pos.z
    this.submarine.position.set(x, y + Math.sin(time * 1.5) * 0.06, z)
    this.submarine.rotation.set(Math.sin(time) * 0.012, -state.yaw, -Math.sin(time * 1.4) * 0.016)
    this.propeller.rotation.z += dt * (Math.abs(state.speed) * 3 + 1.5)
    this.cameraPosition.set(x - Math.sin(state.yaw) * 16, y + 6, z + Math.cos(state.yaw) * 16)
    this.camera.position.lerp(this.cameraPosition, 1 - Math.exp(-dt * 3))
    this.lookTarget.set(x + Math.sin(state.yaw) * 5, y - 0.5, z - Math.cos(state.yaw) * 5)
    this.camera.lookAt(this.lookTarget)
    this.dust.position.set(x * 0.7, Math.sin(time * 0.1), z * 0.7)
    for (let i = 0; i < this.fish.count; i++) {
      const school = Math.floor(i / 22), angle = time * 0.12 + school * 1.7
      const fx = Math.sin(angle) * 12 + (school - 2) * 34 + Math.sin(i * 2.1) * 6
      const fz = -school * 38 + Math.cos(angle) * 12 + Math.cos(i * 2.1) * 6
      this.dummy.position.set(fx, -26 + Math.sin(i * 1.5) * 3 + Math.sin(time + i) * 0.3, fz)
      this.dummy.rotation.set(Math.PI / 2, 0, -angle); this.dummy.scale.setScalar(1 + school * 0.22); this.dummy.updateMatrix()
      this.fish.setMatrixAt(i, this.dummy.matrix)
    }
    this.fish.instanceMatrix.needsUpdate = true
    if (state.sonarAge < this.lastSonarAge) this.sonarOrigin.set(x, y, z)
    this.lastSonarAge = state.sonarAge
    this.sonar.visible = state.sonarAge < 3
    this.sonar.position.copy(this.sonarOrigin); this.sonar.scale.setScalar(Math.max(0.1, state.sonarAge * 42))
    for (const site of SITES) {
      const marker = this.markers.get(site.id)!
      marker.visible = state.revealed.includes(site.id) && !state.scanned.includes(site.id)
      marker.rotation.y = time * 0.4; marker.position.y = 11 + Math.sin(time * 2) * 0.3
    }
    this.renderer.render(this.scene, this.camera)
  }
  screenPoint(site: Site): { x: number; y: number; visible: boolean } {
    const p = sitePosition(site)
    const vector = new THREE.Vector3(p.x, p.y + 6, p.z).project(this.camera)
    return { x: (vector.x + 1) * this.width / 2, y: (1 - vector.y) * this.height / 2, visible: vector.z > -1 && vector.z < 1 && Math.abs(vector.x) < 1 && Math.abs(vector.y) < 1 }
  }
}
