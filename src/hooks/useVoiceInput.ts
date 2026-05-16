import { useRef, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

type VoiceInputMode = 'speech-api' | 'media-recorder' | 'text-only'

interface UseVoiceInputOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
  autoSend: boolean
  silenceDelay?: number
}

export function useVoiceInput({
  onTranscript,
  onError,
  autoSend,
  silenceDelay = 2000,
}: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const [mode, setMode] = useState<VoiceInputMode>(() => {
    // Detect iOS — all browsers on iOS use WebKit
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream
    if (isIOS) return 'media-recorder'
    const hasSpeechAPI = 'SpeechRecognition' in window ||
      'webkitSpeechRecognition' in window
    return hasSpeechAPI ? 'speech-api' : 'media-recorder'
  })

  // Speech API refs
  const recognitionRef = useRef<any>(null)
  const shouldContinueRef = useRef(false)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isStartingRef = useRef(false) // guard against rapid start/stop

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Speech API mode (Chrome/Android) ──
  const startSpeechAPI = useCallback(() => {
    // Guard: don't start if already starting or already listening
    if (isStartingRef.current) return false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (e) {}
      recognitionRef.current = null
    }

    const SpeechRecognition = (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMode('media-recorder')
      return false
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      isStartingRef.current = false
      setIsListening(true)
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
      setIsListening(false)
      // Only auto-restart if we explicitly want to continue
      // and a new start isn't already in progress
      if (shouldContinueRef.current && !isStartingRef.current) {
        isStartingRef.current = true
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            isStartingRef.current = false
          }
        }, 500) // longer delay to prevent rapid cycling
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        onError('Microphone permission denied')
        shouldContinueRef.current = false
        isStartingRef.current = false
        setIsListening(false)
      } else if (event.error === 'aborted' || event.error === 'no-speech') {
        // These are expected — recognition was aborted or no speech detected
        // onend will handle restart if shouldContinueRef is true
        isStartingRef.current = false
      }
    }

    recognitionRef.current = recognition
    shouldContinueRef.current = true
    isStartingRef.current = true
    try {
      recognition.start()
      return true
    } catch (e) {
      isStartingRef.current = false
      return false
    }
  }, [autoSend, silenceDelay, onTranscript, onError])

  const stopSpeechAPI = useCallback(() => {
    shouldContinueRef.current = false
    isStartingRef.current = false
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (e) {}
    }
    setIsListening(false)
  }, [])

  // ── MediaRecorder mode (iOS fallback) ──
  // Records in 5-second chunks, sends each to Groq Whisper via edge function
  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      })
      streamRef.current = stream

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

        // Only transcribe if blob is meaningful (> 1KB means user spoke)
        if (audioBlob.size < 1000) return

        try {
          // Convert to base64 and send to transcribe edge function
          const reader = new FileReader()
          reader.readAsDataURL(audioBlob)
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1]
            const { data, error } = await supabase.functions.invoke(
              'transcribe-audio',
              { body: { audio: base64, mimeType } }
            )
            if (!error && data?.transcript) {
              onTranscript(data.transcript, true)
            }
          }
        } catch (e) {
          console.error('Transcription failed:', e)
        }

        // If still listening, start a new recording chunk
        if (shouldContinueRef.current) {
          startNewChunk()
        }
      }

      setIsListening(true)
      shouldContinueRef.current = true
      startNewChunk()
      return true
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        onError('Microphone permission denied')
      } else {
        onError('Microphone unavailable')
      }
      return false
    }
  }, [onTranscript, onError])

  const startNewChunk = useCallback(() => {
    if (!mediaRecorderRef.current || !shouldContinueRef.current) return
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setTimeout(() => {
      if (mediaRecorderRef.current && shouldContinueRef.current) {
        audioChunksRef.current = []
        mediaRecorderRef.current.start()
        // Stop chunk after 6 seconds to transcribe
        recordingTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
        }, 6000)
      }
    }, 100)
  }, [])

  const stopMediaRecorder = useCallback(() => {
    shouldContinueRef.current = false
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsListening(false)
  }, [])

  // ── Public API ──
  const startListening = useCallback(async () => {
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
    window.speechSynthesis?.cancel()
  }, [stopSpeechAPI, stopMediaRecorder])

  return {
    isListening,
    mode,
    startListening,
    stopListening,
    cleanup,
    isIOS: mode === 'media-recorder',
  }
}
