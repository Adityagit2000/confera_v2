import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId, job_role } = await req.json()
    
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    console.log(`Starting interview for session: ${sessionId}${job_role ? ` with role: ${job_role}` : ''}`)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // First check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Interview session not found')
    }

    // Update session status to active and set job_role if provided
    const updateData: any = {
      status: 'active'
    }
    
    if (job_role) {
      updateData.job_role = job_role
    }

    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update(updateData)
      .eq('id', sessionId)

    if (updateError) {
      console.error('Error updating session:', updateError)
      throw updateError
    }

    // Log the event
    await supabase
      .from('event_logs')
      .insert({
        user_id: session.user_id,
        name: 'interview_started',
        payload: {
          session_id: sessionId,
          type: session.type,
          job_role: job_role || session.job_role
        }
      })

    return new Response(JSON.stringify({
      success: true,
      message: 'Interview session started successfully',
      sessionId,
      job_role: job_role || session.job_role
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Error in start-interview function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start interview', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})