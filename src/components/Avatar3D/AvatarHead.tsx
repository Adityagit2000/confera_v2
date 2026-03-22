/// <reference types="@react-three/fiber" />
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
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
  const headRef = useRef<THREE.Mesh>(null)
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
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#e8b88a',
    roughness: 0.65,
    metalness: 0.0,
    emissive: new THREE.Color('#200a02'),
    emissiveIntensity: 0.06,
  }), [])

  const deepSkinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d4966a',
    roughness: 0.7,
    metalness: 0.0,
  }), [])

  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f0c07',
    roughness: 0.85,
    metalness: 0.05,
  }), [])

  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f5f2ee',
    roughness: 0.2,
    metalness: 0.0,
  }), [])

  const irisMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a4a9e',
    roughness: 0.05,
    metalness: 0.1,
  }), [])

  const pupilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#030303',
    roughness: 0.0,
    metalness: 0.2,
  }), [])

  const lipMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#b86858',
    roughness: 0.5,
    metalness: 0.0,
  }), [])

  const suitMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.8,
    metalness: 0.05,
  }), [])

  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#e8e8e8',
    roughness: 0.65,
  }), [])

  const tieMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a3a6e',
    roughness: 0.55,
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
      gazeTimerRef.current = 1.8 + Math.random() * 2
    }
    gazeXRef.current = lerp(gazeXRef.current, gazeTargetXRef.current, delta * 5)
    gazeYRef.current = lerp(gazeYRef.current, gazeTargetYRef.current, delta * 5)
    if (leftEyeBallRef.current) {
      leftEyeBallRef.current.rotation.y = gazeXRef.current * 12
      leftEyeBallRef.current.rotation.x = gazeYRef.current * 12
    }
    if (rightEyeBallRef.current) {
      rightEyeBallRef.current.rotation.y = gazeXRef.current * 12
      rightEyeBallRef.current.rotation.x = gazeYRef.current * 12
    }

    // ── Blink ──
    blinkTimerRef.current -= delta
    if (blinkTimerRef.current <= 0 && !isBlinkingRef.current) {
      isBlinkingRef.current = true
      blinkValRef.current = 0
      blinkTimerRef.current = 2.5 + Math.random() * 3
    }
    if (isBlinkingRef.current) {
      blinkValRef.current += delta * 14
      const bv = Math.sin(Math.min(blinkValRef.current, Math.PI))
      const lidY = 0.01 + bv * 0.035
      if (leftLidRef.current) leftLidRef.current.position.y = lidY
      if (rightLidRef.current) rightLidRef.current.position.y = lidY
      if (blinkValRef.current >= Math.PI) {
        isBlinkingRef.current = false
        if (leftLidRef.current) leftLidRef.current.position.y = 0.01
        if (rightLidRef.current) rightLidRef.current.position.y = 0.01
      }
    }

    // ── Jaw open ──
    if (jawRef.current) {
      const target = -mouthOpenAmount * 0.14
      jawRef.current.rotation.x = lerp(
        jawRef.current.rotation.x, target, delta * 20
      )
    }

    // ── Brows ──
    const browTarget = isThinking ? 0.035
      : isListening ? 0.022 : isSpeaking ? 0.012 : 0
    if (leftBrowRef.current) {
      leftBrowRef.current.position.y = lerp(
        leftBrowRef.current.position.y,
        0.355 + browTarget, delta * 4
      )
    }
    if (rightBrowRef.current) {
      rightBrowRef.current.position.y = lerp(
        rightBrowRef.current.position.y,
        0.355 + browTarget, delta * 4
      )
    }

    // ── Head movement ──
    if (groupRef.current) {
      if (isSpeaking) {
        groupRef.current.rotation.x = Math.sin(t * 1.3) * 0.022
        groupRef.current.rotation.z = Math.sin(t * 0.85) * 0.012
        groupRef.current.rotation.y = Math.sin(t * 0.55) * 0.018
      } else if (isListening) {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, -0.035, delta * 2
        )
        groupRef.current.rotation.z = Math.sin(t * 0.45) * 0.015
        if (!nodActiveRef.current && Math.random() < 0.003) {
          nodActiveRef.current = true
          nodRef.current = 0
        }
      } else if (isThinking) {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, 0.035, delta * 2
        )
        groupRef.current.rotation.z = lerp(
          groupRef.current.rotation.z, -0.055, delta * 2
        )
      } else {
        groupRef.current.rotation.x = lerp(
          groupRef.current.rotation.x, 0, delta * 2
        )
        groupRef.current.rotation.z = lerp(
          groupRef.current.rotation.z, 0, delta * 2
        )
        groupRef.current.rotation.y =
          Math.sin(t * 0.22) * 0.012
      }

      if (nodActiveRef.current) {
        nodRef.current += delta * 4.5
        groupRef.current.rotation.x +=
          Math.sin(nodRef.current * Math.PI) * 0.05
        if (nodRef.current >= 1) nodActiveRef.current = false
      }

      groupRef.current.position.y =
        Math.sin(t * 0.75) * 0.007
    }
  })

  return (
    <group ref={groupRef}>

      {/* ── BODY ── */}
      {/* Torso / suit */}
      <mesh position={[0, -2.05, -0.05]} material={suitMat} castShadow>
        <cylinderGeometry args={[0.62, 0.82, 1.6, 48, 1, false]} />
      </mesh>
      {/* Shoulders rounded */}
      <mesh position={[-0.58, -1.5, 0]} material={suitMat} castShadow>
        <sphereGeometry args={[0.32, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0.58, -1.5, 0]} material={suitMat} castShadow>
        <sphereGeometry args={[0.32, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Shirt front */}
      <mesh position={[0, -1.72, 0.46]} material={shirtMat}>
        <boxGeometry args={[0.26, 0.52, 0.06]} />
      </mesh>
      {/* Tie */}
      <mesh position={[0, -1.88, 0.5]} material={tieMat}>
        <boxGeometry args={[0.09, 0.44, 0.04]} />
      </mesh>
      {/* Tie knot */}
      <mesh position={[0, -1.62, 0.5]} material={tieMat}>
        <boxGeometry args={[0.11, 0.09, 0.05]} />
      </mesh>

      {/* ── NECK ── */}
      <mesh position={[0, -1.06, 0.02]} material={skinMat} castShadow>
        <cylinderGeometry args={[0.165, 0.19, 0.34, 32]} />
      </mesh>

      {/* ── HEAD — smooth ellipsoid ── */}
      <mesh ref={headRef} material={skinMat} castShadow receiveShadow>
        {/* Wide at cheeks, narrower at crown and chin */}
        <sphereGeometry args={[1, 96, 96]} />
      </mesh>
      {/* Cheekbone width addition */}
      <mesh position={[0, -0.08, 0]} material={skinMat}>
        <sphereGeometry args={[0.98, 32, 32]} />
      </mesh>

      {/* ── EARS ── */}
      <mesh position={[-0.96, -0.04, 0.0]} material={deepSkinMat} castShadow>
        <sphereGeometry args={[0.155, 20, 20]} />
      </mesh>
      <mesh position={[0.96, -0.04, 0.0]} material={deepSkinMat} castShadow>
        <sphereGeometry args={[0.155, 20, 20]} />
      </mesh>
      {/* Inner ear */}
      <mesh position={[-0.995, -0.04, 0.02]} material={skinMat}>
        <sphereGeometry args={[0.088, 12, 12]} />
      </mesh>
      <mesh position={[0.995, -0.04, 0.02]} material={skinMat}>
        <sphereGeometry args={[0.088, 12, 12]} />
      </mesh>

      {/* ── HAIR — smooth fitted cap ── */}
      {/* Main cap */}
      <mesh position={[0, 0.22, -0.06]} material={hairMat} castShadow>
        <sphereGeometry args={[1.025, 48, 48, 0, Math.PI * 2, 0, 1.15]} />
      </mesh>
      {/* Side coverage left */}
      <mesh
        position={[-0.78, 0.05, 0.12]}
        rotation={[0, 0.3, 0.15]}
        material={hairMat}
      >
        <sphereGeometry args={[0.42, 20, 20, 0, Math.PI, 0, Math.PI * 0.6]} />
      </mesh>
      {/* Side coverage right */}
      <mesh
        position={[0.78, 0.05, 0.12]}
        rotation={[0, -0.3, -0.15]}
        material={hairMat}
      >
        <sphereGeometry args={[0.42, 20, 20, 0, Math.PI, 0, Math.PI * 0.6]} />
      </mesh>
      {/* Front hairline */}
      <mesh position={[0, 0.62, 0.72]} rotation={[0.4, 0, 0]} material={hairMat}>
        <sphereGeometry args={[0.38, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
      </mesh>

      {/* ── LEFT EYE ── */}
      <group position={[-0.295, 0.165, 0.895]}>
        {/* White */}
        <mesh material={eyeWhiteMat}>
          <sphereGeometry args={[0.13, 28, 28]} />
        </mesh>
        {/* Iris + pupil (gaze group) */}
        <group ref={leftEyeBallRef}>
          <mesh position={[0, 0, 0.09]} material={irisMat}>
            <circleGeometry args={[0.072, 32]} />
          </mesh>
          <mesh position={[0, 0, 0.092]} material={pupilMat}>
            <circleGeometry args={[0.038, 32]} />
          </mesh>
          {/* Eye shine */}
          <mesh position={[0.022, 0.024, 0.094]}>
            <circleGeometry args={[0.014, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        {/* Upper eyelid */}
        <mesh
          ref={leftLidRef}
          position={[0, 0.01, 0.115]}
          material={deepSkinMat}
        >
          <capsuleGeometry args={[0.065, 0.115, 4, 12]} />
        </mesh>
      </group>

      {/* ── RIGHT EYE ── */}
      <group position={[0.295, 0.165, 0.895]}>
        <mesh material={eyeWhiteMat}>
          <sphereGeometry args={[0.13, 28, 28]} />
        </mesh>
        <group ref={rightEyeBallRef}>
          <mesh position={[0, 0, 0.09]} material={irisMat}>
            <circleGeometry args={[0.072, 32]} />
          </mesh>
          <mesh position={[0, 0, 0.092]} material={pupilMat}>
            <circleGeometry args={[0.038, 32]} />
          </mesh>
          <mesh position={[0.022, 0.024, 0.094]}>
            <circleGeometry args={[0.014, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        <mesh
          ref={rightLidRef}
          position={[0, 0.01, 0.115]}
          material={deepSkinMat}
        >
          <capsuleGeometry args={[0.065, 0.115, 4, 12]} />
        </mesh>
      </group>

      {/* ── EYEBROWS — slim and natural ── */}
      <mesh
        ref={leftBrowRef}
        position={[-0.295, 0.355, 0.88]}
        rotation={[0, 0.05, 0.1]}
        material={hairMat}
      >
        <capsuleGeometry args={[0.018, 0.175, 4, 8]} />
      </mesh>
      <mesh
        ref={rightBrowRef}
        position={[0.295, 0.355, 0.88]}
        rotation={[0, -0.05, -0.1]}
        material={hairMat}
      >
        <capsuleGeometry args={[0.018, 0.175, 4, 8]} />
      </mesh>

      {/* ── NOSE — subtle and natural ── */}
      {/* Bridge */}
      <mesh position={[0, 0.08, 0.935]} material={deepSkinMat}>
        <capsuleGeometry args={[0.024, 0.18, 4, 8]} />
      </mesh>
      {/* Tip */}
      <mesh position={[0, -0.13, 0.995]} material={skinMat}>
        <sphereGeometry args={[0.058, 16, 16]} />
      </mesh>
      {/* Left nostril */}
      <mesh
        position={[-0.068, -0.175, 0.945]}
        rotation={[0.2, 0.3, 0]}
        material={deepSkinMat}
      >
        <sphereGeometry args={[0.032, 12, 12]} />
      </mesh>
      {/* Right nostril */}
      <mesh
        position={[0.068, -0.175, 0.945]}
        rotation={[0.2, -0.3, 0]}
        material={deepSkinMat}
      >
        <sphereGeometry args={[0.032, 12, 12]} />
      </mesh>

      {/* ── JAW + MOUTH GROUP ── */}
      <group ref={jawRef} position={[0, -0.35, 0]}>
        {/* Jaw/chin mass */}
        <mesh position={[0, 0, 0]} material={skinMat}>
          <sphereGeometry args={[0.62, 32, 16, 0, Math.PI * 2, 1.72, 1.45]} />
        </mesh>

        {/* Upper lip */}
        <mesh position={[0, 0.35, 0.9]} material={lipMat}>
          <capsuleGeometry args={[0.024, 0.26, 4, 12]} />
        </mesh>
        {/* Cupid's bow L */}
        <mesh
          position={[-0.09, 0.372, 0.9]}
          rotation={[0, 0, 0.35]}
          material={lipMat}
        >
          <capsuleGeometry args={[0.018, 0.085, 4, 8]} />
        </mesh>
        {/* Cupid's bow R */}
        <mesh
          position={[0.09, 0.372, 0.9]}
          rotation={[0, 0, -0.35]}
          material={lipMat}
        >
          <capsuleGeometry args={[0.018, 0.085, 4, 8]} />
        </mesh>
        {/* Lower lip */}
        <mesh position={[0, 0.22, 0.91]} material={lipMat}>
          <capsuleGeometry args={[0.03, 0.22, 4, 12]} />
        </mesh>
        {/* Mouth corners */}
        <mesh position={[-0.165, 0.285, 0.88]} material={lipMat}>
          <sphereGeometry args={[0.022, 8, 8]} />
        </mesh>
        <mesh position={[0.165, 0.285, 0.88]} material={lipMat}>
          <sphereGeometry args={[0.022, 8, 8]} />
        </mesh>
        {/* Teeth strip */}
        <mesh position={[0, 0.29, 0.86]} material={eyeWhiteMat}>
          <boxGeometry args={[0.22, 0.032, 0.03]} />
        </mesh>
      </group>

    </group>
  )
}
