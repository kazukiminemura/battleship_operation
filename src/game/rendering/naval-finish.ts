import * as THREE from 'three'

/** Deterministic, tileable painted-steel surface. No network textures required. */
export function navalFinishTexture(): THREE.DataTexture {
  const size = 256, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 64)
    const joint = (x + row % 2 * 64) % 128
    const seam = y % 64 < 1 || joint < 1
    const grain = ((Math.imul(x + 37, 374761393) ^ Math.imul(y + 19, 668265263)) >>> 0) % 11
    const streak = Math.pow((Math.sin(x * .19634954) + 1) / 2, 24) * (y % 64) / 64
    const shade = Math.round(230 + grain - (seam ? 19 : 0) - streak * 13)
    const i = (y * size + x) * 4
    data[i] = shade; data[i + 1] = shade; data[i + 2] = shade; data[i + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.5, 2)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true; texture.needsUpdate = true
  return texture
}
