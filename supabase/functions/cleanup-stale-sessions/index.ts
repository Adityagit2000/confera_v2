import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    // Authenticate request (Admin Only)
    const authHeader = req.headers.get('Authorization')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceKey || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Service Role required' }), { 
        status: 401, 
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
      })
    }
    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const twoHoursAgo = new Date(
      Date.now() - 2 * 60 * 60 * 1000
    ).toISOString()

    const { data: staleSessions, error: fetchError } = await supabase
      .from('interview_sessions')
      .select('id, user_id, job_role, type')
      .eq('status', 'active')
      .lt('created_at', twoHoursAgo)

    if (fetchError) throw fetchError

    if (!staleSessions || staleSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, cleaned: 0 }),
        { headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        summary: 'Session ended automatically — candidate disconnected or navigated away.'
      })
      .eq('status', 'active')
      .lt('created_at', twoHoursAgo)

    const eventLogs = staleSessions.map(session => ({
      user_id: session.user_id,
      name: 'session_auto_closed',
      payload: {
        session_id: session.id,
        job_role: session.job_role,
        type: session.type,
        reason: 'stale_active_timeout'
      }
    }))

    await supabase
      .from('event_logs')
      .insert(eventLogs)
      .catch(() => {})

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleaned: staleSessions.length 
      }),
      { headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } 
      }
    )
  }
})
