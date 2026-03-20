import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
const groqKey = Deno.env.get('GROQ_API_KEY')!

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        })
      }
    );

    if (geminiResponse.status === 429 || geminiResponse.status === 503) {
      throw new Error('Gemini rate limited');
    }

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      if(errText.includes('quota')) throw new Error('Gemini rate limited');
      throw new Error(`Gemini error: ${geminiResponse.status} ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    return geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } catch (error: any) {
    if (!error.message.includes('rate limited')) {
       console.log('Gemini failed with non-rate limit error, trying Groq anyway:', error.message);
    } else {
       console.log('Gemini rate limited, falling back to Groq:', error.message);
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2048,
        temperature: 0.2
      })
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      throw new Error(`Both Gemini and Groq failed. Groq error: ${err}`);
    }

    const groqData = await groqResponse.json();
    let text = groqData.choices[0].message.content;
    // Extra safety to strip trailing/leading text if Groq hallucinated
    if(text.includes('{')) {
        return text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    }
    return text;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json()
    
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    console.log(`Generating feedback for session: ${sessionId}`)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch all answers for this session
    const { data: answers, error: answersError } = await supabase
      .from('interview_answers')
      .select('question, answer_text, score')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (answersError || !answers || answers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No answers found for this session. Please complete the interview first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Interview session not found')
    }

    // 3. Fetch user's resume for context
    const { data: resume } = await supabase
      .from('resumes')
      .select('parsed_data, ats_score')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 4. Build the evaluation prompt with actual answers
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

    let userMessage = `
    Evaluate this ${session.type.replace('_', ' ')} interview performance based on the actual Q&A transcript below.

    INTERVIEW TRANSCRIPT:
    ${qaTranscript}

    CANDIDATE RESUME CONTEXT:
    Skills: ${JSON.stringify(resume?.parsed_data?.skills || [])}
    ATS Score: ${resume?.ats_score || 'N/A'}

    Provide evaluation as JSON with:
    {
      "overall_score": <0-100 based on actual answers>,
      "technical_score": <0-100>,
      "communication_score": <0-100>,
      "behavior_score": <0-100>,
      "summary": "<2-3 sentences specifically about their actual answers>",
      "strengths": ["<specific strength from their answers>"],
      "improvements": ["<specific area to improve based on their answers>"],
      "nextSteps": ["<actionable next step>"]
      ${(session.type === 'mckinsey_de') ? `,
      "mckinsey_readiness": {
        "gaps": ["array of strings"],
        "study_plan": "string",
        "resources": ["array of strings"]
      }` : ''}
    }

    IMPORTANT: Base ALL scores and feedback on the actual answers above. 
    Respond with ONLY the raw JSON. No markdown tags.
    `;

    const responseText = await callAI(systemPrompt, userMessage);
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let reportData: any
  try {
    reportData = JSON.parse(cleaned)
  } catch (parseError) {
    console.error('generate-feedback: failed to parse AI response, retrying. Raw:', responseText.substring(0, 500))
    const retryText = await callAI(systemPrompt, userMessage + '\n\nIMPORTANT: Your previous response could not be parsed as JSON. Return ONLY a valid JSON object with no text before or after it, no markdown code fences, no explanation.')
    const retryCleaned = retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      reportData = JSON.parse(retryCleaned)
    } catch (retryError) {
      throw new Error('AI returned invalid JSON after two attempts. Raw response: ' + responseText.substring(0, 500))
    }
  }

    await supabase.from('feedback_reports').delete().eq('session_id', sessionId)

    const { data: report, error: reportError } = await supabase
      .from('feedback_reports')
      .insert({
        session_id: sessionId,
        overall_score: reportData.overall_score,
        technical_score: reportData.technical_score,
        communication_score: reportData.communication_score,
        behavior_score: reportData.behavior_score,
        summary: reportData.summary,
        recommendations: {
          strengths: reportData.strengths,
          improvements: reportData.improvements,
          nextSteps: reportData.nextSteps,
          mckinsey_readiness: reportData.mckinsey_readiness || null
        }
      })
      .select()
      .single()

    if (reportError) {
      console.error('Error creating feedback report:', reportError)
      throw reportError
    }

    // --- Generate Learning Path ---
    try {
      const improvements = reportData.improvements || []
      const nextSteps = reportData.nextSteps || []
      const gaps = reportData.mckinsey_readiness?.gaps || []
      
      const allGaps = Array.from(new Set([...improvements, ...nextSteps, ...gaps]))
      
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
      console.error('Failed to generate learning path:', lpErr)
    }

    return new Response(JSON.stringify({
      success: true,
      report,
      message: 'Feedback generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: any) {
    console.error('Error in generate-feedback function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate feedback', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})