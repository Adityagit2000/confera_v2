import * as THREE from 'three'

// Given a base geometry, returns a modified position array
// representing a specific facial expression morph target
export function createMouthOpenMorph(
  baseGeo: THREE.BufferGeometry,
  amount: number = 1
): Float32Array {
  const pos = baseGeo.attributes.position
  const morphPos = new Float32Array(pos.array.length)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    // Only affect the lower face area (mouth region)
    const inMouthRegion = y > -0.65 && y < -0.25 && z > 0.3
    const lowerLipRegion = y > -0.65 && y < -0.45 && z > 0.4

    let dy = 0
    let dz = 0

    if (lowerLipRegion) {
      // Pull lower lip down and slightly forward
      const influence = (1 - Math.abs(x) / 0.3) * amount
      dy = -0.06 * Math.max(0, influence)
      dz = 0.02 * Math.max(0, influence)
    } else if (inMouthRegion) {
      // Subtle jaw drop
      dy = -0.02 * amount
    }

    morphPos[i * 3] = x
    morphPos[i * 3 + 1] = y + dy
    morphPos[i * 3 + 2] = z + dz
  }

  return morphPos
}

export function createSmileMorph(
  baseGeo: THREE.BufferGeometry,
  amount: number = 1
): Float32Array {
  const pos = baseGeo.attributes.position
  const morphPos = new Float32Array(pos.array.length)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    const inMouthCorner = Math.abs(x) > 0.2 && Math.abs(x) < 0.4 &&
      y > -0.55 && y < -0.3 && z > 0.35

    let dx = 0
    let dy = 0

    if (inMouthCorner) {
      const influence = (1 - Math.abs(Math.abs(x) - 0.3) / 0.1) * amount
      dx = Math.sign(x) * 0.04 * Math.max(0, influence)
      dy = 0.03 * Math.max(0, influence)
    }

    morphPos[i * 3] = x + dx
    morphPos[i * 3 + 1] = y + dy
    morphPos[i * 3 + 2] = z
  }

  return morphPos
}

export function createBrowRaiseMorph(
  baseGeo: THREE.BufferGeometry,
  amount: number = 1
): Float32Array {
  const pos = baseGeo.attributes.position
  const morphPos = new Float32Array(pos.array.length)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    const inBrowRegion = y > 0.18 && y < 0.42 &&
      Math.abs(x) > 0.1 && Math.abs(x) < 0.45 && z > 0.6

    let dy = 0

    if (inBrowRegion) {
      const xFactor = 1 - Math.abs(Math.abs(x) - 0.27) / 0.18
      const yFactor = 1 - Math.abs(y - 0.3) / 0.12
      dy = 0.06 * Math.max(0, xFactor) * Math.max(0, yFactor) * amount
    }

    morphPos[i * 3] = x
    morphPos[i * 3 + 1] = y + dy
    morphPos[i * 3 + 2] = z
  }

  return morphPos
}
