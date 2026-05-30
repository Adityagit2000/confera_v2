import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { getEmbedding } from '../_shared/embedding-service.ts'
import { createRequestContext, createLogger, sanitizeError, sanitizeInput, detectPromptInjection, authenticateRequest, checkRateLimit, rateLimitResponse } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  const ctx = createRequestContext('ai-interview-chat')
  const log = createLogger(ctx)

  try {
    // Step 1: Authenticate request
    log.step(1, 'Authenticating request')
    const auth = await authenticateRequest(req, getCorsHeaders(req.headers.get('origin')))
    if ('response' in auth) return auth.response
    const { user, supabase } = auth
    ctx.userId = user.id

    // Rate limit: max 30 chat messages per minute per user
    if (!checkRateLimit(`chat:${user.id}`, 30, 60_000)) {
      log.warn('Rate limit exceeded', user.id)
      return rateLimitResponse(getCorsHeaders(req.headers.get('origin')))
    }

    // Step 2: Parse and validate request
    log.step(2, 'Parsing request')
    const body = await req.json();
    const { sessionId, message, interviewType, currentQuestionIndex } = body;
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'sessionId is required' }),
        { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize user message
    const sanitizedMessage = sanitizeInput(message, 5000)
    const sanitizedType = sanitizeInput(interviewType, 50)

    // Check for prompt injection
    if (sanitizedMessage && detectPromptInjection(sanitizedMessage)) {
      log.warn('Prompt injection detected', sanitizedMessage.substring(0, 100))
      // Don't block — just log. The system prompt is strong enough to resist.
    }

    log.info('Request', `session=${sessionId}, type=${sanitizedType}, msgLen=${sanitizedMessage?.length || 0}`)

    // Step 3: Fetch session
    log.step(3, 'Fetching session')
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      log.error('Session not found', sessionError)
      return new Response(
        JSON.stringify({ success: false, error: `Session not found: ${sessionId}` }),
        { status: 404, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    const transcript = typeof session.transcript === 'string' 
      ? JSON.parse(session.transcript) 
      : (session.transcript || []);
    
    const questionIndex = transcript.filter((m: any) => m.role === 'assistant').length;
    let difficulty_level = session.difficulty_level || 'medium';

    // Step 4: Fetch resume context
    log.step(4, 'Fetching resume context')
    const { data: latestResume } = await supabase
      .from('resumes')
      .select('parsed_data')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Extract only the candidate's actual resume content (exclude ATS improvements, suggestions, strengths/weaknesses suggestions, etc.)
    const cleanResumeData = latestResume?.parsed_data 
      ? {
          candidate_name: latestResume.parsed_data.candidate_name || latestResume.parsed_data.contact?.name || null,
          summary: latestResume.parsed_data.summary || null,
          total_experience_years: latestResume.parsed_data.total_experience_years || null,
          skills: latestResume.parsed_data.technical_skills || latestResume.parsed_data.skills || [],
          soft_skills: latestResume.parsed_data.soft_skills || [],
          experience: latestResume.parsed_data.experience || [],
          education: latestResume.parsed_data.education || [],
          projects: latestResume.parsed_data.projects || [],
          achievements: latestResume.parsed_data.key_achievements || latestResume.parsed_data.strengths || []
        }
      : null;

    const resumeJsonSummary = cleanResumeData 
      ? JSON.stringify(cleanResumeData) 
      : "No resume analysis available. Proceed with general background questions.";

    // Step 5: Fetch skill memory
    log.step(5, 'Fetching skill memory')
    const { data: skillMemory } = await supabase
      .from('user_skill_memory')
      .select('communication, technical_depth, problem_solving, domain_knowledge, weak_areas')
      .eq('user_id', session.user_id)
      .single();

    const skillMemoryContext = skillMemory
      ? `Historical Performance: Communication: ${skillMemory.communication}/100, Technical: ${skillMemory.technical_depth}/100, Problem Solving: ${skillMemory.problem_solving}/100, Domain Knowledge: ${skillMemory.domain_knowledge}/100. Weak Areas to probe: ${(skillMemory.weak_areas || []).join(', ')}. Filler word rate: ${skillMemory.filler_word_rate || 0}%. Avg answer length: ${skillMemory.avg_answer_length || 0} words. Sessions completed: ${skillMemory.total_sessions || 0}.`
      : "No historical performance data. Treat as a new candidate.";

    // Step 6: Handle first message (start of interview)
    if ((!sanitizedMessage || sanitizedMessage.trim() === '') && transcript.length === 0) {
      log.step(6, 'Generating opening message')
      
      const startPrompt = `
      You are a Senior ${sanitizedType || 'General'} Interviewer. 
      Your goal is to evaluate the candidate for a ${session.job_role || 'relevant'} position.
      
      CONTEXT:
      - Candidate Resume: ${resumeJsonSummary}
      - ${skillMemoryContext}
      - Track: ${sanitizedType}
      
      TASK: 
      Generate a welcoming first message. Mention your role and the track. 
      End by asking the first question grounded in their resume experience.
      Keep it under 3 sentences.
      `;

      let firstMsg: string
      try {
        firstMsg = await callAiWithFallback({
          systemPrompt: "You are a professional AI interviewer.",
          userMessage: startPrompt,
          temperature: 0.7
        });
      } catch (aiError) {
        log.error('AI call failed for opening message', aiError)
        throw new Error(`AI interviewer unavailable: ${(aiError as Error).message}`)
      }

      const newHistory = [...transcript, { role: 'assistant', content: firstMsg }];
      await supabase.from('interview_sessions').update({ transcript: JSON.stringify(newHistory) }).eq('id', sessionId);
      
      // Increment interview usage counter
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('interviews_used_this_month')
          .eq('id', session.user_id)
          .single();
        
        await supabase
          .from('profiles')
          .update({ interviews_used_this_month: (profile?.interviews_used_this_month || 0) + 1 })
          .eq('id', session.user_id);
      } catch (usageErr) {
        log.error('Usage counter increment failed (non-fatal)', usageErr)
      }

      log.timing('Opening message generated')

      return new Response(JSON.stringify({ 
        success: true,
        response: firstMsg 
       }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 7: RAG retrieval
    log.step(7, 'RAG retrieval')
    const isFinalAnswer = questionIndex >= 10;
    let pastAnswerContext = '';
    try {
      if (sanitizedMessage && sanitizedMessage.trim().length > 10) {
        const queryEmbedding = await getEmbedding(sanitizedMessage);
        const { data: pastAnswers, error: ragError } = await supabase
          .rpc('match_transcript_embeddings', {
            query_embedding: JSON.stringify(queryEmbedding),
            match_user_id: session.user_id,
            match_interview_type: sanitizedType || session.type || 'general',
            match_count: 5
          });

        if (!ragError && pastAnswers && pastAnswers.length > 0) {
          pastAnswerContext = `\n# PAST ANSWER CONTEXT (from previous sessions)\nThe candidate has answered similar questions before. DO NOT repeat or closely rephrase these:\n${pastAnswers.map((a: any) => `- Q: ${a.question}\n  A (similarity: ${(a.similarity * 100).toFixed(0)}%): ${a.answer.substring(0, 200)}`).join('\n')}\n\nIf any past answer was shallow or incomplete, probe that same TOPIC from a completely different angle.\n`;
          log.info('RAG', `Retrieved ${pastAnswers.length} past answers`);
        }
      }
    } catch (ragErr) {
      log.warn('RAG retrieval failed (non-fatal)', (ragErr as any).message);
    }

    // Step 8: Build prompt and call AI
    log.step(8, 'Generating next question')

    // Dynamic Difficulty Adjustment
    if (questionIndex > 0 && questionIndex % 3 === 0) {
      log.info('Dynamic Difficulty', 'Checking last 3 answers to adjust difficulty...');
      try {
        const { data: recentAnswers, error: scoresErr } = await supabase
          .from('interview_answers')
          .select('score')
          .eq('session_id', sessionId)
          .not('score', 'is', null)
          .order('created_at', { ascending: false })
          .limit(3);

        if (!scoresErr && recentAnswers && recentAnswers.length === 3) {
          const avgScore = recentAnswers.reduce((acc, curr) => acc + (curr.score || 0), 0) / 3;
          
          if (avgScore >= 8) {
            difficulty_level = 'hard';
          } else if (avgScore < 5) {
            difficulty_level = 'easy';
          } else {
            difficulty_level = 'medium';
          }
          log.info('Dynamic Difficulty Updated', `Avg: ${avgScore.toFixed(1)}, New Level: ${difficulty_level}`);
        }
      } catch (err) {
        log.warn('Failed to calculate dynamic difficulty', (err as any).message);
      }
    }

    let difficultyDirective = "";
    if (difficulty_level === 'hard') {
      difficultyDirective = "\n# DIFFICULTY LEVEL: HARD\nThe candidate is performing excellently. Ask significantly harder questions that require deep expertise, edge cases, and multi-concept integration.";
    } else if (difficulty_level === 'easy') {
      difficultyDirective = "\n# DIFFICULTY LEVEL: EASY\nThe candidate is struggling. Ask more foundational questions to help them build confidence. Focus on core concepts before advanced topics.";
    } else {
      difficultyDirective = "\n# DIFFICULTY LEVEL: MEDIUM\nThe candidate is performing adequately. Maintain current difficulty and probe weak areas identified in recent answers.";
    }

    // Multi-Track Persona Injection
    const trackLenses: Record<string, string> = {
      'technical_core': "Focus on core technical proficiency relevant to the specific job role. Ask about domain-specific knowledge, tools, methodologies, and real-world problem solving for this profession (e.g., for a Civil Engineer ask about structural analysis, for a Data Engineer ask about pipelines and PySpark).",
      'behavioral_hr': "Focus on leadership, conflict resolution, teamwork, and cultural fit. Use the STAR method to probe into their past experiences and how they handle workplace scenarios relevant to their field.",
      'scenario_case': "Focus on problem-solving in hypothetical or complex situations relevant to the job role. Ask about how they would approach domain-specific challenges, tradeoffs, and decision-making.",
      'technical': "Focus on core technical proficiency relevant to the specific job role.",
      'behavioral': "Focus on leadership, conflict resolution, and cultural fit using the STAR method.",
      'scenario': "Focus on problem-solving in hypothetical or complex situations.",
      'dsa': "Focus on data structures, algorithms, and coding problem solving.",
      'system_design': "Focus on system architecture, scalability, and design tradeoffs.",
      'hr': "Focus on behavioral questions, cultural fit, and HR screening."
    };

    const currentLens = trackLenses[sanitizedType?.toLowerCase()] || "Focus on their overall fit and technical depth based on their resume.";

    const assistantMessages = transcript.filter((m: any) => m.role === 'assistant');
    const alreadyAskedQuestions = assistantMessages.map((m: any) => m.content);
    const alreadyAskedContext = alreadyAskedQuestions.length > 0 
      ? `\n# ALREADY ASKED QUESTIONS IN THIS SESSION:\nThese questions have already been asked in this session, DO NOT ask them again or ask anything similar:\n${alreadyAskedQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}` 
      : '';

    const systemPrompt = `
# ROLE
You are a Senior ${sanitizedType?.toUpperCase() || 'General'} Interviewer. Your goal is to evaluate the candidate's fit for a ${session.job_role || 'relevant'} position, specifically focusing on ${sanitizedType || 'general'} competencies while grounded in their actual experience.

# THE LENS (How to read the Resume)
- ${currentLens}
${difficultyDirective}

# CONTEXT
- Candidate Resume: ${resumeJsonSummary}
- ${skillMemoryContext}
- Track: ${sanitizedType}
${pastAnswerContext}
${alreadyAskedContext}

# OPERATING GUIDELINES
1. Use the Resume as the 'Case Study'. 
2. Ask 3-step deep questions: (1) The specific project task -> (2) The technical/business hurdle -> (3) The theoretical scaling/optimization.
3. Keep responses under 3 sentences.
4. NEVER repeat or closely rephrase a question from PAST ANSWER CONTEXT or ALREADY ASKED QUESTIONS above.
`;
    
    const windowedTranscript = (() => {
    if (transcript.length <= 2) return transcript
    const opener = transcript[0]
    const recent = transcript.slice(-8)
    const openerAlreadyIncluded = recent.some((m: any) => m.content === opener.content)
    return openerAlreadyIncluded ? recent : [opener, ...recent]
  })()

    const conversationStr = windowedTranscript.map((m: any) => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join('\n');
    
    const maxQ = sanitizedType === 'quick_practice' ? 3 : 10;
    
    const evaluationPrompt = `
    Based on the following conversation and the candidate's latest answer, provide the next interviewer response.
    
    Current Conversation History:
    ${conversationStr}
    
    Candidate's New Answer:
    "${sanitizedMessage}"
    
    Task: 
    1. Acknowledge their response briefly.
    2. If not finished (current question count is ${questionIndex}), ask the next relevant question for ${sanitizedType} based on YOUR ROLE and THE LENS. Focus heavily on probing their 'Weak Areas to probe' if any are listed in the CONTEXT.
    3. If ${maxQ} or more questions have been asked, conclude the interview.
    
    Respond with ONLY the text of the interviewer's next response (concise, professional). No JSON, no markdown tags.
    `;

    let nextResponseText: string
    try {
      nextResponseText = await callAiWithFallback({
        systemPrompt,
        userMessage: evaluationPrompt,
        temperature: 0.7
      });
    } catch (aiError) {
      log.error('AI call failed for next question', aiError)
      throw new Error(`AI interviewer unavailable: ${(aiError as Error).message}`)
    }
    log.timing('AI response generated')

    // Step 9: Save to interview_answers
    log.step(9, 'Saving answer record')
    const assistantMessagesForActive = transcript.filter((m: any) => m.role === 'assistant');
    let activeQuestion = "Initial Question";
    if (currentQuestionIndex !== undefined && currentQuestionIndex !== null) {
      if (currentQuestionIndex >= 0 && currentQuestionIndex < assistantMessagesForActive.length) {
        activeQuestion = assistantMessagesForActive[currentQuestionIndex].content;
      } else {
        activeQuestion = assistantMessagesForActive[assistantMessagesForActive.length - 1]?.content || "Initial Question";
      }
    } else {
      activeQuestion = transcript.length > 0 ? transcript.slice().reverse().find((m: any) => m.role === 'assistant')?.content : "Initial Question";
    }

    await supabase.from('interview_answers').insert({
      session_id: sessionId,
      question: activeQuestion,
      answer_text: sanitizedMessage || "",
      score: null
    });

    // Step 10: Coaching analysis (Awaiting to finalize and lock the answer)
    log.step(10, 'Triggering analyze-answer')
    try {
      await supabase.functions.invoke('analyze-answer', {
        body: {
          sessionId,
          question: activeQuestion,
          answer: sanitizedMessage || '',
          interviewType: sanitizedType || session.type || 'general'
        }
      });
    } catch (analyzeErr) {
      log.warn('Failed to finalize analyze-answer', (analyzeErr as any).message);
    }

    // Step 11: Update session transcript
    log.step(11, 'Updating session transcript')
    const updatedHistory = [
      ...transcript, 
      { role: 'user', content: sanitizedMessage || 'User sent an empty message.' },
      { role: 'assistant', content: nextResponseText }
    ];

    await supabase
      .from('interview_sessions')
      .update({ 
        transcript: JSON.stringify(updatedHistory),
        status: isFinalAnswer ? 'completed' : 'in_progress',
        difficulty_level
      })
      .eq('id', sessionId);

    log.timing('Total execution')

    return new Response(JSON.stringify({ 
      success: true,
      response: nextResponseText,
      is_complete: isFinalAnswer
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });

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
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } 
      }
    );
  }
})
