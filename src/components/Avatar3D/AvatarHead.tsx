/// <reference types="@react-three/fiber" />
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  isSpeaking: boolean
  isListening: boolean
  isThinking: boolean
  mouthOpenAmount: number
}

export function AvatarHead({
  isSpeaking,
  isListening,
  isThinking,
  mouthOpenAmount,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const jawRef = useRef<THREE.Group>(null)
  const leftLidRef = useRef<THREE.Mesh>(null)
  const rightLidRef = useRef<THREE.Mesh>(null)
  const leftBrowRef = useRef<THREE.Mesh>(null)
  const rightBrowRef = useRef<THREE.Mesh>(null)
  const leftEyeBallRef = useRef<THREE.Group>(null)
  const rightEyeBallRef = useRef<THREE.Group>(null)

  // Animation state
  const blinkTimerRef = useRef(2 + Math.random() * 2)
  const blinkValRef = useRef(0)
  const isBlinkingRef = useRef(false)
  const gazeXRef = useRef(0)
  const gazeYRef = useRef(0)
  const gazeTargetXRef = useRef(0)
  const gazeTargetYRef = useRef(0)
  const gazeTimerRef = useRef(0)
  const nodRef = useRef(0)
  const nodActiveRef = useRef(false)
  const timeRef = useRef(0)

  // ── Materials ──
  // Skin: Using MeshPhysicalMaterial for subsurface scattering approximation
  const skinMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#e8b99b', // More natural skin tone
    roughness: 0.45,
    metalness: 0.05,
    reflectivity: 0.5,
    clearcoat: 0.1,
    clearcoatRoughness: 0.2,
    sheen: 0.3,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#ffccaa'),
  }), [])

  const deepSkinMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#c4856a',
    roughness: 0.6,
    metalness: 0.0,
    sheen: 0.2,
    sheenColor: new THREE.Color('#993311'),
  }), [])

  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a1e16', // Dark brunette
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.FrontSide,
  }), [])

  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fcfaf7',
    roughness: 0.1,
    metalness: 0.0,
  }), [])

  const irisMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3d5c85', // Natural blueish-brown depth
    roughness: 0.3,
    metalness: 0.05,
  }), [])

  const pupilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#080808',
    roughness: 0.0,
    metalness: 0.0,
  }), [])

  const lipMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#b36d61',
    roughness: 0.4,
    metalness: 0.02,
    reflectivity: 0.6,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  }), [])

  const suitMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f172a', // Navy blue
    roughness: 0.95,
    metalness: 0.0,
  }), [])

  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.75,
  }), [])

  const tieMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7f1d1d', // Dark red
    roughness: 0.5,
    metalness: 0.05,
  }), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta
    const t = timeRef.current
    const lerp = (a: number, b: number, f: number) =>
      a + (b - a) * Math.min(f, 1)

    // ── Gaze ──
    gazeTimerRef.current -= delta
    if (gazeTimerRef.current <= 0) {
      gazeTargetXRef.current = (Math.random() - 0.5) * 0.04
      gazeTargetYRef.current = (Math.random() - 0.5) * 0.025
      gazeTimerRef.current = 2.0 + Math.random() * 2.5
    }
    gazeXRef.current = lerp(gazeXRef.current, gazeTargetXRef.current, delta * 4)
    gazeYRef.current = lerp(gazeYRef.current, gazeTargetYRef.current, delta * 4)
    if (leftEyeBallRef.current) {
      leftEyeBallRef.current.rotation.y = gazeXRef.current * 14
      leftEyeBallRef.current.rotation.x = gazeYRef.current * 14
    }
    if (rightEyeBallRef.current) {
      rightEyeBallRef.current.rotation.y = gazeXRef.current * 14
      rightEyeBallRef.current.rotation.x = gazeYRef.current * 14
    }

    // ── Blink ──
    blinkTimerRef.current -= delta
    if (blinkTimerRef.current <= 0 && !isBlinkingRef.current) {
      isBlinkingRef.current = true
      blinkValRef.current = 0
      blinkTimerRef.current = 3.0 + Math.random() * 3
    }
    if (isBlinkingRef.current) {
      blinkValRef.current += delta * 15
      const bv = Math.sin(Math.min(blinkValRef.current, Math.PI))
      const lidY = 0.015 + bv * 0.04
      if (leftLidRef.current) leftLidRef.current.position.y = lidY
      if (rightLidRef.current) rightLidRef.current.position.y = lidY
      if (blinkValRef.current >= Math.PI) {
        isBlinkingRef.current = false
        if (leftLidRef.current) leftLidRef.current.position.y = 0.015
        if (rightLidRef.current) rightLidRef.current.position.y = 0.015
      }
    }

    // ── Jaw open ──
    if (jawRef.current) {
      const target = -mouthOpenAmount * 0.16
      jawRef.current.rotation.x = lerp(
        jawRef.current.rotation.x, target, delta * 25
      )
    }

    // ── Brows ──
    const browTarget = isThinking ? 0.04
      : isListening ? 0.025 : isSpeaking ? 0.015 : 0
    if (leftBrowRef.current) {
      leftBrowRef.current.position.y = lerp(
        leftBrowRef.current.position.y,
        0.36 + browTarget, delta * 5
      )
    }
    if (rightBrowRef.current) {
      rightBrowRef.current.position.y = lerp(
        rightBrowRef.current.position.y,
        0.36 + browTarget, delta * 5
      )
    }

    // ── Head movement ──
    if (groupRef.current) {
      if (isSpeaking) {
        groupRef.current.rotation.x = Math.sin(t * 1.5) * 0.025
        groupRef.current.rotation.z = Math.sin(t * 1.0) * 0.015
        groupRef.current.rotation.y = Math.sin(t * 0.6) * 0.02
      } else if (isListening) {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, -0.04, delta * 2.5
        )
        groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.015
        if (!nodActiveRef.current && Math.random() < 0.004) {
          nodActiveRef.current = true
          nodRef.current = 0
        }
      } else if (isThinking) {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, 0.04, delta * 2.5
        )
        groupRef.current.rotation.z = lerp(
          groupRef.current.rotation.z, -0.06, delta * 2.5
        )
      } else {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, 0, delta * 2.5
        )
        groupRef.current.rotation.z = lerp(
          groupRef.current.rotation.z, 0, delta * 2.5
        )
        groupRef.current.rotation.y =
          Math.sin(t * 0.25) * 0.015
      }

      if (nodActiveRef.current) {
        nodRef.current += delta * 4.8
        groupRef.current.rotation.x +=
          Math.sin(nodRef.current * Math.PI) * 0.06
        if (nodRef.current >= 1) nodActiveRef.current = false
      }

      groupRef.current.position.y =
        Math.sin(t * 0.8) * 0.008
    }
  })

  return (
    <group ref={groupRef}>

      {/* ── BODY ── */}
      {/* Torso / Suit Jacket */}
      <mesh position={[0, -2.25, -0.1]} material={suitMat} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 1.8, 64]} />
      </mesh>
      
      {/* Shoulders - more defined, less round */}
      <group position={[0, -1.4, -0.1]}>
        <mesh position={[-0.65, -0.15, 0]} material={suitMat} castShadow>
          <sphereGeometry args={[0.42, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
        </mesh>
        <mesh position={[0.65, -0.15, 0]} material={suitMat} castShadow>
          <sphereGeometry args={[0.42, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
        </mesh>
      </group>

      {/* Shirt + Collar + Tie */}
      <group position={[0, -1.35, 0.38]}>
        {/* Shirt front */}
        <mesh position={[0, -0.45, 0.12]} material={shirtMat}>
          <boxGeometry args={[0.35, 0.8, 0.06]} />
        </mesh>
        
        {/* Collar L */}
        <mesh position={[-0.17, 0.08, 0.1]} rotation={[0.45, 0.25, 0.65]} material={shirtMat}>
          <boxGeometry args={[0.2, 0.09, 0.05]} />
        </mesh>
        {/* Collar R */}
        <mesh position={[0.17, 0.08, 0.1]} rotation={[0.45, -0.25, -0.65]} material={shirtMat}>
          <boxGeometry args={[0.2, 0.09, 0.05]} />
        </mesh>

        {/* Lapel L */}
        <mesh position={[-0.35, -0.3, 0.18]} rotation={[0.25, 0.35, 0.5]} material={suitMat}>
          <boxGeometry args={[0.25, 0.6, 0.07]} />
        </mesh>
        {/* Lapel R */}
        <mesh position={[0.35, -0.3, 0.18]} rotation={[0.25, -0.35, -0.5]} material={suitMat}>
          <boxGeometry args={[0.25, 0.6, 0.07]} />
        </mesh>

        {/* Tie */}
        <mesh position={[0, -0.45, 0.16]} material={tieMat}>
          <boxGeometry args={[0.12, 0.65, 0.04]} />
        </mesh>
        {/* Tie knot */}
        <mesh position={[0, -0.12, 0.18]} material={tieMat}>
          <boxGeometry args={[0.14, 0.11, 0.07]} />
        </mesh>
      </group>

      {/* ── NECK ── */}
      <mesh position={[0, -1.1, 0.05]} material={skinMat} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.4, 32]} />
      </mesh>

      {/* ── HEAD — Refined Anatomical Structure ── */}
      <group>
        {/* Skull Back/Top */}
        <mesh position={[0, 0.3, -0.1]} material={skinMat} castShadow receiveShadow>
          <sphereGeometry args={[0.92, 64, 64]} />
        </mesh>
        
        {/* Forehead - flatter, more human */}
        <mesh position={[0, 0.45, 0.25]} material={skinMat}>
          <sphereGeometry args={[0.85, 48, 48, 0, Math.PI * 2, 0, 1.2]} />
        </mesh>

        {/* Cheekbones - more lateral and defined */}
        <mesh position={[-0.52, 0.08, 0.48]} material={skinMat}>
          <sphereGeometry args={[0.45, 32, 32]} />
        </mesh>
        <mesh position={[0.52, 0.08, 0.48]} material={skinMat}>
          <sphereGeometry args={[0.45, 32, 32]} />
        </mesh>

        {/* Cheek flesh - lower */}
        <mesh position={[-0.45, -0.15, 0.55]} material={skinMat}>
          <sphereGeometry args={[0.42, 32, 32]} />
        </mesh>
        <mesh position={[0.45, -0.15, 0.55]} material={skinMat}>
          <sphereGeometry args={[0.42, 32, 32]} />
        </mesh>

        {/* Middle face bridge */}
        <mesh position={[0, 0.05, 0.3]} material={skinMat}>
          <sphereGeometry args={[0.9, 64, 64]} />
        </mesh>
      </group>

      {/* ── EARS — Improved shell shape ── */}
      <group position={[-1.0, 0.0, 0.0]}>
        <mesh rotation={[0, -0.3, 0]} material={deepSkinMat} castShadow>
          <sphereGeometry args={[0.2, 24, 24, 0, Math.PI, 0, Math.PI]} />
        </mesh>
        <mesh position={[0.05, 0, 0.05]} rotation={[0, -0.3, 0]} material={skinMat}>
          <sphereGeometry args={[0.12, 16, 16]} />
        </mesh>
      </group>
      <group position={[1.0, 0.0, 0.0]}>
        <mesh rotation={[0, 0.3, 0]} material={deepSkinMat} castShadow>
          <sphereGeometry args={[0.2, 24, 24, 0, Math.PI, 0, Math.PI]} />
        </mesh>
        <mesh position={[-0.05, 0, 0.05]} rotation={[0, 0.3, 0]} material={skinMat}>
          <sphereGeometry args={[0.12, 16, 16]} />
        </mesh>
      </group>

      {/* ── HAIR — Higher fidelity pompadour ── */}
      <group position={[0, 0.38, -0.05]}>
        {/* Base layer */}
        <mesh position={[0, 0.2, 0]} material={hairMat} castShadow>
          <sphereGeometry args={[0.95, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        </mesh>
        
        {/* Sideburn L */}
        <mesh position={[-0.9, -0.35, 0.2]} rotation={[0, 0.2, 0.1]} material={hairMat}>
          <boxGeometry args={[0.07, 0.45, 0.12]} />
        </mesh>
        {/* Sideburn R */}
        <mesh position={[0.9, -0.35, 0.2]} rotation={[0, -0.2, -0.1]} material={hairMat}>
          <boxGeometry args={[0.07, 0.45, 0.12]} />
        </mesh>

        {/* Pompadour sweep - multiple layered capsules/spheres */}
        <mesh position={[0, 0.65, 0.55]} rotation={[-0.35, 0, 0]} material={hairMat}>
          <sphereGeometry args={[0.55, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        </mesh>
        
        {/* Hair detail strands */}
        {[-0.4, -0.2, 0, 0.2, 0.4].map((off, i) => (
          <mesh key={i} position={[off, 0.72 - Math.abs(off) * 0.1, 0.4]} rotation={[-0.5, off * 0.6, 0]} material={hairMat}>
            <capsuleGeometry args={[0.09, 0.25, 4, 12]} />
          </mesh>
        ))}
        {/* Fringe/Front detail */}
        <mesh position={[0, 0.58, 0.88]} rotation={[-0.2, 0, 0]} material={hairMat}>
          <capsuleGeometry args={[0.3, 0.1, 8, 16]} />
        </mesh>
      </group>

      {/* ── LEFT EYE — Anatomical detail ── */}
      <group position={[-0.33, 0.2, 0.85]}>
        {/* Eye socket shadow */}
        <mesh position={[0, 0, -0.08]} material={deepSkinMat}>
          <sphereGeometry args={[0.18, 20, 20]} />
        </mesh>
        {/* Sclera (Eye white) */}
        <mesh material={eyeWhiteMat}>
          <sphereGeometry args={[0.145, 32, 32]} />
        </mesh>
        {/* Gaze Group (Iris + Pupil) */}
        <group ref={leftEyeBallRef}>
          {/* Iris */}
          <mesh position={[0, 0, 0.098]} material={irisMat}>
            <circleGeometry args={[0.08, 32]} />
          </mesh>
          {/* Pupil */}
          <mesh position={[0, 0, 0.101]} material={pupilMat}>
            <circleGeometry args={[0.038, 32]} />
          </mesh>
          {/* Specular Highlight */}
          <mesh position={[0.03, 0.035, 0.108]}>
            <circleGeometry args={[0.015, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        </group>
        {/* Lids - better fit */}
        <mesh ref={leftLidRef} position={[0, 0.13, 0.09]} rotation={[0.2, 0, 0]} material={skinMat}>
          <capsuleGeometry args={[0.09, 0.18, 8, 16]} />
        </mesh>
        {/* Lower lid detail */}
        <mesh position={[0, -0.11, 0.09]} rotation={[-0.1, 0, 0]} material={skinMat}>
          <capsuleGeometry args={[0.06, 0.18, 4, 12]} />
        </mesh>
      </group>

      {/* ── RIGHT EYE ── */}
      <group position={[0.33, 0.2, 0.85]}>
        <mesh position={[0, 0, -0.08]} material={deepSkinMat}>
          <sphereGeometry args={[0.18, 20, 20]} />
        </mesh>
        <mesh material={eyeWhiteMat}>
          <sphereGeometry args={[0.145, 32, 32]} />
        </mesh>
        <group ref={rightEyeBallRef}>
          <mesh position={[0, 0, 0.098]} material={irisMat}>
            <circleGeometry args={[0.08, 32]} />
          </mesh>
          <mesh position={[0, 0, 0.101]} material={pupilMat}>
            <circleGeometry args={[0.038, 32]} />
          </mesh>
          <mesh position={[0.03, 0.035, 0.108]}>
            <circleGeometry args={[0.015, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        </group>
        <mesh ref={rightLidRef} position={[0, 0.13, 0.09]} rotation={[0.2, 0, 0]} material={skinMat}>
          <capsuleGeometry args={[0.09, 0.18, 8, 16]} />
        </mesh>
        <mesh position={[0, -0.11, 0.09]} rotation={[-0.1, 0, 0]} material={skinMat}>
          <capsuleGeometry args={[0.06, 0.18, 4, 12]} />
        </mesh>
      </group>

      {/* ── EYEBROWS ── */}
      <mesh
        ref={leftBrowRef}
        position={[-0.32, 0.36, 0.92]}
        rotation={[0, 0.08, 0.12]}
        material={hairMat}
      >
        <capsuleGeometry args={[0.022, 0.2, 4, 8]} />
      </mesh>
      <mesh
        ref={rightBrowRef}
        position={[0.32, 0.36, 0.92]}
        rotation={[0, -0.08, -0.12]}
        material={hairMat}
      >
        <capsuleGeometry args={[0.022, 0.2, 4, 8]} />
      </mesh>

      {/* ── NOSE — Anatomically correct ── */}
      <group position={[0, -0.02, 0.95]}>
        {/* Bridge */}
        <mesh position={[0, 0.2, -0.05]} material={skinMat}>
          <capsuleGeometry args={[0.028, 0.18, 4, 12]} />
        </mesh>
        {/* Tip / Cartilage flare */}
        <mesh position={[0, -0.08, 0.08]} rotation={[0.4, 0, 0]} material={skinMat}>
          <capsuleGeometry args={[0.04, 0.15, 4, 12]} />
        </mesh>
        {/* Rounded tip */}
        <mesh position={[0, -0.14, 0.16]} material={skinMat}>
          <sphereGeometry args={[0.075, 32, 32]} />
        </mesh>
        {/* Nostril L */}
        <mesh position={[-0.085, -0.18, 0.09]} rotation={[0.2, 0.5, 0.2]} material={deepSkinMat}>
          <sphereGeometry args={[0.045, 16, 16]} />
        </mesh>
        {/* Nostril R */}
        <mesh position={[0.085, -0.18, 0.09]} rotation={[0.2, -0.5, -0.2]} material={deepSkinMat}>
          <sphereGeometry args={[0.045, 16, 16]} />
        </mesh>
      </group>

      {/* ── JAW + MOUTH ── */}
      <group ref={jawRef} position={[0, -0.25, 0.2]}>
        {/* Lower Jaw bone mass */}
        <mesh position={[0, -0.22, -0.05]} material={skinMat}>
          <sphereGeometry args={[0.7, 32, 32, 0, Math.PI * 2, 1.4, 1.4]} />
        </mesh>
        
        {/* Defined Chin */}
        <mesh position={[0, -0.48, 0.58]} material={skinMat}>
          <sphereGeometry args={[0.18, 24, 24]} />
        </mesh>

        {/* Mouth Group - correctly positioned over the jaw */}
        <group position={[0, 0.18, 0.75]}>
          {/* Upper Lip - more detailed cupid's bow */}
          <group position={[0, 0.14, 0.02]}>
            <mesh position={[-0.09, 0.025, 0]} rotation={[0, 0, 0.35]} material={lipMat}>
              <capsuleGeometry args={[0.025, 0.16, 4, 12]} />
            </mesh>
            <mesh position={[0.09, 0.025, 0]} rotation={[0, 0, -0.35]} material={lipMat}>
              <capsuleGeometry args={[0.025, 0.16, 4, 12]} />
            </mesh>
            {/* Center bow detail */}
            <mesh position={[0, 0.038, 0.01]} material={lipMat}>
              <sphereGeometry args={[0.032, 12, 12]} />
            </mesh>
          </group>
          
          {/* Lower Lip - fuller, realistic texture */}
          <mesh position={[0, -0.02, 0.04]} material={lipMat}>
            <capsuleGeometry args={[0.045, 0.26, 4, 12]} />
          </mesh>
          
          {/* Mouth corners / Depth */}
          <mesh position={[-0.2, 0.08, -0.03]} material={deepSkinMat}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>
          <mesh position={[0.2, 0.08, -0.03]} material={deepSkinMat}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>

          {/* Teeth / Mouth Interior */}
          <mesh position={[0, 0.08, -0.06]} material={eyeWhiteMat}>
            <boxGeometry args={[0.24, 0.05, 0.02]} />
          </mesh>
        </group>
      </group>

    </group>
  )
}
