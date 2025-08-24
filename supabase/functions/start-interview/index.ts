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
    
    // Create VAPI assistant configuration
    const assistantConfig = {
      name: `${getInterviewerRole(session.type)} Interviewer`,
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an experienced ${getInterviewerRole(session.type)} conducting a ${session.type.replace('_', ' ')} interview. 

INTERVIEW PROCESS:
1. Start with a friendly greeting and explain the interview format
2. Ask questions ONE AT A TIME from this list: ${questions.join('; ')}
3. Wait for the candidate's complete response before asking the next question
4. Provide brief, encouraging feedback after each answer
5. After all questions are completed, provide a brief summary of the interview

IMPORTANT GUIDELINES:
- Ask only ONE question at a time and wait for the response
- Keep your feedback brief (1-2 sentences max)
- Be encouraging and professional throughout
- If the candidate asks for clarification, provide it
- Take notes on their responses for evaluation
- The interview should last approximately 15-20 minutes

Remember: You are evaluating their ${session.type === 'dsa' ? 'technical problem-solving skills' : session.type === 'system_design' ? 'architectural thinking and system design knowledge' : 'behavioral responses and cultural fit'}.`
          }
        ],
        temperature: 0.7,
        maxTokens: 150
      },
      voice: {
        provider: "playht",
        voiceId: "jennifer"
      },
      firstMessage: `Hello! I'm your AI interviewer for today's ${session.type.replace('_', ' ')} interview. I'll be asking you several questions to assess your skills and fit for the role. The interview should take about 15-20 minutes. Are you ready to begin?`,
      recordingEnabled: true,
      endCallMessage: "Thank you for completing the interview. Your responses have been recorded and will be analyzed to generate your feedback report.",
      serverUrl: `${supabaseUrl}/functions/v1/vapi-webhook`
    };

    // Create real VAPI call
    console.log('Creating VAPI assistant call...');
    const vapiResponse = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistant: assistantConfig,
        phoneNumberId: null, // For web calls
        customer: {
          number: `session_${sessionId}` // Custom identifier
        }
      })
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error('VAPI API Error:', errorText);
      throw new Error(`VAPI API call failed: ${errorText}`);
    }

    const vapiData = await vapiResponse.json();
    const vapiCallId = vapiData.id;
    const joinUrl = vapiData.webCallUrl || `https://vapi.ai/call/${vapiCallId}`;

    console.log(`Created VAPI call ID: ${vapiCallId}`);

    // Update session with VAPI call ID and set status to active
    const { error: updateError } = await supabase
      .from('interview_sessions')
      .update({
        vapi_call_id: vapiCallId,
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
          vapi_call_id: vapiCallId
        }
      });

    return new Response(JSON.stringify({
      success: true,
      joinUrl,
      vapiCallId,
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