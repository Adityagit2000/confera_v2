import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createHeadGeometry, createEarGeometry } from '@/lib/avatar/headGeometry'
import {
  createSkinMaterial,
  createDarkerSkinMaterial,
  createHairMaterial,
  createEyeWhiteMaterial,
  createIrisMaterial,
  createPupilMaterial,
  createLipMaterial,
  createSuitMaterial,
  createShirtMaterial,
  createTieMaterial,
} from '@/lib/avatar/skinMaterial'

interface Props {
  isSpeaking: boolean
  isListening: boolean
  isThinking: boolean
  mouthOpenAmount: number // 0-1, driven by lip sync
}

export function AvatarHead({
  isSpeaking,
  isListening,
  isThinking,
  mouthOpenAmount,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const headMeshRef = useRef<THREE.Mesh>(null)
  const jawRef = useRef<THREE.Mesh>(null)
  const leftEyeLidRef = useRef<THREE.Mesh>(null)
  const rightEyeLidRef = useRef<THREE.Mesh>(null)
  const leftBrowRef = useRef<THREE.Mesh>(null)
  const rightBrowRef = useRef<THREE.Mesh>(null)
  const leftEyeRef = useRef<THREE.Group>(null)
  const rightEyeRef = useRef<THREE.Group>(null)

  // Animation state refs
  const blinkTimerRef = useRef(Math.random() * 3 + 2)
  const blinkProgressRef = useRef(0)
  const isBlinkingRef = useRef(false)
  const nodProgressRef = useRef(0)
  const nodActiveRef = useRef(false)
  const gazeXRef = useRef(0)
  const gazeYRef = useRef(0)
  const gazeTargetXRef = useRef(0)
  const gazeTargetYRef = useRef(0)
  const gazeTimerRef = useRef(0)
  const timeRef = useRef(0)

  // Materials
  const skinMat = useMemo(() => createSkinMaterial(), [])
  const darkSkinMat = useMemo(() => createDarkerSkinMaterial(), [])
  const hairMat = useMemo(() => createHairMaterial(), [])
  const eyeWhiteMat = useMemo(() => createEyeWhiteMaterial(), [])
  const irisMat = useMemo(() => createIrisMaterial('#2d4fa0'), [])
  const pupilMat = useMemo(() => createPupilMaterial(), [])
  const lipMat = useMemo(() => createLipMaterial(), [])
  const suitMat = useMemo(() => createSuitMaterial(), [])
  const shirtMat = useMemo(() => createShirtMaterial(), [])
  const tieMat = useMemo(() => createTieMaterial(), [])

  // Head geometry
  const headGeo = useMemo(() => createHeadGeometry(), [])
  const earGeo = useMemo(() => createEarGeometry(), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta

    const t = timeRef.current
    const lerp = (a: number, b: number, f: number) => a + (b - a) * f

    // ── Gaze system ──
    gazeTimerRef.current -= delta
    if (gazeTimerRef.current <= 0) {
      gazeTargetXRef.current = (Math.random() - 0.5) * 0.06
      gazeTargetYRef.current = (Math.random() - 0.5) * 0.04
      gazeTimerRef.current = 1.5 + Math.random() * 2.5
    }
    gazeXRef.current = lerp(gazeXRef.current, gazeTargetXRef.current, delta * 4)
    gazeYRef.current = lerp(gazeYRef.current, gazeTargetYRef.current, delta * 4)

    if (leftEyeRef.current) {
      leftEyeRef.current.rotation.y = gazeXRef.current
      leftEyeRef.current.rotation.x = gazeYRef.current
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.rotation.y = gazeXRef.current
      rightEyeRef.current.rotation.x = gazeYRef.current
    }

    // ── Blink system ──
    blinkTimerRef.current -= delta
    if (blinkTimerRef.current <= 0 && !isBlinkingRef.current) {
      isBlinkingRef.current = true
      blinkProgressRef.current = 0
      blinkTimerRef.current = 2.5 + Math.random() * 3
    }
    if (isBlinkingRef.current) {
      blinkProgressRef.current += delta * 12
      const blinkVal = Math.sin(
        Math.min(blinkProgressRef.current, Math.PI)
      )
      const lidScale = blinkVal

      if (leftEyeLidRef.current) {
        leftEyeLidRef.current.scale.y = 0.1 + lidScale * 0.9
        leftEyeLidRef.current.position.y =
          -0.005 + lidScale * 0.025
      }
      if (rightEyeLidRef.current) {
        rightEyeLidRef.current.scale.y = 0.1 + lidScale * 0.9
        rightEyeLidRef.current.position.y =
          -0.005 + lidScale * 0.025
      }

      if (blinkProgressRef.current >= Math.PI) {
        isBlinkingRef.current = false
        if (leftEyeLidRef.current) {
          leftEyeLidRef.current.scale.y = 0.1
        }
        if (rightEyeLidRef.current) {
          rightEyeLidRef.current.scale.y = 0.1
        }
      }
    }

    // ── Jaw / mouth open ──
    if (jawRef.current) {
      const targetJaw = mouthOpenAmount * -0.18
      jawRef.current.rotation.x = lerp(
        jawRef.current.rotation.x,
        targetJaw,
        delta * 18
      )
    }

    // ── Brow expressions ──
    const browTarget = isThinking ? 0.045
      : isListening ? 0.03
      : isSpeaking ? 0.015
      : 0

    if (leftBrowRef.current) {
      leftBrowRef.current.position.y = lerp(
        leftBrowRef.current.position.y,
        0.72 + browTarget,
        delta * 4
      )
    }
    if (rightBrowRef.current) {
      rightBrowRef.current.position.y = lerp(
        rightBrowRef.current.position.y,
        0.72 + browTarget,
        delta * 4
      )
    }

    // ── Head movement ──
    if (groupRef.current) {
      if (isSpeaking) {
        groupRef.current.rotation.x =
          Math.sin(t * 1.4) * 0.025
        groupRef.current.rotation.z =
          Math.sin(t * 0.9) * 0.015
        groupRef.current.rotation.y =
          Math.sin(t * 0.6) * 0.02
      } else if (isListening) {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, -0.04, delta * 2
        )
        groupRef.current.rotation.z =
          Math.sin(t * 0.5) * 0.018
        // Occasional listening nod
        if (!nodActiveRef.current && Math.random() < 0.004) {
          nodActiveRef.current = true
          nodProgressRef.current = 0
        }
      } else if (isThinking) {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, 0.04, delta * 2
        )
        groupRef.current.rotation.z = lerp(
          groupRef.current.rotation.z, -0.06, delta * 2
        )
      } else {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, 0, delta * 3
        )
        groupRef.current.rotation.z = lerp(
          groupRef.current.rotation.z, 0, delta * 3
        )
        groupRef.current.rotation.y =
          Math.sin(t * 0.25) * 0.015
      }

      // Nod animation
      if (nodActiveRef.current) {
        nodProgressRef.current += delta * 4
        const nodY =
          Math.sin(nodProgressRef.current * Math.PI) * 0.06
        groupRef.current.rotation.x += nodY
        if (nodProgressRef.current >= 1) {
          nodActiveRef.current = false
        }
      }

      // Subtle idle breathing bob
      groupRef.current.position.y =
        Math.sin(t * 0.8) * 0.008
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>

      {/* ── BODY / SUIT ── */}
      <mesh position={[0, -2.1, -0.1]} material={suitMat} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 1.8, 32]} />
      </mesh>

      {/* Shirt collar */}
      <mesh position={[0, -1.28, 0.3]} material={shirtMat} castShadow>
        <boxGeometry args={[0.32, 0.28, 0.08]} />
      </mesh>

      {/* Tie */}
      <mesh position={[0, -1.55, 0.35]} material={tieMat} castShadow>
        <boxGeometry args={[0.1, 0.5, 0.04]} />
      </mesh>

      {/* ── NECK ── */}
      <mesh position={[0, -1.1, 0]} material={skinMat} castShadow>
        <cylinderGeometry args={[0.19, 0.22, 0.38, 32]} />
      </mesh>

      {/* ── HEAD ── */}
      <mesh
        ref={headMeshRef}
        geometry={headGeo}
        material={skinMat}
        castShadow
        receiveShadow
      />

      {/* ── EARS ── */}
      <mesh
        geometry={earGeo}
        material={darkSkinMat}
        position={[-1.02, -0.05, 0]}
        castShadow
      />
      <mesh
        geometry={earGeo}
        material={darkSkinMat}
        position={[1.02, -0.05, 0]}
        castShadow
      />

      {/* ── HAIR CAP ── */}
      <mesh position={[0, 0.28, -0.08]} material={hairMat} castShadow>
        <sphereGeometry args={[1.01, 32, 32, 0, Math.PI * 2, 0, 1.2]} />
      </mesh>

      {/* Side hair left */}
      <mesh position={[-0.82, 0.0, 0.1]} material={hairMat} castShadow>
        <sphereGeometry args={[0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* Side hair right */}
      <mesh position={[0.82, 0.0, 0.1]} material={hairMat} castShadow>
        <sphereGeometry args={[0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* ── LEFT EYE ASSEMBLY ── */}
      <group position={[-0.31, 0.18, 0.86]}>
        {/* Eye white */}
        <mesh material={eyeWhiteMat} castShadow>
          <sphereGeometry args={[0.138, 24, 24]} />
        </mesh>
        {/* Iris + pupil group (rotates for gaze) */}
        <group ref={leftEyeRef}>
          <mesh position={[0, 0, 0.1]} material={irisMat}>
            <circleGeometry args={[0.08, 32]} />
          </mesh>
          <mesh position={[0, 0, 0.101]} material={pupilMat}>
            <circleGeometry args={[0.042, 32]} />
          </mesh>
          {/* Eye shine */}
          <mesh position={[0.025, 0.028, 0.102]}>
            <circleGeometry args={[0.016, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        {/* Upper eyelid */}
        <mesh
          ref={leftEyeLidRef}
          position={[0, 0.025, 0.122]}
          material={darkSkinMat}
        >
          <capsuleGeometry args={[0.072, 0.14, 4, 12]} />
        </mesh>
      </group>

      {/* ── RIGHT EYE ASSEMBLY ── */}
      <group position={[0.31, 0.18, 0.86]}>
        <mesh material={eyeWhiteMat} castShadow>
          <sphereGeometry args={[0.138, 24, 24]} />
        </mesh>
        <group ref={rightEyeRef}>
          <mesh position={[0, 0, 0.1]} material={irisMat}>
            <circleGeometry args={[0.08, 32]} />
          </mesh>
          <mesh position={[0, 0, 0.101]} material={pupilMat}>
            <circleGeometry args={[0.042, 32]} />
          </mesh>
          <mesh position={[0.025, 0.028, 0.102]}>
            <circleGeometry args={[0.016, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        <mesh
          ref={rightEyeLidRef}
          position={[0, 0.025, 0.122]}
          material={darkSkinMat}
        >
          <capsuleGeometry args={[0.072, 0.14, 4, 12]} />
        </mesh>
      </group>

      {/* ── EYEBROWS ── */}
      <mesh
        ref={leftBrowRef}
        position={[-0.31, 0.72, 0.86]}
        rotation={[0, 0, 0.12]}
        material={hairMat}
      >
        <capsuleGeometry args={[0.022, 0.2, 4, 8]} />
      </mesh>
      <mesh
        ref={rightBrowRef}
        position={[0.31, 0.72, 0.86]}
        rotation={[0, 0, -0.12]}
        material={hairMat}
      >
        <capsuleGeometry args={[0.022, 0.2, 4, 8]} />
      </mesh>

      {/* ── NOSE ── */}
      {/* Nose bridge */}
      <mesh position={[0, 0.08, 0.9]} material={darkSkinMat}>
        <capsuleGeometry args={[0.028, 0.22, 4, 8]} />
      </mesh>
      {/* Nose tip */}
      <mesh position={[0, -0.16, 0.98]} material={darkSkinMat}>
        <sphereGeometry args={[0.065, 16, 16]} />
      </mesh>
      {/* Nostrils */}
      <mesh position={[-0.075, -0.2, 0.92]} material={darkSkinMat}>
        <sphereGeometry args={[0.038, 12, 12]} />
      </mesh>
      <mesh position={[0.075, -0.2, 0.92]} material={darkSkinMat}>
        <sphereGeometry args={[0.038, 12, 12]} />
      </mesh>

      {/* ── JAW / MOUTH GROUP ── */}
      <group ref={jawRef} position={[0, -0.38, 0]}>
        {/* Lower face / jaw */}
        <mesh position={[0, 0, 0]} material={skinMat}>
          <sphereGeometry args={[0.58, 32, 16, 0, Math.PI * 2, 1.8, 1.4]} />
        </mesh>

        {/* Upper lip */}
        <mesh position={[0, 0.36, 0.87]} material={lipMat}>
          <capsuleGeometry args={[0.028, 0.32, 4, 12]} />
        </mesh>
        {/* Cupid's bow left */}
        <mesh
          position={[-0.1, 0.38, 0.87]}
          rotation={[0, 0, 0.4]}
          material={lipMat}
        >
          <capsuleGeometry args={[0.022, 0.1, 4, 8]} />
        </mesh>
        {/* Cupid's bow right */}
        <mesh
          position={[0.1, 0.38, 0.87]}
          rotation={[0, 0, -0.4]}
          material={lipMat}
        >
          <capsuleGeometry args={[0.022, 0.1, 4, 8]} />
        </mesh>

        {/* Lower lip */}
        <mesh position={[0, 0.24, 0.88]} material={lipMat}>
          <capsuleGeometry args={[0.034, 0.28, 4, 12]} />
        </mesh>

        {/* Mouth corners */}
        <mesh position={[-0.19, 0.3, 0.85]} material={lipMat}>
          <sphereGeometry args={[0.026, 8, 8]} />
        </mesh>
        <mesh position={[0.19, 0.3, 0.85]} material={lipMat}>
          <sphereGeometry args={[0.026, 8, 8]} />
        </mesh>

        {/* Teeth (visible when mouth opens) */}
        <mesh position={[0, 0.3, 0.82]} material={eyeWhiteMat}>
          <boxGeometry args={[0.28, 0.04, 0.04]} />
        </mesh>
      </group>

    </group>
  )
}
