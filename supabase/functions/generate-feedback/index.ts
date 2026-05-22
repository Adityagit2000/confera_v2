import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { createRequestContext, createLogger, sanitizeError, authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ctx = createRequestContext('generate-feedback')
  const log = createLogger(ctx)

  try {
    // Step 1: Authenticate request
    log.step(1, 'Authenticating request')
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    const { user, supabase } = auth
    ctx.userId = user.id

    // Step 2: Parse request
    log.step(2, 'Parsing request')
    const { sessionId } = await req.json()
    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    log.info('Session', sessionId)

    // Step 3: Fetch answers
    log.step(3, 'Fetching interview answers')
    const { data: answers, error: answersError } = await supabase
      .from('interview_answers')
      .select('question, answer_text, score')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (answersError || !answers || answers.length === 0) {
      log.warn('No answers found', answersError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'No answers found for this session. Please complete the interview first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    log.info('Answers found', `${answers.length} answers`)

    // Step 4: Fetch session details
    log.step(4, 'Fetching session details')
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      log.error('Session not found', sessionError)
      throw new Error('Interview session not found')
    }

    // Step 5: Fetch resume context
    log.step(5, 'Fetching resume context')
    const { data: resume } = await supabase
      .from('resumes')
      .select('parsed_data, ats_score')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Step 6: Fetch skill memory
    log.step(6, 'Fetching skill memory')
    const { data: skillMemory } = await supabase
      .from('user_skill_memory')
      .select('*')
      .eq('user_id', session.user_id)
      .single();

    const skillMemoryContext = skillMemory
      ? `Communication: ${skillMemory.communication}/100\nTechnical Depth: ${skillMemory.technical_depth}/100\nProblem Solving: ${skillMemory.problem_solving}/100\nDomain Knowledge: ${skillMemory.domain_knowledge}/100\nWeak Areas: ${(skillMemory.weak_areas || []).join(', ')}`
      : "No historical data available. First session.";

    // Step 7: Build evaluation prompt
    log.step(7, 'Building evaluation prompt')
    const qaTranscript = answers.map((a, i) => 
      `Question ${i+1}: ${a.question}\nCandidate Answer: ${a.answer_text || 'No answer provided'}`
    ).join('\n\n');

    const answeredCount = answers.filter(a => a.answer_text && a.answer_text.trim().length > 0).length;

    let scoringGuideline = "";
    if (answeredCount <= 2) {
      scoringGuideline = "The candidate answered 2 or fewer questions. This is an INCOMPLETE interview. Overall score MUST be in the 20-40 range. Summary MUST state it was incomplete.";
    } else if (answeredCount <= 4) {
      scoringGuideline = "The candidate answered 3-4 questions. This is a partial interview. Scores should reflect the limited data (likely 40-60 range unless answers were exceptional).";
    }

    const systemPrompt = `
    You are an expert technical recruiter and hiring manager evaluating a candidate for a ${session.type.replace('_', ' ')} interview.
    Evaluate ONLY based on the actual answers provided below. Be specific and reference the candidate's actual responses.
    If answers are missing or empty, reflect that in the scores.
    
    ${scoringGuideline}
    `;

    const userMessage = `
    Evaluate this ${session.type.replace('_', ' ')} interview performance based on the actual Q&A transcript below.

    INTERVIEW TRANSCRIPT:
    ${qaTranscript}

    CANDIDATE RESUME CONTEXT:
    Skills: ${JSON.stringify(resume?.parsed_data?.skills || [])}
    ATS Score: ${resume?.ats_score || 'N/A'}

    HISTORICAL SKILL CONTEXT:
    ${skillMemoryContext}

    Provide evaluation as JSON with:
    {
      "overall_score": <0-100 based on actual answers>,
      "per_question_scores": [{"question_id": 1, "relevance": 0, "accuracy": 0, "clarity": 0, "depth": 0}],
      "skill_scores": {
        "communication": <0-100>,
        "technical_depth": <0-100>,
        "problem_solving": <0-100>,
        "domain_knowledge": <0-100>
      },
      "strengths": ["<specific strength from their answers>"],
      "improvements": ["<specific area to improve based on their answers>"],
      "focus_areas_next_session": ["<top 3 focus areas for next time>"],
      "overall_summary": "<3-4 sentences specifically about their actual answers>"
    }

    IMPORTANT: Base ALL scores and feedback on the actual answers above. 
    Respond with ONLY the raw JSON. No markdown tags.
    `;

    // Step 8: Call AI (uses shared callAiWithFallback with circuit breaker + timeout)
    log.step(8, 'Calling AI for evaluation')
    let responseText: string
    try {
      responseText = await callAiWithFallback({
        systemPrompt,
        userMessage,
        temperature: 0.2,
        maxTokens: 2048,
        responseMimeType: 'application/json'
      })
    } catch (aiError) {
      log.error('AI call failed', aiError)
      throw new Error(`AI evaluation failed: ${(aiError as Error).message}`)
    }
    log.timing('AI evaluation complete')

    // Step 9: Parse AI response
    log.step(9, 'Parsing AI response')
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let reportData: any
    try {
      reportData = JSON.parse(cleaned)
    } catch (parseError) {
      log.warn('First parse failed, retrying', cleaned.substring(0, 200))
      const retryText = await callAiWithFallback({
        systemPrompt,
        userMessage: userMessage + '\n\nIMPORTANT: Your previous response could not be parsed as JSON. Return ONLY a valid JSON object with no text before or after it, no markdown code fences, no explanation.',
        temperature: 0.1,
        maxTokens: 2048,
        responseMimeType: 'application/json'
      })
      const retryCleaned = retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      try {
        reportData = JSON.parse(retryCleaned)
      } catch (retryError) {
        log.error('Second parse also failed', retryError)
        throw new Error('AI returned invalid JSON after two attempts. Raw response: ' + responseText.substring(0, 500))
      }
    }

    // Step 10: Save feedback report
    log.step(10, 'Saving feedback report')
    await supabase.from('feedback_reports').delete().eq('session_id', sessionId)

    const { data: report, error: reportError } = await supabase
      .from('feedback_reports')
      .insert({
        session_id: sessionId,
        overall_score: reportData.overall_score,
        technical_score: reportData.skill_scores?.technical_depth || 0,
        communication_score: reportData.skill_scores?.communication || 0,
        behavior_score: reportData.skill_scores?.problem_solving || 0,
        summary: reportData.overall_summary,
        recommendations: {
          strengths: reportData.strengths,
          improvements: reportData.improvements,
          nextSteps: reportData.focus_areas_next_session,
          per_question_scores: reportData.per_question_scores
        }
      })
      .select()
      .single()

    if (reportError) {
      log.error('Report insert failed', reportError)
      throw reportError
    }

    // Step 11: Update skill memory
    log.step(11, 'Updating skill memory')
    try {
      const currentScores = reportData.skill_scores || {
        communication: 50, technical_depth: 50, problem_solving: 50, domain_knowledge: 50
      };

      if (skillMemory) {
        await supabase.from('user_skill_memory').update({
          communication: (skillMemory.communication * 0.6) + (currentScores.communication * 0.4),
          technical_depth: (skillMemory.technical_depth * 0.6) + (currentScores.technical_depth * 0.4),
          problem_solving: (skillMemory.problem_solving * 0.6) + (currentScores.problem_solving * 0.4),
          domain_knowledge: (skillMemory.domain_knowledge * 0.6) + (currentScores.domain_knowledge * 0.4),
          weak_areas: reportData.focus_areas_next_session || skillMemory.weak_areas,
          updated_at: new Date().toISOString()
        }).eq('user_id', session.user_id);
      } else {
        await supabase.from('user_skill_memory').insert({
          user_id: session.user_id,
          communication: currentScores.communication,
          technical_depth: currentScores.technical_depth,
          problem_solving: currentScores.problem_solving,
          domain_knowledge: currentScores.domain_knowledge,
          weak_areas: reportData.focus_areas_next_session || []
        });
      }
    } catch (skillErr) {
      log.error('Skill memory update failed (non-fatal)', skillErr);
    }

    // Step 12: Generate learning path
    log.step(12, 'Generating learning path')
    try {
      const improvements = reportData.improvements || []
      const nextSteps = reportData.focus_areas_next_session || []
      
      const allGaps = Array.from(new Set([...improvements, ...nextSteps]))
      
      if (allGaps.length > 0) {
        const { data: resourcesData, error: resourcesError } = await supabase.functions.invoke('fetch-resources', {
          body: { topics: allGaps }
        })

        if (!resourcesError && resourcesData) {
          const learningPathEntries = allGaps.map(gap => ({
            user_id: session.user_id,
            title: gap,
            description: `Focus on improving: ${gap}`,
            resources: resourcesData[gap] || [],
            source_type: 'mock_interview',
            source_id: sessionId,
            is_completed: false
          }))

          await supabase.from('learning_paths').insert(learningPathEntries)
        }
      }
    } catch (lpErr) {
      log.error('Learning path generation failed (non-fatal)', lpErr)
    }

    // Step 13: Trigger RAG embedding pipeline
    log.step(13, 'Triggering embed-session pipeline')
    try {
      supabase.functions.invoke('embed-session', {
        body: { sessionId }
      }).catch(err => log.error('embed-session background call failed', err));
    } catch (embedErr) {
      log.error('Failed to trigger embed-session (non-fatal)', embedErr);
    }

    log.timing('Total execution')
    log.info('Success', `Report ID: ${report.id}, Score: ${reportData.overall_score}`)

    return new Response(JSON.stringify({
      success: true,
      report,
      message: 'Feedback generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: any) {
    log.error('FATAL', error)
    const sanitized = sanitizeError(error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: sanitized.error,
        correlationId: ctx.correlationId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})