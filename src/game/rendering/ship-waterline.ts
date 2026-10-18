import * as THREE from 'three'

/** Project attachment points with the exact model and camera matrices used to draw the hull. */
export function projectShipWaterline(model: THREE.Object3D, camera: THREE.Camera, width: number, height: number, longitudinal: number, lateral = 0): [number, number] {
  model.updateWorldMatrix(true, false)
  camera.updateWorldMatrix(true, false)
  const point = new THREE.Vector3(
    longitudinal * Number(model.userData['waterlineLength']),
    0,
    lateral * Number(model.userData['waterlineBeam']),
  ).applyMatrix4(model.matrixWorld).project(camera)
  return [(point.x + 1) * width / 2, (1 - point.y) * height / 2]
}
