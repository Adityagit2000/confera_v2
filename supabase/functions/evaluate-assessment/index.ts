import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } });
  
  const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } });

  try {
    const { assessmentId, submissions } = await req.json();
    if (!assessmentId || !Array.isArray(submissions)) {
      return new Response(JSON.stringify({ error: 'assessmentId and submissions array are required' }), { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } });
    }

    console.log(`Evaluating assessment: ${assessmentId}, user: ${user.id}`);

    // Verify assessment ownership and get details
    const { data: assessment, error: assessmentError } = await supabaseAuth
      .from('assessments')
      .select('id, user_id, job_role, total_questions')
      .eq('id', assessmentId)
      .single();

    if (assessmentError || !assessment) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), { status: 404, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } });
    }

    if (assessment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } });
    }

    // Fetch questions to check answers
    const { data: questions, error: questionsError } = await supabaseAuth
      .from('assessment_questions')
      .select('id, correct_option')
      .eq('assessment_id', assessmentId);

    if (questionsError || !questions) {
      throw new Error('Failed to fetch assessment questions');
    }

    const questionMap = new Map(questions.map(q => [q.id, q.correct_option]));
    
    let correctCount = 0;
    const dbSubmissions = [];

    for (const sub of submissions) {
      const correctOption = questionMap.get(sub.questionId);
      const isCorrect = correctOption !== undefined && correctOption === sub.selectedOption;
      if (isCorrect) correctCount++;
      
      dbSubmissions.push({
        assessment_id: assessmentId,
        user_id: user.id,
        question_id: sub.questionId,
        selected_option: sub.selectedOption,
        is_correct: isCorrect
      });
    }

    const totalQuestions = assessment.total_questions;
    const scorePercentage = (correctCount / totalQuestions) * 100;
    const passed = scorePercentage >= 70;

    // Bulk insert submissions
    const { error: insertSubError } = await supabaseAuth
      .from('assessment_submissions')
      .insert(dbSubmissions);

    if (insertSubError) {
      console.error('Failed to insert submissions:', insertSubError);
      throw new Error('Failed to save submissions');
    }

    let certificateHash = null;

    if (passed) {
      // Generate unique certificate hash
      const dataToHash = `${user.id}-${assessmentId}-${Date.now()}`;
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataToHash));
      certificateHash = new TextDecoder().decode(hexEncode(new Uint8Array(hashBuffer)));

      const { error: certError } = await supabaseAuth
        .from('certificates')
        .insert({
          user_id: user.id,
          assessment_id: assessmentId,
          job_role: assessment.job_role,
          certificate_hash: certificateHash
        });

      if (certError) {
        console.error('Failed to issue certificate:', certError);
        // We don't fail the whole request, but note it
      }
    }

    // Update assessment record
    const { error: updateError } = await supabaseAuth
      .from('assessments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        score_percentage: scorePercentage,
        passed: passed
      })
      .eq('id', assessmentId);

    if (updateError) {
      console.error('Failed to update assessment status:', updateError);
      throw new Error('Failed to update assessment status');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      scorePercentage,
      passed,
      correctCount,
      totalQuestions,
      certificateHash
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Edge Function Catch Block:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
