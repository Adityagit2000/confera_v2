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

    // 2. Fetch last 10 questions asked
    const { data: recentAnswers } = await dbClient
      .from('interview_answers')
      .select('question, session_id')
      .order('created_at', { ascending: false })
      .limit(10);

    // Filter to only this user's answers via sessions
    const { data: userSessions } = await dbClient
      .from('interview_sessions')
      .select('id')
      .eq('user_id', userId);

    const userSessionIds = new Set((userSessions || []).map(s => s.id));
    const userRecentQuestions = (recentAnswers || [])
      .filter(a => userSessionIds.has(a.session_id))
      .map(a => a.question);

    const recentQuestionsText = userRecentQuestions.length > 0
      ? userRecentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : 'No recent questions found.';

    // 3. Build prompt
    const systemPrompt = `You are a senior interview preparation coach. Create highly personalized, actionable study plans based on real performance data.`;

    const userMessage = `Based on this candidate's performance profile, generate a 7-day preparation plan.

SKILL PROFILE:
- Communication: ${memory.communication}/100
- Technical Depth: ${memory.technical_depth}/100
- Problem Solving: ${memory.problem_solving}/100
- Domain Knowledge: ${memory.domain_knowledge}/100
- Weak Areas: ${(memory.weak_areas || []).join(', ') || 'None identified yet'}
- Filler Word Rate: ${memory.filler_word_rate || 0}%
- Average Answer Length: ${memory.avg_answer_length || 0} words
- Total Sessions Completed: ${memory.total_sessions || 0}

RECENTLY COVERED TOPICS (avoid repeating):
${recentQuestionsText}

Return JSON only:
{
  "weekly_focus": "one clear sentence describing the week's focus",
  "coaching_note": "2-3 sentences of personal coaching advice referencing their specific weak areas by name",
  "priority_interview_type": "dsa|system_design|hr|behavioral|consulting|mckinsey_de",
  "daily_tasks": [
    {"day": 1, "topic": "Topic Name", "task": "Specific task description", "duration_minutes": 30},
    {"day": 2, "topic": "...", "task": "...", "duration_minutes": 45},
    {"day": 3, "topic": "...", "task": "...", "duration_minutes": 30},
    {"day": 4, "topic": "...", "task": "...", "duration_minutes": 60},
    {"day": 5, "topic": "...", "task": "...", "duration_minutes": 30},
    {"day": 6, "topic": "...", "task": "...", "duration_minutes": 45},
    {"day": 7, "topic": "...", "task": "...", "duration_minutes": 30}
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
