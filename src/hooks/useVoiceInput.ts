/**
 * useVoiceInput — Production-grade voice input hook for Confera
 * 
 * Supports two modes:
 * 1. speech-api: Web Speech API (Chrome/Edge/Safari desktop)
 * 2. media-recorder: MediaRecorder → Whisper transcription (iOS, Firefox, fallback)
 * 
 * Improvements over previous version:
 * - AudioContext resume before recognition start
 * - Retry with exponential backoff on start failures
 * - Browser-specific workarounds (Safari continuous=false, Firefox fallback)
 * - Memory leak prevention (track all streams, cleanup on every path)
 * - Device change detection
 * - Background tab handling (pause/resume on visibility change)
 * - Timeout safety (abort + retry if onstart doesn't fire within 5s)
 * - Structured error categorization
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { detectBrowser, ensureAudioContext, type BrowserInfo } from '@/lib/voiceDiagnostics'

export type VoiceInputMode = 'speech-api' | 'media-recorder' | 'text-only'

export interface VoiceInputError {
  code: 'permission-denied' | 'not-found' | 'not-supported' | 'network' | 'aborted' | 'unknown'
  message: string
  recoverable: boolean
}

interface UseVoiceInputOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
  onStatusChange?: (status: 'idle' | 'starting' | 'listening' | 'stopping' | 'error') => void
  autoSend: boolean
  silenceDelay?: number
}

const MAX_RETRIES = 3
const RETRY_BACKOFF_MS = 200
const START_TIMEOUT_MS = 5000
const CHUNK_DURATION_MS = 6000

export function useVoiceInput({
  onTranscript,
  onError,
  onStatusChange,
  autoSend,
  silenceDelay = 2000,
}: UseVoiceInputOptions) {
  const browserRef = useRef<BrowserInfo>(detectBrowser())
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'stopping' | 'error'>('idle')
  const [mode, setMode] = useState<VoiceInputMode>(() => {
    const browser = browserRef.current
    // iOS: always media-recorder (Web Speech API not supported)
    if (browser.isIOS) return 'media-recorder'
    // Firefox: SpeechRecognition is unreliable — use media-recorder
    if (browser.name === 'Firefox') return 'media-recorder'
    // Check for SpeechRecognition API
    const hasSpeechAPI = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    return hasSpeechAPI ? 'speech-api' : 'media-recorder'
  })

  // ── Shared refs ──
  const shouldContinueRef = useRef(false)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const allStreamsRef = useRef<Set<MediaStream>>(new Set()) // Track all streams for cleanup

  // ── Speech API refs ──
  const recognitionRef = useRef<any>(null)
  const isStartingRef = useRef(false)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)

  // ── MediaRecorder refs ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Status management ──
  const updateStatus = useCallback((newStatus: typeof status) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // ── Stream tracking (memory leak prevention) ──
  const trackStream = useCallback((stream: MediaStream) => {
    allStreamsRef.current.add(stream)
  }, [])

  const releaseStream = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach(t => t.stop())
    allStreamsRef.current.delete(stream)
  }, [])

  const releaseAllStreams = useCallback(() => {
    allStreamsRef.current.forEach(stream => {
      stream.getTracks().forEach(t => t.stop())
    })
    allStreamsRef.current.clear()
  }, [])

  // ── Speech API mode ──────────────────────────────────────────────────────

  const startSpeechAPI = useCallback(async (): Promise<boolean> => {
    if (isStartingRef.current) return false

    // Destroy any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (_) {}
      recognitionRef.current = null
    }

    // Resume AudioContext (required after autoplay policy)
    await ensureAudioContext()

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('[VoiceInput] SpeechRecognition not available, falling back to media-recorder')
      setMode('media-recorder')
      return false
    }

    const browser = browserRef.current
    const recognition = new SpeechRecognition()

    // Browser-specific configuration
    if (browser.name === 'Safari' && !browser.isIOS) {
      // Safari desktop: continuous mode is buggy, use single-result mode with auto-restart
      recognition.continuous = false
      recognition.interimResults = false
    } else {
      recognition.continuous = true
      recognition.interimResults = true
    }

    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      isStartingRef.current = false
      retryCountRef.current = 0
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      setIsListening(true)
      updateStatus('listening')
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (interim) onTranscript(interim, false)
      if (final) {
        onTranscript(final, true)
        if (autoSend) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => {
            stopSpeechAPI()
          }, silenceDelay)
        }
      }
    }

    recognition.onend = () => {
      isStartingRef.current = false
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }

      // Auto-restart if we should continue AND this wasn't an intentional stop
      if (shouldContinueRef.current && !isStartingRef.current) {
        isStartingRef.current = true
        // Longer delay for Safari (it needs more time between restarts)
        const delay = browser.name === 'Safari' ? 800 : 500
        setTimeout(() => {
          try {
            recognition.start()
          } catch (_) {
            isStartingRef.current = false
            setIsListening(false)
            updateStatus('idle')
          }
        }, delay)
      } else {
        setIsListening(false)
        updateStatus('idle')
      }
    }

    recognition.onerror = (event: any) => {
      const errorType = event.error

      if (errorType === 'not-allowed') {
        onError('Microphone permission denied. Please allow microphone access in your browser settings.')
        shouldContinueRef.current = false
        isStartingRef.current = false
        setIsListening(false)
        updateStatus('error')
        return
      }

      if (errorType === 'no-speech' || errorType === 'aborted') {
        // Expected errors — onend will handle restart if shouldContinueRef is true
        isStartingRef.current = false
        return
      }

      if (errorType === 'network') {
        console.warn('[VoiceInput] Network error on Speech API (often caused by Brave Shields or ad blockers). Falling back to media-recorder.')
        setMode('media-recorder')
        onError('Voice API blocked by browser shields. Falling back to alternative engine. Please tap the mic to try again.')
        shouldContinueRef.current = false
        isStartingRef.current = false
        setIsListening(false)
        updateStatus('error')
        return
      }

      // Unknown error — log it
      console.error('[VoiceInput] SpeechRecognition error:', errorType)
      if (errorType === 'not-supported' || errorType === 'service-not-allowed') {
        setMode('media-recorder')
        onError('Voice API unavailable. Falling back to alternative engine. Please tap the mic to try again.')
      }
      isStartingRef.current = false
    }

    recognitionRef.current = recognition
    shouldContinueRef.current = true
    isStartingRef.current = true
    updateStatus('starting')

    // Attempt to start with retry logic
    const attemptStart = (attempt: number): boolean => {
      try {
        recognition.start()

        // Safety timeout: if onstart doesn't fire within 5s, abort and retry
        startTimeoutRef.current = setTimeout(() => {
          if (isStartingRef.current && attempt < MAX_RETRIES) {
            console.warn(`[VoiceInput] Start timeout (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`)
            try { recognition.abort() } catch (_) {}
            isStartingRef.current = false
            retryCountRef.current = attempt + 1

            setTimeout(() => {
              if (shouldContinueRef.current) {
                attemptStart(attempt + 1)
              }
            }, RETRY_BACKOFF_MS * Math.pow(2, attempt))
          } else if (isStartingRef.current) {
            // All retries exhausted
            isStartingRef.current = false
            shouldContinueRef.current = false
            setIsListening(false)
            updateStatus('error')
            onError('Speech recognition failed to start after multiple attempts. Try using text input instead.')
          }
        }, START_TIMEOUT_MS)

        return true
      } catch (e) {
        isStartingRef.current = false

        if (attempt < MAX_RETRIES) {
          retryCountRef.current = attempt + 1
          setTimeout(() => {
            if (shouldContinueRef.current) {
              attemptStart(attempt + 1)
            }
          }, RETRY_BACKOFF_MS * Math.pow(2, attempt))
          return true // Will retry
        }

        updateStatus('error')
        return false
      }
    }

    return attemptStart(0)
  }, [autoSend, silenceDelay, onTranscript, onError, updateStatus])

  const stopSpeechAPI = useCallback(() => {
    shouldContinueRef.current = false
    isStartingRef.current = false
    retryCountRef.current = 0
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (_) {}
    }
    setIsListening(false)
    updateStatus('idle')
  }, [updateStatus])

  // ── MediaRecorder mode ────────────────────────────────────────────────────

  const startMediaRecorder = useCallback(async (): Promise<boolean> => {
    updateStatus('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      })
      streamRef.current = stream
      trackStream(stream)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []

        // Only transcribe if blob is meaningful (>1KB means user likely spoke)
        if (audioBlob.size < 1000) {
          if (shouldContinueRef.current) startNewChunk()
          return
        }

        try {
          const reader = new FileReader()
          reader.readAsDataURL(audioBlob)
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1]
            try {
              const { data, error } = await supabase.functions.invoke(
                'transcribe-audio',
                { body: { audio: base64, mimeType } }
              )
              if (!error && data?.transcript) {
                onTranscript(data.transcript, true)
              }
            } catch (e) {
              console.error('[VoiceInput] Transcription request failed:', e)
            }
          }
        } catch (e) {
          console.error('[VoiceInput] Transcription processing failed:', e)
        }

        // If still listening, start a new recording chunk
        if (shouldContinueRef.current) {
          startNewChunk()
        }
      }

      setIsListening(true)
      shouldContinueRef.current = true
      updateStatus('listening')
      startNewChunk()
      return true
    } catch (e: any) {
      updateStatus('error')
      if (e.name === 'NotAllowedError') {
        onError('Microphone permission denied. Please allow microphone access in your browser settings.')
      } else if (e.name === 'NotFoundError') {
        onError('No microphone found. Please connect a microphone and try again.')
      } else {
        onError(`Microphone unavailable: ${e.message}`)
      }
      return false
    }
  }, [onTranscript, onError, updateStatus, trackStream])

  const startNewChunk = useCallback(() => {
    if (!mediaRecorderRef.current || !shouldContinueRef.current) return
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setTimeout(() => {
      if (mediaRecorderRef.current && shouldContinueRef.current) {
        audioChunksRef.current = []
        try {
          mediaRecorderRef.current.start()
          recordingTimerRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop()
            }
          }, CHUNK_DURATION_MS)
        } catch (e) {
          console.error('[VoiceInput] Failed to start new recording chunk:', e)
        }
      }
    }, 100)
  }, [])

  const stopMediaRecorder = useCallback(() => {
    shouldContinueRef.current = false
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop() } catch (_) {}
    }
    if (streamRef.current) {
      releaseStream(streamRef.current)
      streamRef.current = null
    }
    setIsListening(false)
    updateStatus('idle')
  }, [updateStatus, releaseStream])

  // ── Background tab handling ───────────────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isListening) {
        // Tab went to background — pause recognition to prevent resource waste
        // (Browsers throttle background tabs heavily, causing errors)
        console.log('[VoiceInput] Tab hidden — pausing recognition')
        if (mode === 'speech-api' && recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (_) {}
        }
        // Don't set shouldContinueRef to false — we want to resume on return
      } else if (document.visibilityState === 'visible' && shouldContinueRef.current && !isListening) {
        // Tab returned to foreground — resume
        console.log('[VoiceInput] Tab visible — resuming recognition')
        if (mode === 'speech-api') {
          startSpeechAPI()
        }
        // MediaRecorder handles its own lifecycle via chunks
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isListening, mode, startSpeechAPI])

  // ── Device change detection ───────────────────────────────────────────────

  useEffect(() => {
    const handleDeviceChange = async () => {
      if (!isListening) return

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(d => d.kind === 'audioinput')

        if (audioInputs.length === 0) {
          // All mics disconnected
          console.warn('[VoiceInput] All microphones disconnected')
          onError('Microphone disconnected. Please reconnect and try again.')
          stopListening()
        }
      } catch (_) {
        // enumerateDevices may not be available
      }
    }

    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange)
    }
  }, [isListening, onError])

  // ── Public API ────────────────────────────────────────────────────────────

  const startListening = useCallback(async (): Promise<boolean> => {
    if (mode === 'speech-api') {
      return startSpeechAPI()
    } else if (mode === 'media-recorder') {
      return startMediaRecorder()
    }
    return false
  }, [mode, startSpeechAPI, startMediaRecorder])

  const stopListening = useCallback(() => {
    if (mode === 'speech-api') stopSpeechAPI()
    else stopMediaRecorder()
  }, [mode, stopSpeechAPI, stopMediaRecorder])

  const cleanup = useCallback(() => {
    shouldContinueRef.current = false
    stopSpeechAPI()
    stopMediaRecorder()
    releaseAllStreams()
    window.speechSynthesis?.cancel()
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current)
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
  }, [stopSpeechAPI, stopMediaRecorder, releaseAllStreams])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isListening,
    status,
    mode,
    startListening,
    stopListening,
    cleanup,
    isIOS: browserRef.current.isIOS,
    browser: browserRef.current,
  }
}
