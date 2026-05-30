import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  console.log('--- analyze-answer-deep: Function called ---');

  try {
    // Authenticate request
    const auth = await authenticateRequest(req, getCorsHeaders(req.headers.get('origin')))
    if ('response' in auth) return auth.response
    const { supabase } = auth

    const { sessionId, question, answer, interviewType, time_taken = 60 } = await req.json();
    if (!sessionId || !question || !answer) {
      throw new Error('sessionId, question, and answer are required');
    }

    // Calculate words per minute
    const wordCount = answer.trim().split(/\s+/).length;
    const timeTakenMins = Math.max(0.1, time_taken / 60); // avoid div by zero
    const wpm = Math.round(wordCount / timeTakenMins);

    const isBehavioral = ['hr', 'behavioral', 'behavioral_hr'].includes(interviewType?.toLowerCase() || '');

    const systemPrompt = `You are a senior interview coach for ${interviewType || 'general'} interviews, trained in deep behavioral analysis. 
You will be given a question, an answer, and the calculated words_per_minute (${wpm} WPM).

Analyze the answer based on the following:
1. Count filler words (um, uh, like, basically, you know, sort of, kind of, right, okay so).
2. Detect answer structure (STAR for behavioral, PREP for opinion, Technical for technical, or Unstructured).
3. Assess completeness (Complete, Partial, Deflected).
4. Rate confidence level (High, Medium, Low) based on filler density and hedge words (maybe, probably, I think, I guess, I believe, not sure but, something like).

Return JSON only:
{
  "score": <1-10>,
  "depth": "shallow|adequate|strong",
  "used_star_format": <boolean>,
  "filler_word_count": <integer>,
  "words_per_minute": ${wpm},
  "confidence_level": "High|Medium|Low",
  "answer_structure": "STAR|PREP|Technical|Unstructured",
  "completeness": "Complete|Partial|Deflected",
  "key_missing_points": ["string"],
  "one_line_coaching_tip": "string",
  "behavioral_tags": {
    "spoke_too_fast": <boolean true if WPM > 160>,
    "too_many_fillers": <boolean true if filler density is high>,
    "deflected_question": <boolean true if completeness is Deflected>,
    "good_structure": <boolean true if structure is well defined>,
    "showed_depth": <boolean true if depth is strong>
  }
}`;

    const userMessage = `Evaluate this interview answer.

TYPE: ${interviewType || 'general'}
QUESTION: ${question}
ANSWER: ${answer}
TIME TAKEN: ${time_taken} seconds
CALCULATED WPM: ${wpm}

Respond with ONLY the valid JSON object.`;

    let responseText = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.2,
      maxTokens: 1024,
      responseMimeType: 'application/json'
    });

    let coaching: any;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      coaching = JSON.parse(cleaned);
    } catch {
      console.warn('analyze-answer: JSON parse failed. Retrying once.');
      responseText = await callAiWithFallback({
        systemPrompt: systemPrompt + " YOU MUST RETURN EXACTLY VALID JSON.",
        userMessage,
        temperature: 0.1,
        maxTokens: 1024,
        responseMimeType: 'application/json'
      });
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        coaching = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('AI returned invalid JSON');
      }
    }

    // Default fallbacks in case AI misses fields
    coaching.score = Math.max(1, Math.min(10, Math.round(coaching.score || 5)));
    coaching.depth = ['shallow', 'adequate', 'strong'].includes(coaching.depth) ? coaching.depth : 'adequate';
    coaching.words_per_minute = wpm;

    // Save to DB
    const { data: answerRows } = await supabase
      .from('interview_answers') // ai_mvp_schema uses interview_responses, but we updated both if possible
      .select('id, tags')
      .eq('session_id', sessionId)
      .eq('question', question)
      .order('created_at', { ascending: false })
      .limit(1);

    if (answerRows && answerRows.length > 0) {
      const existingTags = answerRows[0].tags || {};
      
      const updatePayload = {
        tags: { ...(typeof existingTags === 'object' ? existingTags : {}), coaching },
        words_per_minute: coaching.words_per_minute,
        filler_word_count: coaching.filler_word_count,
        confidence_level: coaching.confidence_level,
        answer_structure: coaching.answer_structure,
        completeness_score: coaching.score, // Or mapped from completeness string, using score here
        behavioral_tags: coaching.behavioral_tags
      };

      await supabase
        .from('interview_answers')
        .update(updatePayload)
        .eq('id', answerRows[0].id);

      // Also try to update interview_responses for forward compatibility
      await supabase
        .from('interview_responses')
        .update(updatePayload)
        .eq('id', answerRows[0].id)
        .catch(() => {}); // ignore error if it doesn't exist
    } else {
      // If no row exists, we might insert it or just log. Usually the client inserts the answer row before analyzing.
      console.warn(`analyze-answer: No existing row found for session ${sessionId} and question ${question.substring(0,20)}...`);
    }

    return new Response(JSON.stringify({ success: true, coaching }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in analyze-answer:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
})
