import * as THREE from 'three'

/** Original mesh inspired by the supplied plush snowman reference. Bow is +X. */
export function buildYukimuraSnowman(length: number): THREE.Group {
  const root = new THREE.Group()
  root.name = 'yukimura-snowman'
  const fibers = new Uint8Array(128 * 128 * 4)
  for (let i = 0; i < 128 * 128; i++) {
    const shade = 160 + ((Math.imul(i + 7, 16807) >>> 0) % 96)
    fibers.set([shade, shade, shade, 255], i * 4)
  }
  const texture = new THREE.DataTexture(fibers, 128, 128)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 5)
  texture.needsUpdate = true
  const cloth = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 1, bumpMap: texture, bumpScale: .055 })
  const snow = cloth(0xfff3de), green = cloth(0x075b37), red = cloth(0xb70f24)
  const orange = cloth(0xff870c)
  const black = new THREE.MeshStandardMaterial({ color: 0x090b0d, roughness: .13, metalness: .12 })
  function ball(name: string, at: number[], size: number[], material: THREE.Material) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material)
    m.name = name
    m.position.set(at[0]!, at[1]!, at[2]!)
    m.scale.set(size[0]!, size[1]!, size[2]!)
    m.castShadow = true; m.receiveShadow = true
    root.add(m)
    return m
  }
  // A soft elongated snow hull carries the user's deck-mounted armament.
  ball('snow-hull', [0, -.12, 0], [6.25, .65, 1.02], snow)
  ball('plush-body', [0, 1.05, 0], [1.25, 1.35, 1.18], snow)
  ball('plush-head', [.03, 2.95, 0], [1.20, 1.13, 1.24], snow)
  for (const side of [-1, 1]) {
    const arm = ball('soft-arm', [.04, 1.12, side * 1.3], [.48, .93, .43], snow)
    arm.rotation.x = side * .3
    ball('glossy-eye', [1.10, 3.15, side * .43], [.12, .15, .12], black)
    ball('eye-highlight', [1.205, 3.21, side * .43 - .025], [.025, .037, .027], new THREE.MeshBasicMaterial({ color: 0xffffff }))
  }
  ball('orange-nose', [1.30, 2.98, 0], [.37, .24, .24], orange)
  const smile = []
  for (let i = 0; i <= 24; i++) {
    const z = -.64 + i / 24 * 1.28
    smile.push(new THREE.Vector3(1.07 - Math.abs(z) * .18, 2.48 + .4 * z * z, z))
  }
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smile), 32, .025, 6, false), black))
  ball('green-hat-crown', [-.13, 3.9, 0], [1.23, .83, 1.33], green)
  ball('hat-soft-tip', [-.42, 4.48, .10], [.48, .5, .48], green)
  const brim = new THREE.Mesh(new THREE.TorusGeometry(1.12, .25, 16, 64), green)
  brim.name = 'rolled-hat-brim'; brim.rotation.x = Math.PI / 2
  brim.position.set(0, 3.67, 0); brim.scale.set(1, 1.12, 1)
  root.add(brim)
  // Alternating knitted segments wrap the neck, including its back.
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2
    ball('striped-scarf-collar', [Math.cos(a) * .88, 2.05, Math.sin(a) * .88], [.26, .18, .26], i % 2 ? green : red)
  }
  for (let tail = 0; tail < 2; tail++) {
    for (let i = 0; i < 6; i++) {
      const y = 1.93 - i * .22
      const segment = ball('scarf-tail', [1.18 + Math.sin(i * .5) * .09, y, (tail ? .2 : -.19) + i * (tail ? .035 : -.015)], [.12, .18, tail ? .19 : .23], (i + tail) % 2 ? green : red)
      segment.rotation.x = tail ? -.2 : .12
    }
  }
  ball('scarf-knot', [1.13, 1.98, 0], [.23, .24, .28], red)
  root.scale.setScalar(length / 12.5)
  return root
}
