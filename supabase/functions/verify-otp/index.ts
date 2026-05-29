import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, code } = await req.json()
    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Email and code are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 1. Verify OTP
    const { data: otpRecords, error: fetchError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) throw fetchError
    if (!otpRecords || otpRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const otpId = otpRecords[0].id

    // Mark as used
    await supabaseAdmin.from('otp_codes').update({ used: true }).eq('id', otpId)

    // 2. Resolve User & Reset Password
    const securePassword = crypto.randomUUID() + crypto.randomUUID()
    
    let userId: string | null = null

    // Try to find the user in the profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (profile && profile.id) {
      userId = profile.id
      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: securePassword, email_confirm: true })
      if (updateError) throw updateError
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: securePassword,
        email_confirm: true,
      })
      if (createError) {
        if (createError.message.includes('User already registered') || createError.status === 400) {
          const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
          if (listError) throw listError
          const existingUser = usersData.users.find((u: any) => u.email === email)
          if (existingUser) {
            userId = existingUser.id
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: securePassword, email_confirm: true })
            if (updateError) throw updateError
          } else {
            throw createError
          }
        } else {
          throw createError
        }
      }
    }

    // 3. Sign in to get session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: securePassword
    })

    if (signInError) throw signInError

    return new Response(JSON.stringify({ session: signInData.session }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Verify OTP Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
