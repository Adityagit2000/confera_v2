/**
 * Request Context — Shared edge function middleware
 * 
 * Provides:
 * - Correlation ID generation per request
 * - Structured logging with automatic context injection
 * - Request timing (latency tracking)
 * - Safe error serialization (strips stack traces in production)
 */

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

export interface RequestContext {
  correlationId: string
  functionName: string
  startTime: number
  userId?: string
}

/**
 * Create a request context for an edge function invocation
 */
export function createRequestContext(functionName: string, userId?: string): RequestContext {
  return {
    correlationId: generateCorrelationId(),
    functionName,
    startTime: Date.now(),
    userId,
  }
}

/**
 * Structured logger with automatic context injection
 */
export function createLogger(ctx: RequestContext) {
  const prefix = `[${ctx.functionName}][${ctx.correlationId}]`

  return {
    info: (step: string, detail?: string) => {
      console.log(`${prefix} ${step}${detail ? `: ${detail}` : ''}`)
    },
    warn: (step: string, detail?: string) => {
      console.warn(`${prefix} ⚠ ${step}${detail ? `: ${detail}` : ''}`)
    },
    error: (step: string, error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`${prefix} ✗ ${step}: ${msg}`)
    },
    step: (num: number, label: string) => {
      console.log(`${prefix} Step ${num}: ${label}`)
    },
    /** Log elapsed time since request start */
    timing: (label: string) => {
      const elapsed = Date.now() - ctx.startTime
      console.log(`${prefix} ⏱ ${label}: ${elapsed}ms`)
    },
  }
}

/**
 * Sanitize errors for API responses.
 * - In production: strips stack traces, returns only message
 * - Returns consistent { error, details? } shape
 */
export function sanitizeError(error: unknown): { error: string; details?: string } {
  if (error instanceof Error) {
    return {
      error: error.message,
      // Only include stack in non-production (Deno doesn't set NODE_ENV, check ENVIRONMENT)
      details: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined,
    }
  }
  return { error: String(error) }
}

/**
 * Validate required environment variables.
 * Throws with clear message if any are missing.
 */
export function requireEnvVars(...names: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  const missing: string[] = []

  for (const name of names) {
    const value = Deno.env.get(name)
    if (!value) {
      missing.push(name)
    } else {
      result[name] = value
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return result
}

/**
 * Sanitize and truncate user-provided strings to prevent abuse
 */
export function sanitizeInput(input: string | undefined | null, maxLength: number = 500): string {
  if (!input) return ''
  return input
    .substring(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
}

/**
 * Basic prompt injection detection.
 * Returns true if the input contains suspicious patterns.
 */
export function detectPromptInjection(input: string): boolean {
  if (!input) return false
  const lower = input.toLowerCase()
  const patterns = [
    'ignore previous instructions',
    'ignore all previous',
    'disregard all previous',
    'forget your instructions',
    'new system prompt',
    'you are now',
    'act as if',
    'pretend you are',
    'system: ',
    '### system',
    '<|system|>',
    '[SYSTEM]',
  ]
  return patterns.some(p => lower.includes(p))
}

// ── Authentication ───────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

export interface AuthResult {
  user: any
  supabase: any
}

/**
 * Authenticate a request by validating the JWT from the Authorization header.
 * Returns the authenticated user and an admin supabase client, or null + a Response.
 * 
 * Usage:
 *   const auth = await authenticateRequest(req, corsHeaders)
 *   if (!auth) return auth.response  // 401
 *   const { user, supabase } = auth
 */
export async function authenticateRequest(
  req: Request,
  headers: Record<string, string>
): Promise<{ user: any; supabase: any; response?: never } | { user?: never; supabase?: never; response: Response }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      response: new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return {
      response: new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const token = authHeader.replace('Bearer ', '')
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return {
      response: new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }
  }

  return { user, supabase }
}

// ── Rate Limiting (simple in-memory, per-isolate) ────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

/**
 * Simple rate limiter. Returns true if the request should be allowed.
 * @param key - Unique key (e.g., userId + functionName)
 * @param maxRequests - Max requests per window
 * @param windowMs - Window size in milliseconds
 */
export function checkRateLimit(key: string, maxRequests: number = 10, windowMs: number = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

/**
 * Return a 429 response for rate-limited requests
 */
export function rateLimitResponse(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
    { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
  )
}
