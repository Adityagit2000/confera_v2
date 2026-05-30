/**
 * useTurnDetection - Multi-signal intelligent turn detection for Confera
 * 
 * Replaces the simple silence timer with a 5-signal system that determines
 * when a user has genuinely finished their answer:
 * 
 *   Signal 1: Acoustic end-of-turn (final result + ending phrase pattern)
 *   Signal 2: Transcript completeness (word count threshold)
 *   Signal 3: Progressive silence thresholds (dynamic by word count)
 *   Signal 4: Manual control (Done / Keep Listening buttons)
 *   Signal 5: Voice activity detection (audio energy below threshold)
 * 
 * The system only submits when multiple signals agree - not just silence alone.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type TurnState = 'idle' | 'listening' | 'active_speech' | 'waiting' | 'confirming' | 'complete'

export interface TurnDetectionInput {
  /** Whether the voice engine is actively listening */
  isListening: boolean
  /** Current accumulated word count in the answer */
  wordCount: number
  /** Whether the last Speech API event was a final result */
  hasFinalResult: boolean
  /** The text of the last final result (for end-of-turn phrase detection) */
  lastFinalTranscript: string
  /** Whether audio energy is below the silence threshold (from VAD) */
  audioEnergyBelowThreshold: boolean
  /** Whether the VAD detects active speech right now */
  isSpeechDetected: boolean
  /** How long (ms) the user has been speaking continuously in this turn */
  speakingStartTimestamp: number | null
}

export interface TurnDetectionResult {
  /** Current state in the turn lifecycle */
  turnState: TurnState
  /** 0-1 progress through current silence threshold (for subtle progress bar) */
  silenceProgress: number
  /** The active silence threshold in ms */
  currentThresholdMs: number
  /** Reset and extend listening - the escape hatch */
  keepListening: () => void
  /** Immediately complete the turn */
  forceDone: () => void
  /** Reset the turn detection (e.g. when a new question starts) */
  reset: () => void
}

// ── End-of-turn phrase patterns ──────────────────────────────────────────────

const END_OF_TURN_PHRASES = [
  'that\'s it',
  'that\'s all',
  'that\'s about it',
  'that\'s basically it',
  'i think that covers it',
  'i think that\'s it',
  'i\'m done',
  'yeah that\'s it',
  'so yeah',
  'i guess that\'s it',
  'that would be my answer',
  'that\'s my answer',
  'i hope that answers',
  'does that make sense',
]

// Words that commonly end a complete thought (weaker signal, used in combination)
const TRAILING_FILLERS = ['yeah', 'so', 'basically', 'right', 'exactly', 'correct', 'sure']

// ── Threshold logic ──────────────────────────────────────────────────────────

function getSilenceThresholdMs(wordCount: number, speakingDurationMs: number): number {
  // If speaking for over 60 seconds continuously, they're likely wrapping up
  if (speakingDurationMs > 60_000) return 5000

  if (wordCount < 15) return Infinity // Never stop on silence
  if (wordCount <= 50) return 6000
  if (wordCount <= 100) return 8000
  return 10000
}

// Acoustic end-of-turn uses a shorter grace period
const ACOUSTIC_EOT_GRACE_MS = 2000

// Confirming state appears at 80% of threshold
const CONFIRMING_RATIO = 0.80

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTurnDetection(input: TurnDetectionInput): TurnDetectionResult {
  const {
    isListening,
    wordCount,
    hasFinalResult,
    lastFinalTranscript,
    audioEnergyBelowThreshold,
    isSpeechDetected,
    speakingStartTimestamp,
  } = input

  const [turnState, setTurnState] = useState<TurnState>('idle')
  const [silenceProgress, setSilenceProgress] = useState(0)

  // Internal refs
  const silenceStartRef = useRef<number | null>(null)
  const acousticEOTRef = useRef(false)
  const animFrameRef = useRef<number | null>(null)
  const forceDoneRef = useRef(false)
  const keepListeningCountRef = useRef(0)

  // Compute speaking duration
  const speakingDurationMs = speakingStartTimestamp
    ? Date.now() - speakingStartTimestamp
    : 0

  const currentThresholdMs = acousticEOTRef.current
    ? ACOUSTIC_EOT_GRACE_MS
    : getSilenceThresholdMs(wordCount, speakingDurationMs)

  // ── Signal 1: Acoustic end-of-turn detection ──────────────────────────────

  useEffect(() => {
    if (!lastFinalTranscript || !hasFinalResult) return

    const lower = lastFinalTranscript.toLowerCase().trim()

    // Check for explicit end-of-turn phrases
    const hasEndPhrase = END_OF_TURN_PHRASES.some(phrase => lower.endsWith(phrase))
    // Check for trailing filler words (weaker - only combined with silence)
    const hasTrailingFiller = TRAILING_FILLERS.some(w => {
      const words = lower.split(/\s+/)
      return words.length > 0 && words[words.length - 1] === w
    })

    if (hasEndPhrase) {
      acousticEOTRef.current = true
    } else if (hasTrailingFiller && wordCount >= 30) {
      // Filler at end of a substantial answer = moderate EOT signal
      acousticEOTRef.current = true
    }
  }, [lastFinalTranscript, hasFinalResult, wordCount])

  // ── Main detection loop (requestAnimationFrame) ───────────────────────────

  const tick = useCallback(() => {
    if (!isListening) {
      setSilenceProgress(0)
      return
    }

    // Force done - immediate
    if (forceDoneRef.current) {
      forceDoneRef.current = false
      setTurnState('complete')
      setSilenceProgress(1)
      return
    }

    const now = Date.now()

    // Determine if we're in silence
    const inSilence = audioEnergyBelowThreshold && !isSpeechDetected && hasFinalResult

    if (isSpeechDetected || !audioEnergyBelowThreshold) {
      // Active speech detected - reset silence tracking
      silenceStartRef.current = null
      setSilenceProgress(0)

      if (hasFinalResult || wordCount > 0) {
        setTurnState('active_speech')
      } else {
        setTurnState('listening')
      }
    } else if (inSilence) {
      // Silence detected
      if (silenceStartRef.current === null) {
        silenceStartRef.current = now
      }

      const silenceDuration = now - silenceStartRef.current
      const threshold = acousticEOTRef.current
        ? ACOUSTIC_EOT_GRACE_MS
        : getSilenceThresholdMs(wordCount, speakingDurationMs)

      if (threshold === Infinity) {
        // Under 15 words - never stop, just keep listening
        setTurnState('listening')
        setSilenceProgress(0)
      } else {
        const progress = Math.min(silenceDuration / threshold, 1)
        setSilenceProgress(progress)

        if (progress >= 1) {
          // Threshold fully elapsed - turn is complete
          setTurnState('complete')
        } else if (progress >= CONFIRMING_RATIO) {
          // Nearing threshold - show escape hatch
          setTurnState('confirming')
        } else {
          // In the waiting zone
          setTurnState('waiting')
        }
      }
    } else {
      // No final result yet but not hearing speech - just listening
      if (wordCount === 0) {
        setTurnState('listening')
      }
    }

    // Continue the loop
    animFrameRef.current = requestAnimationFrame(tick)
  }, [isListening, audioEnergyBelowThreshold, isSpeechDetected, hasFinalResult, wordCount, speakingDurationMs])

  // Start/stop the detection loop
  useEffect(() => {
    if (isListening) {
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      // Reset state when not listening (unless complete)
      if (turnState !== 'complete') {
        setTurnState('idle')
        setSilenceProgress(0)
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [isListening, tick, turnState])

  // ── Signal 4: Manual controls ─────────────────────────────────────────────

  const keepListening = useCallback(() => {
    silenceStartRef.current = null
    acousticEOTRef.current = false
    setSilenceProgress(0)
    setTurnState('active_speech')
    keepListeningCountRef.current += 1
  }, [])

  const forceDone = useCallback(() => {
    forceDoneRef.current = true
    // The next tick will pick this up and set state to complete
    setTurnState('complete')
    setSilenceProgress(1)
  }, [])

  const reset = useCallback(() => {
    silenceStartRef.current = null
    acousticEOTRef.current = false
    forceDoneRef.current = false
    keepListeningCountRef.current = 0
    setSilenceProgress(0)
    setTurnState('idle')
  }, [])

  return {
    turnState,
    silenceProgress,
    currentThresholdMs,
    keepListening,
    forceDone,
    reset,
  }
}
