
/**
 * Shared AI Service for Confera
 * Implements a robust fallback chain: Gemini -> Groq -> OpenAI
 */

export const AI_PROVIDERS = {
  GEMINI: 'gemini',
  GROQ: 'groq',
  OPENAI: 'openai'
} as const;

export type AiProvider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

export interface AiRequestOptions {
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: string; // 'application/json' or 'text/plain'
  systemPrompt?: string;
  userMessage: string;
}

export async function callAiWithFallback(options: AiRequestOptions): Promise<string> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const groqKey = Deno.env.get('GROQ_API_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  const {
    systemPrompt = "You are a helpful assistant.",
    userMessage,
    temperature = 0.3,
    maxTokens = 2048,
    responseMimeType = 'text/plain'
  } = options;

  let lastError: Error | null = null;

  // 1. Try Gemini
  if (geminiKey) {
    try {
      console.log('[AI-Service] Attempting Gemini...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: { 
              temperature, 
              maxOutputTokens: maxTokens,
              responseMimeType: responseMimeType === 'application/json' ? 'application/json' : 'text/plain'
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
      
      const errText = await response.text();
      console.warn(`[AI-Service] Gemini failed (Status: ${response.status}):`, errText.substring(0, 200));
      if (errText.includes('quota') || response.status === 429) {
        console.log('[AI-Service] Gemini Quota Exceeded. Falling back...');
      }
    } catch (e) {
      console.warn('[AI-Service] Gemini Exception:', (e as any).message);
      lastError = e as Error;
    }
  }

  // 2. Try Groq
  if (groqKey) {
    try {
      console.log('[AI-Service] Attempting Groq...');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
      
      const errText = await response.text();
      console.warn(`[AI-Service] Groq failed (Status: ${response.status}):`, errText.substring(0, 200));
    } catch (e) {
      console.warn('[AI-Service] Groq Exception:', (e as any).message);
      lastError = e as Error;
    }
  }

  // 3. Try OpenAI
  if (openAiKey) {
    try {
      console.log('[AI-Service] Attempting OpenAI...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
      
      const errText = await response.text();
      console.warn(`[AI-Service] OpenAI failed (Status: ${response.status}):`, errText.substring(0, 200));
    } catch (e) {
      console.warn('[AI-Service] OpenAI Exception:', (e as any).message);
      lastError = e as Error;
    }
  }

  throw new Error(lastError?.message || 'All AI providers failed. Most likely due to exhausted quotas or invalid API keys.');
}
