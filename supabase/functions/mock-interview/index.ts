import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

const geminiKey = Deno.env.get('GEMINI_API_KEY')
const openAiKey = Deno.env.get('OPENAI_API_KEY')

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    
    const { messages, jobRole = 'Software Engineer', isEvaluate = false } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      throw new Error('messages array is required')
    }

    let systemPrompt = `You are an expert AI interviewer conducting a technical and behavioral interview for the role of ${jobRole}.
    Ask one clear, concise question at a time. Wait for the user to answer before asking the next question.
    Do not give away the answers. Act professionally.`

    if (isEvaluate) {
      systemPrompt = `You are an expert AI interviewer evaluating a completed interview for the role of ${jobRole}.
      Review the conversation history. Based on the candidate's answers, evaluate their performance.
      
      Provide a JSON response with the exact structure:
      {
        "score": (integer out of 100),
        "communication_score": (integer out of 100),
        "technical_score": (integer out of 100),
        "feedback": "Overall summary of performance",
        "strengths": ["list of 2-3 strengths"],
        "improvements": ["list of 2-3 areas for improvement"]
      }
      Only return valid JSON without any markdown formatting wrappers.`
    }

    let content: any = null

    // Try Gemini first
    if (geminiKey) {
      try {
        const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = []
        for (const msg of messages) {
          if (msg.role === 'system') continue
          geminiContents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })
        }
        if (geminiContents.length === 0) {
          geminiContents.push({
            role: 'user',
            parts: [{ text: `Please start the interview for the role of ${jobRole}. Greet the candidate and ask the first question.` }]
          })
        }

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: geminiContents,
              generationConfig: {
                temperature: 0.7,
                ...(isEvaluate && { responseMimeType: 'application/json' })
              },
            }),
          }
        )
        const geminiData = await geminiRes.json()
        if (geminiRes.ok && geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          const textContent = geminiData.candidates[0].content.parts[0].text
          content = isEvaluate ? JSON.parse(textContent) : textContent
        } else {
          console.warn('Gemini failed, falling back to OpenAI:', JSON.stringify(geminiData.error || geminiData).substring(0, 200))
        }
      } catch (e) {
        console.warn('Gemini error, falling back to OpenAI:', (e as any).message)
      }
    }

    // Fallback to OpenAI
    if (content === null && openAiKey) {
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: apiMessages,
          temperature: 0.7,
          ...(isEvaluate && { response_format: { type: "json_object" } })
        }),
      })
      const openaiData = await openaiRes.json()
      if (!openaiRes.ok) {
        console.error('OpenAI Error:', JSON.stringify(openaiData))
        throw new Error(openaiData.error?.message || 'Failed to generate response')
      }
      const textContent = openaiData.choices[0].message.content
      content = isEvaluate ? JSON.parse(textContent) : textContent
    }

    if (content === null) {
      throw new Error('AI API Error: Both Gemini and OpenAI API keys failed. This is usually due to exhausted free-tier quotas or missing billing details. Please check your Google AI Studio and OpenAI dashboards.')
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge Function Error:', (error as any).message)
    return new Response(JSON.stringify({ error: (error as any).message }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
