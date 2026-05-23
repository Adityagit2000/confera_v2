import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate request
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    const { user, supabase } = auth

    const { sessionId, job_role } = await req.json()
    
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    console.log(`Starting interview for session: ${sessionId}${job_role ? ` with role: ${job_role}` : ''}`)

    // First check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Interview session not found')
    }

    // Verify the session belongs to the authenticated user
    if (session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: session does not belong to this user' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // --- PAYWALL ENFORCEMENT ---
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, plan_expires_at, interviews_used_this_month, is_founder')
      .eq('id', session.user_id)
      .single()

    if (profileError) {
      console.error('Error fetching profile for paywall check:', profileError)
      throw new Error('Failed to verify subscription status')
    }

    // Founders get unlimited access — skip all limits
    const isFounder = profile.is_founder === true
    const isPro = isFounder || (profile.plan === 'pro' && 
      (profile.plan_expires_at ? new Date(profile.plan_expires_at) > new Date() : false))
    
    if (!isPro && (profile.interviews_used_this_month || 0) >= 2) {
      return new Response(JSON.stringify({ 
        error: 'Interview limit reached', 
        details: 'You have used your 2 free interviews for this month. Upgrade to Pro for unlimited access.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    // ---------------------------

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

    // Increment usage counter for non-pro users
    if (!isPro) {
      const { error: incrementError } = await supabase
        .from('profiles')
        .update({ interviews_used_this_month: (profile.interviews_used_this_month || 0) + 1 })
        .eq('id', session.user_id)
      
      if (incrementError) {
        console.error('Error incrementing interview usage counter:', incrementError)
      }
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