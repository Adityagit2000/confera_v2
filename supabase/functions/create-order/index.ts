import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  
  const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  console.log('--- create-order: Function called ---');

  try {
    let body;
    try {
      body = await req.json();
      console.log('Request body received:', JSON.stringify(body));
    } catch (e: any) {
      console.error('Failed to parse request body:', e.message);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { plan, billingCycle, userId } = body;
    if (user.id !== userId) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    console.log(`Order request - Plan: ${plan}, Cycle: ${billingCycle}, User: ${userId}`);
    
    if (!plan || !billingCycle || !userId) {
      console.error('Missing required fields:', { plan, billingCycle, userId });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: plan, billingCycle, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amounts: Record<string, number> = {
      pro_monthly: 79900,  // ₹799 in paise
      pro_yearly: 499900   // ₹4,999 in paise
    };

    const amountKey = `${plan}_${billingCycle}`;
    console.log('Amount key:', amountKey);
    const amount = amounts[amountKey];

    if (!amount) {
      console.error(`Invalid plan or billing cycle: ${amountKey}`);
      return new Response(
        JSON.stringify({ error: `Invalid plan or billing cycle: ${amountKey}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    
    console.log('Key ID present:', !!keyId);
    console.log('Key ID value (truncated):', keyId?.substring(0, 15));
    console.log('Key Secret present:', !!keySecret);

    if (!keyId || !keySecret) {
      console.error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from environment');
      return new Response(
        JSON.stringify({ error: 'Razorpay credentials not configured in Supabase secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Initiating Razorpay API call...');
    const credentials = base64Encode(`${keyId}:${keySecret}`);

    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        notes: { plan, billingCycle, userId }
      })
    });

    const responseText = await orderResponse.text();
    console.log('Razorpay response status:', orderResponse.status);
    console.log('Razorpay response body:', responseText);
    
    if (!orderResponse.ok) {
      console.error('Razorpay Error Response:', responseText);
      return new Response(
        JSON.stringify({ 
          error: 'Razorpay order creation failed', 
          details: responseText,
          status: orderResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order = JSON.parse(responseText);
    console.log(`Order created successfully: ${order.id}`);

    return new Response(JSON.stringify({ orderId: order.id, amount, currency: 'INR' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Edge Function Catch Block:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
