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

  console.log('--- analyze-answer: Function called ---');

  try {
    const { sessionId, question, answer, interviewType } = await req.json();
    if (!sessionId || !question || !answer) {
      throw new Error('sessionId, question, and answer are required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const isBehavioral = ['hr', 'behavioral', 'behavioral_hr'].includes(interviewType?.toLowerCase() || '');

    const systemPrompt = `You are a senior interview coach for ${interviewType || 'general'} interviews. Be honest but constructive.`;

    const userMessage = `Evaluate this interview answer.

TYPE: ${interviewType || 'general'}
QUESTION: ${question}
ANSWER: ${answer}

Return JSON only:
{
  "score": <1-10>,
  "depth": "shallow|adequate|strong",
  "used_star_format": ${isBehavioral ? '<true if STAR used>' : 'false'},
  "filler_word_count": <int>,
  "missing_points": ["..."],
  "coaching_tip": "one actionable sentence"
}`;

    const responseText = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.2,
      maxTokens: 512,
      responseMimeType: 'application/json'
    });

    let coaching: any;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      coaching = JSON.parse(cleaned);
    } catch {
      coaching = { score: 5, depth: 'adequate', used_star_format: false, filler_word_count: 0, missing_points: [], coaching_tip: 'Analysis unavailable.' };
    }

    coaching.score = Math.max(1, Math.min(10, Math.round(coaching.score || 5)));
    coaching.depth = ['shallow', 'adequate', 'strong'].includes(coaching.depth) ? coaching.depth : 'adequate';

    const { data: answerRows } = await supabase
      .from('interview_answers')
      .select('id, tags')
      .eq('session_id', sessionId)
      .eq('question', question)
      .order('created_at', { ascending: false })
      .limit(1);

    if (answerRows && answerRows.length > 0) {
      const existingTags = answerRows[0].tags || {};
      await supabase
        .from('interview_answers')
        .update({ tags: { ...(typeof existingTags === 'object' ? existingTags : {}), coaching } })
        .eq('id', answerRows[0].id);
    }

    return new Response(JSON.stringify({ success: true, coaching }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in analyze-answer:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
