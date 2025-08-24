import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('VAPI Webhook received:', JSON.stringify(payload, null, 2));
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { message } = payload;
    
    if (message?.type === 'end-of-call-report') {
      console.log('Processing end-of-call report...');
      
      // Extract session ID from customer number
      const customerNumber = message.call?.customer?.number || '';
      const sessionId = customerNumber.replace('session_', '');
      
      if (!sessionId) {
        console.error('No session ID found in customer number:', customerNumber);
        return new Response('OK', { status: 200, headers: corsHeaders });
      }
      
      // Save call transcript and analysis
      const transcript = message.transcript || '';
      const summary = message.summary || '';
      const callDuration = message.call?.endedAt && message.call?.startedAt 
        ? Math.round((new Date(message.call.endedAt).getTime() - new Date(message.call.startedAt).getTime()) / 1000)
        : 0;
        
      console.log(`Processing interview session: ${sessionId}, duration: ${callDuration}s`);
      
      // Update interview session with real data
      const { error: sessionUpdateError } = await supabase
        .from('interview_sessions')
        .update({
          status: 'completed',
          duration_sec: callDuration,
          transcript,
          summary
        })
        .eq('vapi_call_id', message.call?.id);
        
      if (sessionUpdateError) {
        console.error('Error updating session:', sessionUpdateError);
      }
      
      // Store individual responses if available
      if (message.messages && Array.isArray(message.messages)) {
        const answers = [];
        
        for (const msg of message.messages) {
          if (msg.role === 'user' && msg.message) {
            answers.push({
              session_id: sessionId,
              question: msg.context || 'Interview question',
              answer: msg.message,
              created_at: new Date().toISOString()
            });
          }
        }
        
        if (answers.length > 0) {
          const { error: answersError } = await supabase
            .from('interview_answers')
            .insert(answers);
            
          if (answersError) {
            console.error('Error saving interview answers:', answersError);
          } else {
            console.log(`Saved ${answers.length} interview answers`);
          }
        }
      }
      
      // Trigger feedback generation with real data
      const { error: feedbackError } = await supabase.functions.invoke('generate-feedback', {
        body: { sessionId, transcript, summary, callDuration }
      });
      
      if (feedbackError) {
        console.error('Error triggering feedback generation:', feedbackError);
      } else {
        console.log('Feedback generation triggered for session:', sessionId);
      }
    }
    
    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });
    
  } catch (error: any) {
    console.error('Error in VAPI webhook:', error);
    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });
  }
});