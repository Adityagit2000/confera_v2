import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: sessions, error } = await supabase
      .from('interview_sessions')
      .select('user_id')
      .eq('status', 'completed');
      
    if (error) throw error;

    const uniqueUsers = [...new Set(sessions.map(s => s.user_id))];

    const { data: existingPlans, error: plansError } = await supabase
      .from('prep_plans')
      .select('user_id');

    if (plansError) throw plansError;

    const usersWithPlans = new Set(existingPlans.map(p => p.user_id));
    const usersToBackfill = uniqueUsers.filter(u => !usersWithPlans.has(u));

    const results = [];
    
    // We'll just call the modified generate-prep-plan with the service role key!
    for (const userId of usersToBackfill) {
      console.log(`Triggering generate-prep-plan for ${userId}...`);
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-prep-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        results.push({ userId, status: res.ok ? 'success' : 'failed', data });
      } catch (err) {
        results.push({ userId, status: 'error', error: err.message });
      }
      
      // Delay for rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      backfilledCount: usersToBackfill.length, 
      results 
    }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
