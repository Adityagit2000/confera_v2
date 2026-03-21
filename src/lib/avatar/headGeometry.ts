import * as THREE from 'three'

export function createHeadGeometry(): THREE.BufferGeometry {
  // Start with a sphere and deform it into a human head shape
  const geo = new THREE.SphereGeometry(1, 64, 64)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    // Flatten the back of the head slightly
    const backFactor = z < 0 ? 1 - Math.abs(z) * 0.08 : 1
    // Narrow the top (crown)
    const topFactor = y > 0.6 ? 1 - (y - 0.6) * 0.25 : 1
    // Widen the cheekbones
    const cheekFactor = Math.abs(y + 0.1) < 0.3 ? 1 + 0.08 * (1 - Math.abs(y + 0.1) / 0.3) : 1
    // Narrow the chin
    const chinFactor = y < -0.5 ? 1 - (Math.abs(y) - 0.5) * 0.6 : 1
    // Push face forward
    const facePush = z > 0 ? 1 + z * 0.12 : 1

    pos.setXYZ(
      i,
      x * backFactor * topFactor * cheekFactor * chinFactor,
      y * backFactor * topFactor,
      z * facePush * backFactor
    )
  }

  geo.computeVertexNormals()
  return geo
}

export function createEyeSocketGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.155, 32, 32)
  return geo
}

export function createNoseGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-0.08, 0.05, -0.1, 0.15, -0.07, 0.22)
  shape.bezierCurveTo(-0.04, 0.28, 0.04, 0.28, 0.07, 0.22)
  shape.bezierCurveTo(0.1, 0.15, 0.08, 0.05, 0, 0)

  const extrudeSettings = {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 4,
  }
  return new THREE.ExtrudeGeometry(shape, extrudeSettings)
}

export function createEarGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 16, 16)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setXYZ(i, x * 0.18, y * 0.28, z * 0.12)
  }
  geo.computeVertexNormals()
  return geo
}
