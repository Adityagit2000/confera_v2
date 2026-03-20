import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- ai-interview-chat: Function called ---');

  try {
    const body = await req.json();
    const { sessionId, message, interviewType } = body;
    console.log(`Processing sessionId: ${sessionId}, type: ${interviewType}, msg: ${message?.substring(0, 30)}...`);

    if (!sessionId) throw new Error('sessionId is required');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch current session and transcript
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) throw new Error(`Session not found for ID: ${sessionId}`);

    const transcript = typeof session.transcript === 'string' 
      ? JSON.parse(session.transcript) 
      : (session.transcript || []);
    
    // Count assistant messages to determine current question index
    const questionIndex = transcript.filter((m: any) => m.role === 'assistant').length;

    // 2. Fetch latest resume analysis for the user
    const { data: latestResume } = await supabase
      .from('resumes')
      .select('parsed_data')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const resumeJsonSummary = latestResume?.parsed_data 
      ? JSON.stringify(latestResume.parsed_data) 
      : "No resume analysis available. Proceed with general background questions.";

    // 3. Handle First Message Case (Start of Interview)
    if ((!message || message.trim() === '') && transcript.length === 0) {
      console.log('Generating first message for start of interview...');
      
      const startPrompt = `
      You are a Senior ${interviewType || 'General'} Interviewer. 
      Your goal is to evaluate the candidate for a ${session.job_role || 'relevant'} position.
      
      CONTEXT:
      - Candidate Resume: ${resumeJsonSummary}
      - Track: ${interviewType}
      
      TASK: 
      Generate a welcoming first message. Mention your role and the track. 
      End by asking the first question grounded in their resume experience.
      Keep it under 3 sentences.
      `;

      const firstMsg = await callAiWithFallback({
        systemPrompt: "You are a professional AI interviewer.",
        userMessage: startPrompt,
        temperature: 0.7
      });

      const newHistory = [...transcript, { role: 'assistant', content: firstMsg }];
      await supabase.from('interview_sessions').update({ transcript: JSON.stringify(newHistory) }).eq('id', sessionId);
      
      // Increment interview usage counter
      const { data: profile } = await supabase
        .from('profiles')
        .select('interviews_used_this_month')
        .eq('id', session.user_id)
        .single();
      
      await supabase
        .from('profiles')
        .update({ interviews_used_this_month: (profile?.interviews_used_this_month || 0) + 1 })
        .eq('id', session.user_id);

      return new Response(JSON.stringify({ 
        success: true,
        response: firstMsg 
       }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 4. Normal Interview Flow: Evaluate and Generate Next Question
    const isFinalAnswer = questionIndex >= 6;

    // Multi-Track Persona Injection
    const trackLenses: Record<string, string> = {
      'technical_core': "Focus on core technical proficiency relevant to the specific job role. Ask about domain-specific knowledge, tools, methodologies, and real-world problem solving for this profession (e.g., for a Civil Engineer ask about structural analysis, for a Data Engineer ask about pipelines and PySpark).",
      'behavioral_hr': "Focus on leadership, conflict resolution, teamwork, and cultural fit. Use the STAR method to probe into their past experiences and how they handle workplace scenarios relevant to their field.",
      'scenario_case': "Focus on problem-solving in hypothetical or complex situations relevant to the job role. Ask about how they would approach domain-specific challenges, tradeoffs, and decision-making.",
      'technical': "Focus on core technical proficiency relevant to the specific job role.",
      'behavioral': "Focus on leadership, conflict resolution, and cultural fit using the STAR method.",
      'scenario': "Focus on problem-solving in hypothetical or complex situations.",
      'dsa': "Focus on data structures, algorithms, and coding problem solving.",
      'system_design': "Focus on system architecture, scalability, and design tradeoffs.",
      'hr': "Focus on behavioral questions, cultural fit, and HR screening."
    };

    const currentLens = trackLenses[interviewType?.toLowerCase()] || "Focus on their overall fit and technical depth based on their resume.";

    const systemPrompt = `
# ROLE
You are a Senior ${interviewType?.toUpperCase() || 'General'} Interviewer. Your goal is to evaluate the candidate's fit for a ${session.job_role || 'relevant'} position, specifically focusing on ${interviewType || 'general'} competencies while grounded in their actual experience.

# THE LENS (How to read the Resume)
- ${currentLens}

# CONTEXT
- Candidate Resume: ${resumeJsonSummary}
- Track: ${interviewType}

# OPERATING GUIDELINES
1. Use the Resume as the 'Case Study'. 
2. Ask 3-step deep questions: (1) The specific project task -> (2) The technical/business hurdle -> (3) The theoretical scaling/optimization.
3. Keep responses under 3 sentences.
`;
    
    const windowedTranscript = (() => {
    if (transcript.length <= 2) return transcript
    const opener = transcript[0]
    const recent = transcript.slice(-8)
    const openerAlreadyIncluded = recent.some((m: any) => m.content === opener.content)
    return openerAlreadyIncluded ? recent : [opener, ...recent]
  })()

    let conversationStr = windowedTranscript.map((m: any) => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join('\n');
    
    let evaluationPrompt = `
    Based on the following conversation and the candidate's latest answer, provide the next interviewer response.
    
    Current Conversation History:
    ${conversationStr}
    
    Candidate's New Answer:
    "${message}"
    
    Task: 
    1. Acknowledge their response briefly.
    2. If not finished (current question count is ${questionIndex}), ask the next relevant question for ${interviewType} based on YOUR ROLE and THE LENS.
    3. If 6 or more questions have been asked, conclude the interview.
    
    Respond with ONLY the text of the interviewer's next response (concise, professional). No JSON, no markdown tags.
    `;

    const nextResponseText = await callAiWithFallback({
      systemPrompt,
      userMessage: evaluationPrompt,
      temperature: 0.7
    });
    
    // 4. Update session history
    const updatedHistory = [
      ...transcript, 
      { role: 'user', content: message || 'User sent an empty message.' },
      { role: 'assistant', content: nextResponseText }
    ];

    await supabase
      .from('interview_sessions')
      .update({ 
        transcript: JSON.stringify(updatedHistory),
        status: isFinalAnswer ? 'completed' : 'in_progress'
      })
      .eq('id', sessionId);

    // 5. Save to interview_answers for the report
    const lastQuestion = transcript.length > 0 ? transcript.slice().reverse().find((m: any) => m.role === 'assistant')?.content : "Initial Question";
    await supabase.from('interview_answers').insert({
      session_id: sessionId,
      question: lastQuestion || "Initial Question",
      answer_text: message || "",
      score: null // will be evaluated in generate-feedback
    });

    return new Response(JSON.stringify({ 
      success: true,
      response: nextResponseText,
      is_complete: isFinalAnswer
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in ai-interview-chat:', error.message, error.stack);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message, 
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
