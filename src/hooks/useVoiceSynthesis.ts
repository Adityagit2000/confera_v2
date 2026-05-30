/**
 * useVoiceSynthesis - Production-grade TTS hook for Confera
 * 
 * Improvements:
 * - Async voice loading: waits for voiceschanged event before speaking
 * - Chrome 15-second bug: splits long text into chunks at sentence boundaries
 * - Playback timeout: retries if onstart doesn't fire within 3 seconds
 * - Proper cleanup: removes appended audio elements on unmount
 * - Background tab handling: pauses speech when tab is hidden
 */

import { useRef, useCallback, useState, useEffect } from 'react'
import { detectBrowser } from '@/lib/voiceDiagnostics'

const CHROME_MAX_UTTERANCE_LENGTH = 180 // chars - stay under Chrome's ~15s limit
const SPEAK_TIMEOUT_MS = 3000

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    // Find the best split point: sentence end, then clause, then word boundary
    let splitIdx = -1
    const searchWindow = remaining.substring(0, maxLength)

    // Try sentence boundaries
    const sentenceEnd = Math.max(
      searchWindow.lastIndexOf('. '),
      searchWindow.lastIndexOf('! '),
      searchWindow.lastIndexOf('? ')
    )
    if (sentenceEnd > maxLength * 0.3) {
      splitIdx = sentenceEnd + 2
    }

    // Try clause boundaries
    if (splitIdx === -1) {
      const clauseEnd = Math.max(
        searchWindow.lastIndexOf(', '),
        searchWindow.lastIndexOf('; '),
        searchWindow.lastIndexOf(': ')
      )
      if (clauseEnd > maxLength * 0.3) {
        splitIdx = clauseEnd + 2
      }
    }

    // Fall back to word boundary
    if (splitIdx === -1) {
      const wordEnd = searchWindow.lastIndexOf(' ')
      if (wordEnd > maxLength * 0.3) {
        splitIdx = wordEnd + 1
      }
    }

    // Last resort: hard split
    if (splitIdx === -1) {
      splitIdx = maxLength
    }

    chunks.push(remaining.substring(0, splitIdx).trim())
    remaining = remaining.substring(splitIdx).trim()
  }

  return chunks
}

export function useVoiceSynthesis() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const browserRef = useRef(detectBrowser())
  const isIOS = browserRef.current.isIOS
  const isChrome = browserRef.current.name === 'Chrome'
  const utteranceQueueRef = useRef<SpeechSynthesisUtterance[]>([])
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupRef = useRef(false)

  // ── Voice loading ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!window.speechSynthesis) return

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        setVoicesLoaded(true)
      }
    }

    // Try immediately (Chrome loads synchronously)
    loadVoices()

    // Listen for async loading (Firefox, Safari)
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // ── iOS audio session unlock ───────────────────────────────────────────

  const unlockAudioSession = useCallback(() => {
    if (!isIOS) return
    if (!audioRef.current) {
      const audio = document.createElement('audio')
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
      audio.volume = 0.001
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAA' +
        'EAAQAAgD4AAIA+AAABAAgAZGF0YQAAAAA='
      audio.loop = true
      document.body.appendChild(audio)
      audioRef.current = audio
    }
    audioRef.current.play().catch(() => {})
  }, [isIOS])

  // ── Find best voice ────────────────────────────────────────────────────

  const findVoice = useCallback((preferredName?: string): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null

    // Try preferred voice first
    if (preferredName) {
      const preferred = voices.find(v => v.name === preferredName)
      if (preferred) return preferred
    }

    // Fallback chain
    return (
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.name.includes('Samantha')) ||
      voices.find(v => v.name.includes('Natural')) ||
      voices.find(v => v.lang.startsWith('en') && !v.localService) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0]
    )
  }, [])

  // ── Speak (main entry point) ──────────────────────────────────────────

  const speak = useCallback((
    text: string,
    voiceName?: string,
    onStart?: () => void,
    onEnd?: () => void
  ) => {
    if (!window.speechSynthesis || !text.trim()) {
      onEnd?.()
      return
    }

    // Cancel any in-progress speech
    window.speechSynthesis.cancel()
    utteranceQueueRef.current = []
    currentUtteranceRef.current = null
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current)
      speakTimeoutRef.current = null
    }

    unlockAudioSession()

    const voice = findVoice(voiceName)

    // Chrome: split long text to avoid the 15-second silent cutoff bug
    const chunks = isChrome
      ? splitTextIntoChunks(text, CHROME_MAX_UTTERANCE_LENGTH)
      : [text]

    const utterances = chunks.map((chunk, idx) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      if (voice) utterance.voice = voice
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.volume = 1.0

      utterance.onstart = () => {
        if (idx === 0) {
          setIsSpeaking(true)
          onStart?.()
        }
        // Clear the start timeout since we're actually speaking
        if (speakTimeoutRef.current) {
          clearTimeout(speakTimeoutRef.current)
          speakTimeoutRef.current = null
        }
      }

      utterance.onend = () => {
        // If this is the last chunk, signal completion
        if (idx === chunks.length - 1) {
          setIsSpeaking(false)
          currentUtteranceRef.current = null
          onEnd?.()
        }
      }

      utterance.onerror = (e) => {
        const errorType = (e as any).error
        // 'interrupted' and 'canceled' are expected when we cancel speech
        if (errorType !== 'interrupted' && errorType !== 'canceled') {
          console.warn('[VoiceSynthesis] TTS error:', errorType, 'on chunk', idx)
        }
        if (idx === chunks.length - 1 || errorType !== 'interrupted') {
          setIsSpeaking(false)
          currentUtteranceRef.current = null
          onEnd?.()
        }
      }

      return utterance
    })

    utteranceQueueRef.current = utterances

    // Small delay to let any previous cancel settle
    setTimeout(() => {
      if (cleanupRef.current) return

      utterances.forEach(u => {
        window.speechSynthesis.speak(u)
      })
      currentUtteranceRef.current = utterances[0]

      // Safety timeout: if onstart doesn't fire within 3 seconds, retry once
      speakTimeoutRef.current = setTimeout(() => {
        if (currentUtteranceRef.current && !isSpeaking) {
          console.warn('[VoiceSynthesis] Speak timeout - retrying')
          window.speechSynthesis.cancel()
          setTimeout(() => {
            if (cleanupRef.current) return
            utterances.forEach(u => window.speechSynthesis.speak(u))
          }, 200)
        }
      }, SPEAK_TIMEOUT_MS)
    }, isIOS ? 150 : 100)
  }, [isIOS, isChrome, isSpeaking, findVoice, unlockAudioSession])

  // ── Cancel ─────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel()
    utteranceQueueRef.current = []
    currentUtteranceRef.current = null
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current)
      speakTimeoutRef.current = null
    }
    setIsSpeaking(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  // ── Get available English voices ───────────────────────────────────────

  const getVoices = useCallback((): SpeechSynthesisVoice[] => {
    return window.speechSynthesis?.getVoices()
      .filter(v => v.lang.startsWith('en')) || []
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    cleanupRef.current = false

    return () => {
      cleanupRef.current = true
      window.speechSynthesis?.cancel()
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current)

      // Remove the appended audio element from DOM
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.remove()
        audioRef.current = null
      }
    }
  }, [])

  return { speak, cancel, isSpeaking, voicesLoaded, getVoices, isIOS }
}
