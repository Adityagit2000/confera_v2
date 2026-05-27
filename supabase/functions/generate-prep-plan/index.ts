import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- generate-prep-plan: Function called ---');

  try {
    let userId: string;
    let dbClient: any;
    const body = await req.json();
    
    // Allow admin bypass with Service Role Key
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (authHeader === `Bearer ${serviceKey}`) {
      userId = body.userId;
      if (!userId) throw new Error('userId required for admin bypass');
      const { createClient } = await import('npm:@supabase/supabase-js@2');
      dbClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!);
    } else {
      // Standard authentication
      const auth = await authenticateRequest(req, corsHeaders)
      if ('response' in auth) return auth.response
      userId = auth.user.id;
      dbClient = auth.supabase;
    }

    // 1. Fetch user skill memory
    const { data: skillMemory } = await dbClient
      .from('user_skill_memory')
      .select('*')
      .eq('user_id', userId)
      .single();

    let memory = skillMemory;
    if (!memory) {
      console.log('generate-prep-plan: No skill memory found, using defaults.');
      memory = {
        communication: 50, technical_depth: 50, problem_solving: 50, domain_knowledge: 50,
        weak_areas: ['General Interview Strategy'], filler_word_rate: 0, avg_answer_length: 0, total_sessions: 0
      };
    }

    // 2a. Fetch user profile and target role
    const { data: profile } = await dbClient
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    
    const { data: resume } = await dbClient
      .from('resumes')
      .select('parsed_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    const userName = profile?.name?.split(' ')[0] || 'Candidate';
    const targetRole = resume?.parsed_data?.target_role || resume?.parsed_data?.job_title || resume?.parsed_data?.role || 'Software Engineer';

    // 2b. Fetch last 3 sessions to find poorly answered questions
    const { data: last3Sessions } = await dbClient
      .from('interview_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
      
    const last3SessionIds = last3Sessions?.map((s: any) => s.id) || [];
    let poorAnswersText = 'No recently poorly answered questions.';
    if (last3SessionIds.length > 0) {
      const { data: poorAnswers } = await dbClient
        .from('interview_answers')
        .select('question, score')
        .in('session_id', last3SessionIds)
        .lt('score', 6)
        .order('score', { ascending: true })
        .limit(10);
        
      if (poorAnswers && poorAnswers.length > 0) {
        poorAnswersText = poorAnswers.map((a: any) => `- ${a.question} (Score: ${a.score}/10)`).join('\n');
      }
    }

    // 2c. Fetch recent transcript embeddings to find repeating topics
    const { data: recentTranscripts } = await dbClient
      .from('transcript_embeddings')
      .select('question, interview_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
      
    const recentQuestionsText = (recentTranscripts || [])
      .map((t: any) => t.question)
      .join('\n') || 'No recent transcript data.';

    // 3. Build prompt
    const systemPrompt = `You are a brutal, highly analytical, and deeply personal senior interview coach. You don't sugarcoat. You create highly specific, actionable study plans based on exact data.`;

    const userMessage = `Create a brutally specific, highly personalized 7-day preparation plan for ${userName}.
Target Role: ${targetRole}

SKILL PROFILE (Exact Scores out of 100):
- Communication: ${memory.communication}
- Technical Depth: ${memory.technical_depth}
- Problem Solving: ${memory.problem_solving}
- Domain Knowledge: ${memory.domain_knowledge}
- Weak Areas: ${(memory.weak_areas || []).join(', ') || 'None identified yet'}
- Filler Word Rate: ${memory.filler_word_rate || 0}%
- Average Answer Length: ${memory.avg_answer_length || 0} words

SPECIFIC QUESTIONS ANSWERED POORLY (Score < 6/10 in last 3 sessions):
${poorAnswersText}

RECENT QUESTIONS ASKED ACROSS SESSIONS (Analyze these to find repeating topics they keep facing):
${recentQuestionsText}

INSTRUCTIONS:
1. NO GENERIC ADVICE. Do NOT say "improve technical depth" or "study databases".
2. Name specific topics by name (e.g., "Practice SQL window functions - you've been asked this 3 times and scored poorly").
3. Give specific resources (e.g., "Read Designing Data-Intensive Applications Chapter 5" or "Practice LeetCode #146 LRU Cache").
4. The coaching note must feel like a human coach wrote it directly to ${userName}. Example: "${userName}, in your last session you struggled with database sharding. Focus on that today. Your filler word rate is also too high at ${memory.filler_word_rate || 0}%."
5. Set specific daily targets with exact time durations.

Return JSON only:
{
  "weekly_focus": "One clear sentence describing the week's brutally specific focus.",
  "coaching_note": "2-3 sentences of personal, direct coaching advice starting with their name (${userName}), referencing their exact weak questions and scores.",
  "priority_interview_type": "dsa|system_design|hr|behavioral|consulting|mckinsey_de",
  "daily_tasks": [
    {"day": 1, "topic": "Specific Topic (e.g., SQL Window Functions)", "task": "Specific task and specific resource", "duration_minutes": 30},
    // ... 7 days
  ]
}`;

    const responseText = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.4,
      maxTokens: 1024,
      responseMimeType: 'application/json'
    });

    let plan: any;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      plan = JSON.parse(cleaned);
    } catch {
      console.error('generate-prep-plan: Failed to parse AI response:', responseText.substring(0, 300));
      throw new Error('AI returned invalid JSON for prep plan');
    }

    // Validate plan structure
    if (!plan.weekly_focus || !plan.daily_tasks || !Array.isArray(plan.daily_tasks)) {
      throw new Error('Invalid plan structure from AI');
    }

    // 4. Insert the plan
    const { error: insertError } = await dbClient
      .from('prep_plans')
      .insert({
        user_id: userId,
        weekly_focus: plan.weekly_focus,
        coaching_note: plan.coaching_note || '',
        priority_interview_type: plan.priority_interview_type || 'hr',
        daily_tasks: plan.daily_tasks
      });

    if (insertError) {
      console.error('generate-prep-plan: Insert failed:', insertError.message);
      throw insertError;
    }

    console.log(`generate-prep-plan: Created 7-day plan for user ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      plan: {
        weekly_focus: plan.weekly_focus,
        priority_interview_type: plan.priority_interview_type,
        days: plan.daily_tasks.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in generate-prep-plan:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
