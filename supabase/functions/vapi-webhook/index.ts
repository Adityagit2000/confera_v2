import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '';

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
        const responsesToInsert: any[] = [];
        
        for (const msg of message.messages) {
          if (msg.role === 'user' && msg.message) {
            responsesToInsert.push({
              session_id: sessionId,
              question_id: null,
              answer_text: msg.message,
              answer_transcript: msg.message,
              raw_audio_url: null,
              created_at: new Date().toISOString()
            });
          }
        }

        if (responsesToInsert.length > 0) {
          const { data: insertedResponses, error: responsesError } = await supabase
            .from('interview_responses')
            .insert(responsesToInsert)
            .select();

          if (responsesError) {
            console.error('Error saving interview responses:', responsesError);
          } else {
            console.log(`Saved ${insertedResponses?.length || 0} interview responses`);

            // For each response, generate an LLM-based evaluation
            for (const response of insertedResponses || []) {
              try {
                const evaluation = await evaluateAnswerWithLLM(
                  response.answer_text || response.answer_transcript || '',
                  message.call?.topic || 'general interview'
                );

                const { error: evalError } = await supabase
                  .from('response_evaluations')
                  .insert({
                    session_id: sessionId,
                    response_id: response.id,
                    score: evaluation.score,
                    technical_score: evaluation.technical_score,
                    communication_score: evaluation.communication_score,
                    strengths: evaluation.strengths,
                    weaknesses: evaluation.weaknesses,
                    improvement_notes: evaluation.improvement_notes,
                    raw_json: evaluation
                  });

                if (evalError) {
                  console.error('Error inserting response evaluation:', evalError);
                }
              } catch (evalErr) {
                console.error('Error evaluating response with LLM:', evalErr);
              }
            }
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

// Simple per-answer evaluation using Gemini, returning structured JSON
async function evaluateAnswerWithLLM(answer: string, topic: string) {
  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY not configured, returning default evaluation');
    return {
      score: 70,
      technical_score: 70,
      communication_score: 75,
      strengths: ['Clear baseline explanation'],
      weaknesses: ['Could include more specific, concrete examples'],
      improvement_notes: ['Add detailed examples and quantify impact where possible']
    };
  }

  const prompt = `You are evaluating a candidate's answer in a voice-based interview.

TOPIC: ${topic}

ANSWER:
${answer}

Return a STRICT JSON object with this shape and nothing else:
{
  "score": number,                  // overall score 0-100
  "technical_score": number,        // 0-100
  "communication_score": number,    // 0-100
  "strengths": string[],            // bullet-point strengths
  "weaknesses": string[],           // bullet-point weaknesses
  "improvement_notes": string[]     // concrete, actionable improvement notes
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'You are an expert technical interviewer. Always respond with valid JSON only.\n\n' +
                  prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        },
      }),
    },
  );

  if (!response.ok) {
    console.error('Gemini evaluation API request failed:', await response.text());
    return {
      score: 70,
      technical_score: 70,
      communication_score: 75,
      strengths: ['Clear baseline explanation'],
      weaknesses: ['Could include more specific, concrete examples'],
      improvement_notes: ['Add detailed examples and quantify impact where possible']
    };
  }

  const data = await response.json();
  const raw =
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ')?.trim() ??
    '';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_err) {
    console.error('Failed to parse JSON from LLM, content was:', raw);
    parsed = {
      score: 70,
      technical_score: 70,
      communication_score: 75,
      strengths: ['Clear baseline explanation'],
      weaknesses: ['Could include more specific, concrete examples'],
      improvement_notes: ['Add detailed examples and quantify impact where possible']
    };
  }

  return parsed;
}