
/**
 * Shared AI Service for Confera — Production-Grade
 * 
 * Implements a robust fallback chain: Gemini -> Groq -> OpenAI
 * 
 * Production improvements:
 * - AbortController with 30-second timeout on all AI provider calls
 * - Circuit breaker: skip provider for 2 minutes after 3 consecutive failures
 * - Latency tracking per provider per call
 * - Rough token estimation for cost monitoring
 * - Response validation helper
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
  timeoutMs?: number;
}

export interface AiCallResult {
  text: string;
  provider: AiProvider;
  latencyMs: number;
  estimatedTokens: number;
}

// ── Circuit Breaker State ────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 2 * 60 * 1000; // 2 minutes

// Global circuit breaker state (persists across requests within the same isolate)
const circuits: Record<string, CircuitState> = {
  gemini: { failures: 0, lastFailure: 0, isOpen: false },
  groq: { failures: 0, lastFailure: 0, isOpen: false },
  openai: { failures: 0, lastFailure: 0, isOpen: false },
};

function isCircuitOpen(provider: string): boolean {
  const circuit = circuits[provider];
  if (!circuit) return false;
  
  if (circuit.isOpen) {
    // Check if enough time has passed to try again (half-open)
    if (Date.now() - circuit.lastFailure > CIRCUIT_RESET_MS) {
      circuit.isOpen = false;
      circuit.failures = 0;
      console.log(`[AI-Service] Circuit breaker for ${provider} reset (half-open)`);
      return false;
    }
    return true;
  }
  return false;
}

function recordFailure(provider: string): void {
  const circuit = circuits[provider];
  if (!circuit) return;
  
  circuit.failures++;
  circuit.lastFailure = Date.now();
  
  if (circuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuit.isOpen = true;
    console.warn(`[AI-Service] Circuit breaker OPEN for ${provider} after ${circuit.failures} failures`);
  }
}

function recordSuccess(provider: string): void {
  const circuit = circuits[provider];
  if (!circuit) return;
  circuit.failures = 0;
  circuit.isOpen = false;
}

// ── Token Estimation ─────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

// ── Timeout-wrapped Fetch ────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Main Fallback Chain ──────────────────────────────────────────────────────

export async function callAiWithFallback(options: AiRequestOptions): Promise<string> {
  const result = await callAiWithFallbackDetailed(options);
  return result.text;
}

import { detectPromptInjection } from './request-context.ts';

/**
 * Detailed version that returns provider info, latency, and token estimates
 */
export async function callAiWithFallbackDetailed(options: AiRequestOptions): Promise<AiCallResult> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const groqKey = Deno.env.get('GROQ_API_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  const {
    systemPrompt = "You are a helpful assistant.",
    userMessage,
    temperature = 0.3,
    maxTokens = 2048,
    responseMimeType = 'text/plain',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (detectPromptInjection(userMessage)) {
    throw new Error('Suspicious input detected. Request blocked due to potential prompt injection.');
  }

  const inputTokens = estimateTokens(systemPrompt + userMessage);
  let lastError: Error | null = null;

  // 1. Try Gemini
  if (geminiKey && !isCircuitOpen('gemini')) {
    const startTime = Date.now();
    try {
      console.log('[AI-Service] Attempting Gemini...');
      const response = await fetchWithTimeout(
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
        },
        timeoutMs
      );

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          recordSuccess('gemini');
          console.log(`[AI-Service] Gemini succeeded in ${latencyMs}ms`);
          return { text, provider: 'gemini', latencyMs, estimatedTokens: inputTokens + estimateTokens(text) };
        }
      }
      
      const errText = await response.text();
      console.warn(`[AI-Service] Gemini failed (${response.status}, ${latencyMs}ms):`, errText.substring(0, 200));
      recordFailure('gemini');
      
      if (errText.includes('quota') || response.status === 429) {
        console.log('[AI-Service] Gemini quota exceeded. Falling back...');
      }
    } catch (e: any) {
      const latencyMs = Date.now() - startTime;
      if (e.name === 'AbortError') {
        console.warn(`[AI-Service] Gemini timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`[AI-Service] Gemini exception (${latencyMs}ms):`, e.message);
      }
      recordFailure('gemini');
      lastError = e;
    }
  } else if (isCircuitOpen('gemini')) {
    console.log('[AI-Service] Gemini circuit breaker is open, skipping');
  }

  // 2. Try Groq
  if (groqKey && !isCircuitOpen('groq')) {
    const startTime = Date.now();
    try {
      console.log('[AI-Service] Attempting Groq...');
      const response = await fetchWithTimeout(
        'https://api.groq.com/openai/v1/chat/completions',
        {
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
        },
        timeoutMs
      );

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text) {
          recordSuccess('groq');
          console.log(`[AI-Service] Groq succeeded in ${latencyMs}ms`);
          return { text, provider: 'groq', latencyMs, estimatedTokens: inputTokens + estimateTokens(text) };
        }
      }
      
      const errText = await response.text();
      console.warn(`[AI-Service] Groq failed (${response.status}, ${latencyMs}ms):`, errText.substring(0, 200));
      recordFailure('groq');
    } catch (e: any) {
      const latencyMs = Date.now() - startTime;
      if (e.name === 'AbortError') {
        console.warn(`[AI-Service] Groq timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`[AI-Service] Groq exception (${latencyMs}ms):`, e.message);
      }
      recordFailure('groq');
      lastError = e;
    }
  } else if (isCircuitOpen('groq')) {
    console.log('[AI-Service] Groq circuit breaker is open, skipping');
  }

  // 3. Try OpenAI
  if (openAiKey && !isCircuitOpen('openai')) {
    const startTime = Date.now();
    try {
      console.log('[AI-Service] Attempting OpenAI...');
      const response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
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
        },
        timeoutMs
      );

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text) {
          recordSuccess('openai');
          console.log(`[AI-Service] OpenAI succeeded in ${latencyMs}ms`);
          return { text, provider: 'openai', latencyMs, estimatedTokens: inputTokens + estimateTokens(text) };
        }
      }
      
      const errText = await response.text();
      console.warn(`[AI-Service] OpenAI failed (${response.status}, ${latencyMs}ms):`, errText.substring(0, 200));
      recordFailure('openai');
    } catch (e: any) {
      const latencyMs = Date.now() - startTime;
      if (e.name === 'AbortError') {
        console.warn(`[AI-Service] OpenAI timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`[AI-Service] OpenAI exception (${latencyMs}ms):`, e.message);
      }
      recordFailure('openai');
      lastError = e;
    }
  } else if (isCircuitOpen('openai')) {
    console.log('[AI-Service] OpenAI circuit breaker is open, skipping');
  }

  throw new Error(lastError?.message || 'All AI providers failed. Most likely due to exhausted quotas or invalid API keys.');
}
