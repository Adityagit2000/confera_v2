import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Health Check Endpoint
 * 
 * Verifies connectivity to all critical services:
 * - Supabase Database
 * - Gemini API
 * - Groq API
 * 
 * Use this for uptime monitoring (e.g., UptimeRobot, Vercel cron checks)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

  // 1. Supabase Database check
  try {
    const dbStart = Date.now()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      checks.database = { status: 'error', error: 'Missing env vars' }
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
      
      checks.database = error
        ? { status: 'error', error: error.message, latencyMs: Date.now() - dbStart }
        : { status: 'ok', latencyMs: Date.now() - dbStart }
    }
  } catch (e: any) {
    checks.database = { status: 'error', error: e.message }
  }

  // 2. Gemini API check (lightweight — just verify the endpoint responds)
  try {
    const geminiStart = Date.now()
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    
    if (!geminiKey) {
      checks.gemini = { status: 'error', error: 'GEMINI_API_KEY not set' }
    } else {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
          { signal: controller.signal }
        )
        checks.gemini = resp.ok 
          ? { status: 'ok', latencyMs: Date.now() - geminiStart }
          : { status: 'degraded', error: `HTTP ${resp.status}`, latencyMs: Date.now() - geminiStart }
      } finally {
        clearTimeout(timeout)
      }
    }
  } catch (e: any) {
    checks.gemini = { status: 'error', error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message }
  }

  // 3. Groq API check
  try {
    const groqStart = Date.now()
    const groqKey = Deno.env.get('GROQ_API_KEY')
    
    if (!groqKey) {
      checks.groq = { status: 'error', error: 'GROQ_API_KEY not set' }
    } else {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      try {
        const resp = await fetch(
          'https://api.groq.com/openai/v1/models',
          { 
            headers: { 'Authorization': `Bearer ${groqKey}` },
            signal: controller.signal 
          }
        )
        checks.groq = resp.ok 
          ? { status: 'ok', latencyMs: Date.now() - groqStart }
          : { status: 'degraded', error: `HTTP ${resp.status}`, latencyMs: Date.now() - groqStart }
      } finally {
        clearTimeout(timeout)
      }
    }
  } catch (e: any) {
    checks.groq = { status: 'error', error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message }
  }

  // Overall status
  const allOk = Object.values(checks).every(c => c.status === 'ok')
  const anyError = Object.values(checks).some(c => c.status === 'error')

  return new Response(JSON.stringify({
    status: allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    checks
  }), {
    status: allOk ? 200 : anyError ? 503 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
