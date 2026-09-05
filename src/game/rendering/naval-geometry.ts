import * as THREE from 'three'

/** Shared deck edge: +X is the bow, Y is height, Z is beam. */
export function hullHalfWidth(u: number, beam: number): number {
  const stern = Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, u / 0.22), 2)))
  const bow = Math.pow(Math.sin(Math.min(1, (1 - u) / 0.36) * Math.PI / 2), 0.85)
  return beam * 0.5 * stern * bow
}

/** Raised forecastle and bow sheer shared by hull, deck, railings and weapon seats. */
export function bowSheer(u: number, height: number): number {
  const t = THREE.MathUtils.clamp((u - 0.60) / 0.28, 0, 1)
  return height * 0.14 * t * t * (3 - 2 * t)
}

export function navalHull(length: number, beam: number, bottom: number, top: number, lower = false): THREE.BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  const sections = 64
  for (let i = 0; i <= sections; i++) {
    const u = i / sections
    const half = hullHalfWidth(u, beam)
    const deckTop = lower || top <= 0 ? top : top + bowSheer(u, top / 0.44)
    const x = (u - 0.5) * length
    const ring = lower
      ? [[top, -half], [bottom * 0.6 + top * 0.4, -half * 0.72], [bottom, -half * 0.28], [bottom, half * 0.28], [bottom * 0.6 + top * 0.4, half * 0.72], [top, half]]
      : [[deckTop, -half], [bottom * 0.3 + top * 0.7, -half * 0.98], [bottom, -half * 0.91], [bottom, half * 0.91], [bottom * 0.3 + top * 0.7, half * 0.98], [deckTop, half]]
    for (const [y, z] of ring) vertices.push(x, y!, z!)
  }
  for (let i = 0; i < sections; i++) {
    for (let j = 0; j < 6; j++) {
      const a = i * 6 + j, b = i * 6 + (j + 1) % 6, c = a + 6, d = b + 6
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function navalDeck(length: number, beam: number, height = 0): THREE.BufferGeometry {
  const vertices: number[] = [], uv: number[] = [], indices: number[] = []
  for (let i = 0; i <= 64; i++) {
    const u = i / 64, x = (u - 0.5) * length, half = hullHalfWidth(u, beam)
    for (const side of [-1, 1]) {
      vertices.push(x, side * half, bowSheer(u, height))
      uv.push(x, side * half)
    }
    if (i < 64) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

/** Small repeatable timber texture, shared by every ship, including headless rendering. */
export function timberTexture(): THREE.DataTexture {
  const size = 256
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    const plank = Math.floor(y / 16)
    for (let x = 0; x < size; x++) {
      const seam = y % 16 === 0 || (x + (plank % 3) * 79) % 128 === 0
      const grain = Math.sin(x * 0.14 + Math.sin(y * 2.7) * 3) * 3
      const shade = seam ? -35 : grain + Math.sin(plank * 17) * 9
      const n = (y * size + x) * 4
      pixels[n] = 155 + shade; pixels[n + 1] = 132 + shade; pixels[n + 2] = 96 + shade; pixels[n + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.4, 2)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
