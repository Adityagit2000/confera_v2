import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- generate-test: Function called ---');

  try {
    let userId: string;
    let dbClient: any;
    const body = await req.json();
    
    // Standard authentication
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    userId = auth.user.id;
    dbClient = auth.supabase;

    const { branch, test_type, num_questions = 20 } = body;

    if (!test_type) {
      throw new Error('test_type is required');
    }

    // Fetch past test history to avoid repeating questions
    const { data: pastSessions } = await dbClient
      .from('test_sessions')
      .select('questions')
      .eq('user_id', userId)
      .eq('test_type', test_type)
      .order('created_at', { ascending: false })
      .limit(5);

    let pastQuestions = [];
    if (pastSessions && pastSessions.length > 0) {
      pastSessions.forEach((session: any) => {
        if (session.questions && Array.isArray(session.questions)) {
          pastQuestions.push(...session.questions.map((q: any) => q.question));
        }
      });
    }

    const pastQuestionsText = pastQuestions.length > 0 
      ? `DO NOT REPEAT THESE PREVIOUS QUESTIONS:\n${pastQuestions.join('\n')}` 
      : 'No previous questions for this user.';

    // Build prompt
    const systemPrompt = `You are a senior placement examiner with 15 years of experience setting papers for top Indian companies like TCS, Infosys, Wipro, Accenture, Deloitte. Generate a placement test. Rules: Never repeat a question this user has seen before (previous questions list provided). Mix difficulty: 40% easy, 40% medium, 20% hard. Include conceptual questions, application questions, and tricky edge-case questions. For technical topics include both theory and practical application. Make questions that actually test understanding not memorization. Return ONLY a JSON array of exactly ${num_questions} question objects, each with: question (string), options (array of 4 strings), correct_answer (0-3 index), explanation (string), topic (string), difficulty (easy/medium/hard).`;

    const userMessage = `Generate a test for test type: ${test_type}. Branch: ${branch || 'Any'}.
${pastQuestionsText}`;

    const responseText = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.7,
      maxTokens: 4000,
      responseMimeType: 'application/json'
    });

    let questions: any;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) {
        // AI might return { "questions": [...] }
        if (questions.questions && Array.isArray(questions.questions)) {
          questions = questions.questions;
        } else {
          throw new Error('Expected JSON array');
        }
      }
    } catch {
      console.error('generate-test: Failed to parse AI response:', responseText.substring(0, 300));
      throw new Error('AI returned invalid JSON for test questions');
    }

    console.log(`generate-test: Generated ${questions.length} questions for user ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      questions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in generate-test:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
