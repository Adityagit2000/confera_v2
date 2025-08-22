import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapiApiKey = Deno.env.get('VAPI_API_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log(`Starting interview for session: ${sessionId}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the interview session
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Interview session not found');
    }

    // Generate interview questions based on type
    const questions = generateQuestionsByType(session.type);
    
    // Create VAPI call configuration
    const vapiConfig = {
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an experienced ${getInterviewerRole(session.type)} conducting a ${session.type} interview. 
            Ask one question at a time from this list: ${questions.join(', ')}. 
            Listen to the candidate's response and provide brief, encouraging feedback before moving to the next question.
            Keep responses concise and professional. After all questions, summarize the interview.`
          }
        ]
      },
      voice: {
        provider: "playht",
        voiceId: "jennifer"
      },
      firstMessage: `Hello! I'm your AI interviewer today. We'll be conducting a ${session.type.replace('_', ' ')} interview. Are you ready to begin?`
    };

    // Create VAPI call (mock implementation for demo)
    const mockVapiCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const joinUrl = `https://vapi.ai/call/${mockVapiCallId}`;

    console.log(`Generated VAPI call ID: ${mockVapiCallId}`);

    // Update session with VAPI call ID and set status to active
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        vapi_call_id: mockVapiCallId,
        status: 'active'
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      throw updateError;
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
          vapi_call_id: mockVapiCallId
        }
      });

    return new Response(JSON.stringify({
      success: true,
      joinUrl,
      vapiCallId: mockVapiCallId,
      questions,
      message: 'Interview session started successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in start-interview function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to start interview', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateQuestionsByType(type: string): string[] {
  const questions = {
    'dsa': [
      "Can you explain the difference between an array and a linked list?",
      "How would you reverse a linked list?",
      "Explain the concept of Big O notation with examples.",
      "How would you find the middle element of a linked list?",
      "Describe a scenario where you'd use a hash table.",
      "What's the difference between BFS and DFS?"
    ],
    'system_design': [
      "How would you design a URL shortener like bit.ly?",
      "Explain how you would design a chat application like WhatsApp.",
      "How would you handle scaling a web application for millions of users?",
      "Describe the architecture of a content delivery network (CDN).",
      "How would you design a rate limiting system?",
      "Explain the trade-offs between SQL and NoSQL databases."
    ],
    'hr': [
      "Tell me about yourself and your background.",
      "What interests you about this role and our company?",
      "Describe a challenging project you worked on recently.",
      "How do you handle stress and tight deadlines?",
      "Tell me about a time you had to work with a difficult team member.",
      "Where do you see yourself in five years?"
    ]
  };

  return questions[type as keyof typeof questions] || questions['hr'];
}

function getInterviewerRole(type: string): string {
  const roles = {
    'dsa': 'Senior Software Engineer',
    'system_design': 'Principal Engineer',
    'hr': 'HR Manager'
  };

  return roles[type as keyof typeof roles] || 'Interviewer';
}