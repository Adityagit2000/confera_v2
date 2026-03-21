import { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei'
import { AvatarHead } from './AvatarHead'
import { textToLipSync, getMouthOpenAtTime, LipSyncFrame } from '@/lib/avatar/lipSync'
import * as THREE from 'three'

interface Props {
  isSpeaking: boolean
  isListening: boolean
  isThinking: boolean
  currentText: string
}

function AvatarWithLipSync({ isSpeaking, isListening, isThinking, currentText }: Props) {
  const [mouthOpen, setMouthOpen] = useState(0)
  const framesRef = useRef<LipSyncFrame[]>([])
  const startTimeRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (isSpeaking && currentText) {
      framesRef.current = textToLipSync(currentText)
      startTimeRef.current = performance.now() / 1000

      const animate = () => {
        const elapsed = performance.now() / 1000 - startTimeRef.current
        const value = getMouthOpenAtTime(framesRef.current, elapsed)
        setMouthOpen(value)

        const totalDuration = framesRef.current[framesRef.current.length - 1]?.time || 0
        if (elapsed < totalDuration + 0.5) {
          rafRef.current = requestAnimationFrame(animate)
        } else {
          setMouthOpen(0)
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    } else {
      setMouthOpen(0)
    }

    return () => cancelAnimationFrame(rafRef.current)
  }, [currentText, isSpeaking])

  return (
    <AvatarHead
      isSpeaking={isSpeaking}
      isListening={isListening}
      isThinking={isThinking}
      mouthOpenAmount={mouthOpen}
    />
  )
}

export function AvatarScene({ isSpeaking, isListening, isThinking, currentText }: Props) {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0.1, 3.2], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        shadows
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>

          {/* Three-point studio lighting */}
          {/* Key light — upper left, warm */}
          <directionalLight
            position={[-2.5, 3, 3]}
            intensity={1.8}
            color="#fff5e6"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          {/* Fill light — right, cool */}
          <directionalLight
            position={[2, 1, 2]}
            intensity={0.7}
            color="#d0e8ff"
          />
          {/* Rim light — behind, blue */}
          <directionalLight
            position={[0, 2, -3]}
            intensity={0.5}
            color="#4488ff"
          />
          {/* Ambient */}
          <ambientLight intensity={0.35} color="#202030" />

          {/* Speaking glow — blue point light on face */}
          {isSpeaking && (
            <pointLight
              position={[0, 0.2, 1.8]}
              intensity={0.6}
              color="#4488ff"
              distance={3}
            />
          )}

          {/* Listening glow — green */}
          {isListening && (
            <pointLight
              position={[0, 0.2, 1.8]}
              intensity={0.4}
              color="#22c55e"
              distance={3}
            />
          )}

          <Environment preset="studio" />

          <AvatarWithLipSync
            isSpeaking={isSpeaking}
            isListening={isListening}
            isThinking={isThinking}
            currentText={currentText}
          />

          <ContactShadows
            position={[0, -1.5, 0]}
            opacity={0.35}
            scale={4}
            blur={2.5}
            far={2}
          />

          <OrbitControls
            enableRotate={false}
            enableZoom={false}
            enablePan={false}
          />
        </Suspense>
      </Canvas>

      {/* Status indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2
                      flex items-center gap-2 px-4 py-1.5 rounded-full
                      bg-black/50 backdrop-blur-md border border-white/10
                      pointer-events-none">
        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
          isSpeaking
            ? 'bg-blue-400 shadow-[0_0_6px_#60a5fa] animate-pulse'
            : isListening
              ? 'bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse'
              : isThinking
                ? 'bg-purple-400 shadow-[0_0_6px_#c084fc] animate-pulse'
                : 'bg-white/30'
        }`} />
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
          {isSpeaking
            ? 'Speaking'
            : isListening
              ? 'Listening'
              : isThinking
                ? 'Thinking'
                : 'Ready'}
        </span>
      </div>
    </div>
  )
}
