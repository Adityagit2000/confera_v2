import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audio, mimeType } = await req.json()

    if (!audio) {
      throw new Error('audio is required')
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

    const response = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}` },
        body: formData,
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Groq Whisper error: ${err}`)
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({ 
        transcript: data.text?.trim() || '',
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('transcribe-audio error:', error)
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
