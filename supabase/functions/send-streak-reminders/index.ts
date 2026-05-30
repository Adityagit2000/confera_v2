import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Service Role required' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Initialize Supabase Client with Service Role Key to bypass RLS and read all profiles
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Fetching profiles and interview sessions...')

    // 1. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name')

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`)
    }

    // 2. Fetch all interview sessions to calculate streaks
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select('user_id, created_at')
      .order('created_at', { ascending: false })

    if (sessionsError) {
      throw new Error(`Failed to fetch interview sessions: ${sessionsError.message}`)
    }

    // Group sessions by user
    const userSessionsMap = new Map<string, string[]>()
    sessions.forEach(session => {
      const userId = session.user_id
      // Convert timestamp to YYYY-MM-DD in UTC
      const dateStr = new Date(session.created_at).toISOString().split('T')[0]
      
      if (!userSessionsMap.has(userId)) {
        userSessionsMap.set(userId, [])
      }
      
      const dates = userSessionsMap.get(userId)!
      if (!dates.includes(dateStr)) {
        dates.push(dateStr)
      }
    })

    const todayStr = new Date().toISOString().split('T')[0]
    
    // Calculate yesterday's date string
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    console.log(`Streak calculation context: Today = ${todayStr}, Yesterday = ${yesterdayStr}`)

    const usersAtRisk: Array<{ email: string; name: string; streakDays: number }> = []

    // 3. Evaluate streaks for each user
    profiles.forEach(profile => {
      if (!profile.email) return

      const dates = userSessionsMap.get(profile.id) || []
      
      if (dates.length === 0) {
        // No interviews completed ever
        return
      }

      // Check if they already did an interview today
      if (dates.includes(todayStr)) {
        // Streak is safe for today
        return
      }

      // Check if their last interview was yesterday
      if (dates.includes(yesterdayStr)) {
        // They are at risk! Let's calculate the streak count going backward from yesterday
        let streakCount = 0
        const checkDate = new Date(yesterday)
        
        while (true) {
          const checkDateStr = checkDate.toISOString().split('T')[0]
          if (dates.includes(checkDateStr)) {
            streakCount++
            // Move back 1 day
            checkDate.setDate(checkDate.getDate() - 1)
          } else {
            break
          }
        }

        if (streakCount > 0) {
          usersAtRisk.push({
            email: profile.email,
            name: profile.name || 'Candidate',
            streakDays: streakCount
          })
        }
      }
    })

    console.log(`Found ${usersAtRisk.length} users at risk of losing their streak.`)

    // 4. Send email reminders
    const sendPromises = usersAtRisk.map(async (user) => {
      try {
        console.log(`Sending streak reminder to ${user.email} (Streak: ${user.streakDays} days)`)
        
        const { data: emailRes, error: emailErr } = await supabase.functions.invoke('send-email', {
          body: {
            to: user.email,
            template: 'streak-reminder',
            data: {
              userName: user.name,
              streakDays: user.streakDays
            }
          }
        })

        if (emailErr) {
          console.error(`Error sending email to ${user.email}:`, emailErr)
          return { email: user.email, success: false, error: emailErr }
        }
        
        return { email: user.email, success: true }
      } catch (e) {
        console.error(`Exception sending email to ${user.email}:`, e)
        return { email: user.email, success: false, error: e }
      }
    })

    const results = await Promise.all(sendPromises)
    const successful = results.filter(r => r.success).length

    return new Response(JSON.stringify({ 
      processedUsersCount: profiles.length,
      usersAtRiskCount: usersAtRisk.length,
      emailsSentCount: successful,
      details: results
    }), {
      status: 200,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error in send-streak-reminders function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
    })
  }
})
