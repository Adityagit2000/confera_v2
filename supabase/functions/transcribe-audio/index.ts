import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, checkRateLimit, rateLimitResponse } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate request — prevents unauthorized callers from burning Groq credits
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    const { user } = auth

    // Rate limit: max 20 transcriptions per minute per user
    if (!checkRateLimit(`transcribe:${user.id}`, 20, 60_000)) {
      return rateLimitResponse(corsHeaders)
    }

    const { audio, mimeType } = await req.json()

    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'audio is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate audio payload size (max ~25MB base64 = ~18MB raw audio)
    if (audio.length > 25 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Audio payload too large (max 25MB)', success: false }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) throw new Error('GROQ_API_KEY not configured')

    // Decode base64 to binary
    const binaryStr = atob(audio)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    // Determine file extension from mime type
    const ext = mimeType?.includes('mp4') ? 'mp4'
      : mimeType?.includes('ogg') ? 'ogg'
      : 'webm'

    // Build multipart form for Groq Whisper API
    const formData = new FormData()
    const audioBlob = new Blob([bytes], { type: mimeType || 'audio/webm' })
    formData.append('file', audioBlob, `audio.${ext}`)
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('language', 'en')
    formData.append('response_format', 'json')

    // Add timeout to Groq request (30 seconds)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}` },
          body: formData,
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Groq Whisper error (${response.status}): ${err.substring(0, 200)}`)
      }

      const data = await response.json()

      return new Response(
        JSON.stringify({ 
          transcript: data.text?.trim() || '',
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } finally {
      clearTimeout(timeout)
    }

  } catch (error: any) {
    console.error('transcribe-audio error:', error.message)
    const status = error.name === 'AbortError' ? 504 : 500
    const message = error.name === 'AbortError' 
      ? 'Transcription timed out. Please try again.'
      : error.message
    return new Response(
      JSON.stringify({ error: message, success: false }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
