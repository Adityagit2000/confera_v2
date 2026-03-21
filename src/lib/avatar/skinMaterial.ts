import * as THREE from 'three'

export function createSkinMaterial(): THREE.MeshStandardMaterial {
  // PBR skin material approximating subsurface scattering
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d4956a'),
    roughness: 0.75,
    metalness: 0.0,
    // Approximate SSS with emissive warmth
    emissive: new THREE.Color('#3a1505'),
    emissiveIntensity: 0.08,
  })
}

export function createDarkerSkinMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c07840'),
    roughness: 0.78,
    metalness: 0.0,
    emissive: new THREE.Color('#2a0e02'),
    emissiveIntensity: 0.06,
  })
}

export function createHairMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1208'),
    roughness: 0.9,
    metalness: 0.0,
  })
}

export function createEyeWhiteMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f0ede8'),
    roughness: 0.3,
    metalness: 0.0,
  })
}

export function createIrisMaterial(color: string = '#3b5bdb'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.1,
    metalness: 0.05,
  })
}

export function createPupilMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#050505'),
    roughness: 0.05,
    metalness: 0.1,
  })
}

export function createLipMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b06050'),
    roughness: 0.55,
    metalness: 0.0,
    emissive: new THREE.Color('#200a08'),
    emissiveIntensity: 0.1,
  })
}

export function createSuitMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a2035'),
    roughness: 0.85,
    metalness: 0.05,
  })
}

export function createShirtMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f0f0f0'),
    roughness: 0.7,
    metalness: 0.0,
  })
}

export function createTieMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d3a6e'),
    roughness: 0.6,
    metalness: 0.05,
  })
}
