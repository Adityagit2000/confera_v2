import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  console.log('--- generate-prep-plan: Function called ---');

  try {
    let userId: string;
    let dbClient: any;
    const body = await req.json();
    
    // Allow admin bypass with Service Role Key
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
      userId = body.userId;
      if (!userId) throw new Error('userId required for admin bypass');
      const { createClient } = await import('npm:@supabase/supabase-js@2');
      dbClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!);
    } else {
      // Standard authentication
      const auth = await authenticateRequest(req, getCorsHeaders(req.headers.get('origin')))
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
      .select('name, target_interview_date')
      .eq('id', userId)
      .single();
    
    const { data: resume } = await dbClient
      .from('resumes')
      .select('parsed_data, ats_score, keywords_missing')
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

    // 2d. Calculate timeline
    let daysRemaining = 30; // Default
    if (profile?.target_interview_date) {
      const target = new Date(profile.target_interview_date);
      const now = new Date();
      const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0 && diff <= 100) {
        daysRemaining = diff;
      }
    }
    const maxDaysToPlan = Math.min(daysRemaining, 14); // Plan up to 14 days at a time to keep LLM response manageable

    // 2e. Fetch recent test sessions
    const { data: recentTests } = await dbClient
      .from('test_sessions')
      .select('score, subjects_covered')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    
    let testsText = 'No recent practice test data.';
    if (recentTests && recentTests.length > 0) {
      testsText = recentTests.map((t: any) => `- Score: ${t.score}%. Subjects: ${t.subjects_covered}`).join('\n');
    }

    // 3. Build prompt
    const systemPrompt = `You are a brutal, highly analytical, and deeply personal senior interview coach. You don't sugarcoat. You create highly specific, actionable study plans based on exact data.`;

    const userMessage = `Create a brutally specific, highly personalized ${maxDaysToPlan}-day preparation plan for ${userName}. They have ${daysRemaining} days until their target interview.
Target Role: ${targetRole}

SKILL PROFILE (Exact Scores out of 100):
- Communication: ${memory.communication}
- Technical Depth: ${memory.technical_depth}
- Problem Solving: ${memory.problem_solving}
- Domain Knowledge: ${memory.domain_knowledge}
- Weak Areas: ${(memory.weak_areas || []).join(', ') || 'None identified yet'}
- Filler Word Rate: ${memory.filler_word_rate || 0}%
- Average Answer Length: ${memory.avg_answer_length || 0} words

RESUME ATS ANALYSIS:
- Score: ${resume?.ats_score || 'Not available'}/100
- Missing Keywords: ${resume?.keywords_missing ? JSON.stringify(resume.keywords_missing) : 'None identified'}

RECENT PRACTICE TEST SESSIONS:
${testsText}

SPECIFIC QUESTIONS ANSWERED POORLY (Score < 6/10 in last 3 sessions):
${poorAnswersText}

RECENT QUESTIONS ASKED ACROSS SESSIONS (Analyze these to find repeating topics they keep facing):
${recentQuestionsText}

INSTRUCTIONS:
1. NO GENERIC ADVICE. Do NOT say "improve technical depth". Name specific topics.
2. Incorporate their ATS missing keywords into their plan so they can naturally speak about them.
3. Use their past practice test subjects and scores to pinpoint exact technical gaps.
4. The coaching note must feel like a human coach wrote it directly to ${userName}. Mention their exact test scores, ATS score, and exact timeline (${daysRemaining} days).
5. Generate exactly ${maxDaysToPlan} daily tasks. If their timeline is very long, space out the focus topics over these ${maxDaysToPlan} days as a phase 1 plan.

Return JSON only:
{
  "weekly_focus": "One clear sentence describing the week's brutally specific focus.",
  "coaching_note": "2-3 sentences of personal, direct coaching advice starting with their name (${userName}), referencing their exact weak questions, ATS score, and test scores.",
  "priority_interview_type": "dsa|system_design|hr|behavioral|consulting|mckinsey_de",
  "daily_tasks": [
    {"day": 1, "topic": "Specific Topic", "task": "Specific task and resource", "duration_minutes": 30},
    // ... exactly ${maxDaysToPlan} days
  ]
}`;

    const responseText = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.4,
      maxTokens: 4096,
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
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in generate-prep-plan:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
})
