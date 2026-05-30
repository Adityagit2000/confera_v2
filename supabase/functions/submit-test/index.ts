import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

function generateCertificateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  console.log('--- submit-test: Function called ---');

  try {
    let userId: string;
    let dbClient: any;
    const body = await req.json();
    
    const auth = await authenticateRequest(req, getCorsHeaders(req.headers.get('origin')))
    if ('response' in auth) return auth.response
    userId = auth.user.id;
    dbClient = auth.supabase;

    const { test_session_id, user_answers, time_taken_seconds } = body;

    if (!test_session_id || !user_answers) {
      throw new Error('test_session_id and user_answers are required');
    }

    // 1. Fetch test_session
    const { data: session, error: sessionError } = await dbClient
      .from('test_sessions')
      .select('*')
      .eq('id', test_session_id)
      .single();

    if (sessionError || !session) {
      throw new Error('Test session not found');
    }

    if (session.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    if (session.status !== 'in_progress') {
      throw new Error('Test is already completed');
    }

    const questions = session.questions;
    const total_questions = questions.length;
    let score = 0;

    const topics: Record<string, { correct: number, total: number }> = {};

    // 2. Evaluate answers
    for (let i = 0; i < total_questions; i++) {
      const q = questions[i];
      const topic = q.topic || 'General';
      const userAnswer = user_answers[i];
      const isCorrect = userAnswer === q.correct_answer;
      
      if (!topics[topic]) {
        topics[topic] = { correct: 0, total: 0 };
      }
      
      topics[topic].total += 1;
      
      if (isCorrect) {
        score += 1;
        topics[topic].correct += 1;
      }
    }

    const percentage = Math.round((score / total_questions) * 100);
    const certificate_eligible = percentage >= 70;
    let certificate_id = null;

    // 3. Issue certificate if eligible
    if (certificate_eligible) {
      certificate_id = generateCertificateId();
      
      const { error: certError } = await dbClient
        .from('certificates')
        .insert({
          user_id: userId,
          certificate_id,
          test_session_id,
          test_type: session.test_type,
          branch: session.branch,
          score,
          total_questions,
          percentage
        });
        
      if (certError) {
        console.error('submit-test: Certificate generation error:', certError);
        // We will not fail the submission if cert fails, but we'll log it.
        certificate_id = null;
      }
    }

    // 4. Update session
    const { error: updateError } = await dbClient
      .from('test_sessions')
      .update({
        score,
        user_answers,
        time_taken_seconds: time_taken_seconds || 0,
        status: 'completed',
        certificate_eligible
      })
      .eq('id', test_session_id);

    if (updateError) {
      console.error('submit-test: Session update error:', updateError);
      throw new Error('Failed to save test results');
    }

    // Convert topics object to array format
    const topic_wise_breakdown = Object.keys(topics).map(topic => ({
      topic,
      correct: topics[topic].correct,
      total: topics[topic].total
    }));

    // Update Streak
    try {
      const { data: profile } = await dbClient
        .from('profiles')
        .select('current_streak, longest_streak, last_activity_date')
        .eq('id', userId)
        .single();
      
      if (profile) {
        const today = new Date();
        today.setUTCHours(0,0,0,0);
        
        let newStreak = profile.current_streak || 0;
        const lastDate = profile.last_activity_date ? new Date(profile.last_activity_date) : null;
        
        if (lastDate) {
          const lastActivity = new Date(lastDate);
          lastActivity.setUTCHours(0,0,0,0);
          
          const diffTime = today.getTime() - lastActivity.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            newStreak += 1;
          } else if (diffDays > 1) {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        const newLongest = Math.max(newStreak, profile.longest_streak || 0);

        await dbClient
          .from('profiles')
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            last_activity_date: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } catch (streakErr) {
      console.error('Failed to update streak (non-fatal):', streakErr);
    }

    return new Response(JSON.stringify({
      success: true,
      score,
      total_questions,
      percentage,
      topic_wise_breakdown,
      time_taken_seconds,
      certificate_eligible,
      certificate_id,
      questions // Full questions array including correct answers
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in submit-test:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
})
