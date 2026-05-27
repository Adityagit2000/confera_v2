import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { getEmbedding } from '../_shared/embedding-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

// Filler words to detect in answers
const FILLER_WORDS = [
  'um', 'uh', 'like', 'basically', 'you know', 'sort of',
  'kind of', 'i mean', 'actually', 'right', 'so yeah',
  'literally', 'honestly', 'obviously'
];

function countFillerWords(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const filler of FILLER_WORDS) {
    // Use word-boundary-aware matching for single words, simple includes for phrases
    if (filler.includes(' ')) {
      const regex = new RegExp(filler, 'gi');
      const matches = lower.match(regex);
      count += matches ? matches.length : 0;
    } else {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lower.match(regex);
      count += matches ? matches.length : 0;
    }
  }
  return count;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- embed-session: Function called ---');

  try {
    // Authenticate request
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    const { supabase } = auth

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error('sessionId is required');

    // 1. Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('user_id, type')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const userId = session.user_id;
    const interviewType = session.type || 'general';

    // 2. Fetch all Q&A pairs for this session
    const { data: answers, error: answersError } = await supabase
      .from('interview_answers')
      .select('question, answer_text')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (answersError || !answers || answers.length === 0) {
      console.log('embed-session: No answers found, skipping embedding.');
      return new Response(JSON.stringify({ success: true, embedded: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`embed-session: Processing ${answers.length} Q&A pairs for session ${sessionId}`);

    // 3. Embed each Q&A pair and insert into transcript_embeddings
    let embeddedCount = 0;
    let totalFillerWords = 0;
    let totalWords = 0;

    for (const qa of answers) {
      const question = qa.question || '';
      const answer = qa.answer_text || '';

      if (!answer.trim()) continue;

      // Compute behavioral metrics for this answer
      const answerWords = countWords(answer);
      const answerFillers = countFillerWords(answer);
      totalWords += answerWords;
      totalFillerWords += answerFillers;

      try {
        // Generate embedding for the Q&A pair
        const embeddingText = `Question: ${question}\nAnswer: ${answer}`;
        const embedding = await getEmbedding(embeddingText);

        // Insert into transcript_embeddings
        const { error: insertError } = await supabase
          .from('transcript_embeddings')
          .insert({
            user_id: userId,
            session_id: sessionId,
            interview_type: interviewType,
            question: question,
            answer: answer,
            embedding: JSON.stringify(embedding)
          });

        if (insertError) {
          console.error(`embed-session: Failed to insert embedding for Q&A:`, insertError.message);
        } else {
          embeddedCount++;
        }
      } catch (embErr) {
        console.error(`embed-session: Embedding failed for a Q&A pair:`, (embErr as any).message);
        // Continue with remaining pairs — don't fail the whole batch
      }
    }

    // 4. Compute session-level behavioral metrics
    const answersWithText = answers.filter(a => a.answer_text?.trim());
    const sessionFillerRate = totalWords > 0 ? (totalFillerWords / totalWords) * 100 : 0;
    const sessionAvgLength = answersWithText.length > 0 ? Math.round(totalWords / answersWithText.length) : 0;

    // 5. Upsert behavioral metrics into user_skill_memory
    try {
      const { data: existingMemory } = await supabase
        .from('user_skill_memory')
        .select('filler_word_rate, avg_answer_length, total_sessions')
        .eq('user_id', userId)
        .single();

      if (existingMemory) {
        const newFillerRate = (existingMemory.filler_word_rate || 0) * 0.7 + sessionFillerRate * 0.3;
        const newAvgLength = Math.round(((existingMemory.avg_answer_length || 0) * 0.7) + (sessionAvgLength * 0.3));
        const newTotalSessions = (existingMemory.total_sessions || 0) + 1;

        await supabase
          .from('user_skill_memory')
          .update({
            filler_word_rate: Math.round(newFillerRate * 100) / 100,
            avg_answer_length: newAvgLength,
            total_sessions: newTotalSessions
          })
          .eq('user_id', userId);
      } else {
        // If no skill memory exists yet (shouldn't happen since generate-feedback creates it),
        // insert a minimal row
        await supabase
          .from('user_skill_memory')
          .insert({
            user_id: userId,
            filler_word_rate: Math.round(sessionFillerRate * 100) / 100,
            avg_answer_length: sessionAvgLength,
            total_sessions: 1
          });
      }

      console.log(`embed-session: Updated behavioral metrics — filler rate: ${sessionFillerRate.toFixed(2)}%, avg length: ${sessionAvgLength} words`);
    } catch (memErr) {
      console.error('embed-session: Failed to update skill memory behavioral metrics:', memErr);
    }

    // 6. Chain: trigger prep plan generation (fire-and-forget)
    try {
      supabase.functions.invoke('generate-prep-plan', {
        body: { userId },
        headers: { Authorization: req.headers.get('Authorization')! }
      }).then(({ error }) => {
        if (error) console.error('embed-session: generate-prep-plan chain returned error:', error);
      }).catch(err => console.error('embed-session: generate-prep-plan chain failed:', err));
    } catch (chainErr) {
      console.error('embed-session: Failed to trigger generate-prep-plan:', chainErr);
    }

    console.log(`embed-session: Complete. Embedded ${embeddedCount}/${answers.length} Q&A pairs.`);

    return new Response(JSON.stringify({
      success: true,
      embedded: embeddedCount,
      total: answers.length,
      metrics: {
        filler_word_rate: Math.round(sessionFillerRate * 100) / 100,
        avg_answer_length: sessionAvgLength
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in embed-session:', error.message, error.stack);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})
