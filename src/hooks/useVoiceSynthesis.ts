import { useRef, useCallback, useState } from 'react'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream

export function useVoiceSynthesis() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const selectedVoiceRef = useRef<string>('')

  // On iOS, SpeechSynthesis with active mic routes to earpiece.
  // We detect this and use a different approach.
  // For now we still use SpeechSynthesis but add the playsinline
  // trick via a silent audio element to keep audio session on speaker.
  const unlockAudioSession = useCallback(() => {
    if (!isIOS) return
    // Create a silent audio element that keeps the audio session
    // routed to loudspeaker even when mic is active
    if (!audioRef.current) {
      const audio = document.createElement('audio')
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
      audio.volume = 0.001
      // Silent audio data URI
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAA' +
        'EAAQAAgD4AAIA+AAABAAgAZGF0YQAAAAA='
      audio.loop = true
      document.body.appendChild(audio)
      audioRef.current = audio
    }
    audioRef.current.play().catch(() => {})
  }, [])

  const speak = useCallback((
    text: string,
    voiceName: string,
    onStart?: () => void,
    onEnd?: () => void
  ) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    unlockAudioSession()

    const utterance = new SpeechSynthesisUtterance(text)

    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find(v => v.name === voiceName) ||
      voices.find(v => v.lang.startsWith('en') && !v.localService) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0]

    if (voice) utterance.voice = voice
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => {
      setIsSpeaking(true)
      onStart?.()
    }
    utterance.onend = () => {
      setIsSpeaking(false)
      onEnd?.()
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      onEnd?.()
    }

    // iOS SpeechSynthesis bug: sometimes silently fails.
    // Force it with a small delay.
    if (isIOS) {
      setTimeout(() => window.speechSynthesis.speak(utterance), 100)
    } else {
      window.speechSynthesis.speak(utterance)
    }
  }, [unlockAudioSession])

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  const getVoices = useCallback((): SpeechSynthesisVoice[] => {
    return window.speechSynthesis?.getVoices()
      .filter(v => v.lang.startsWith('en')) || []
  }, [])

  return { speak, cancel, isSpeaking, getVoices, isIOS }
}
