import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- verify-payment: Function called ---');

  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      userId,
      plan,
      billingCycle,
      amount
    } = await req.json();

    console.log(`Verifying payment - Order: ${razorpay_order_id}, User: ${userId}, Plan: ${plan}`);

    // Verify signature
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET is missing');
      throw new Error('Payment configuration missing on server');
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    
    const keyData = new TextEncoder().encode(keySecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(body)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch!', { expected: expectedSignature, received: razorpay_signature });
      throw new Error('Payment verification failed - invalid signature');
    }

    console.log('Signature verified successfully. Updating database...');

    // Payment is verified - update database
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expiresAt = new Date();
    if (billingCycle === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Update user profile to pro
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        plan: 'pro',
        plan_expires_at: expiresAt.toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw profileError;
    }

    // Save subscription record
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        razorpay_payment_id,
        razorpay_order_id,
        plan,
        billing_cycle: billingCycle,
        amount,
        currency: 'INR',
        status: 'active',
        expires_at: expiresAt.toISOString()
      });

    if (subError) {
      console.error('Subscription insert error:', subError);
      throw subError;
    }

    console.log('Payment verification and database update complete.');

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified and plan upgraded' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Edge Function Catch Block:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
