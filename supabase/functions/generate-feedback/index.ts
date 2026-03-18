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

    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Interview session not found')
    }

    // Fetch user profile to check plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, plan_expires_at')
      .eq('id', session.user_id)
      .single();

    const isPro = profile?.plan === 'pro' && 
      (profile?.plan_expires_at ? new Date(profile.plan_expires_at) > new Date() : false);

    const transcript = typeof session.transcript === 'string' 
        ? JSON.parse(session.transcript) 
        : (session.transcript || [])

    let systemPrompt = `You are an expert technical recruiter and hiring manager.`;

    let userMessage = `
    Review the following transcript for a ${session.type.replace('_', ' ')} interview.
    
    Transcript:
    ${JSON.stringify(transcript)}
    
    Evaluate the candidate's performance and provide a comprehensive feedback report.
    `;
    
    if (['daa', 'consulting', 'business_analyst'].includes(session.type)) {
      userMessage += `
      For this role, you MUST evaluate the following exact dimensions and map them to the JSON schema:
      - 'technical_score' should represent Domain knowledge relevance & Quantitative reasoning.
      - 'communication_score' should represent Communication clarity.
      - 'behavior_score' should represent Structured thinking and problem framing.
      `;
      userMessage += `
      For this specialized McKinsey Data Engineer role, evaluate these specific dimensions:
      - 'technical_score': Proficiency in SQL, Python, PySpark, LLMs, and Vector DBs.
      - 'communication_score': Ability to communicate technical findings to stakeholders and consulting mindset.
      - 'behavior_score': End-to-end project ownership and optimization intuition.
      `;
    }

    if (isPro || session.type === 'mckinsey_de') {
      userMessage += `
      You MUST also include a 'mckinsey_readiness' object (nested inside the main JSON) with:
      - 'gaps': array of strings identifying missing skills for top-tier consulting roles.
      - 'study_plan': string describing a roadmap to reach McKinsey-level performance.
      - 'resources': array of strings with specific learning resources.
      `;
    }
    
    userMessage += `
    You must return a STRICT JSON object in this exact format, with NO Markdown wrapping (do not use \`\`\`json):
    {
      "overall_score": 85,
      "technical_score": 80,
      "communication_score": 90,
      "behavior_score": 85,
      "summary": "The candidate demonstrated strong understanding of...",
      "strengths": ["Clear communication", "Good problem solving"],
      "improvements": ["Needs to talk about scale more", "Could optimize space complexity"],
      "nextSteps": ["Read distributed systems book", "Practice more graph problems"],
      "mckinsey_readiness": {
        "gaps": ["SQL window functions", "PySpark optimization"],
        "study_plan": "Focus on distributed data processing and AI agents.",
        "resources": ["Practice window functions on LeetCode Top SQL 50", "Study Spark: The Definitive Guide"]
      }
    }
    All scores should be between 0 and 100.
    `

    const responseText = await callAI(systemPrompt, userMessage);
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const reportData = JSON.parse(cleaned)

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

    // --- NEW: Generate Learning Path ---
    try {
      const improvements = reportData.improvements || []
      const nextSteps = reportData.nextSteps || []
      const gaps = reportData.mckinsey_readiness?.gaps || []
      
      const allGaps = Array.from(new Set([...improvements, ...nextSteps, ...gaps]))
      
      if (allGaps.length > 0) {
        console.log(`Fetching resources for ${allGaps.length} gaps`)
        
        // Call the new fetch-resources function internally or via fetch
        // For simplicity in the same environment, we'll try to invoke it
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

          const { error: lpError } = await supabase
            .from('learning_paths')
            .insert(learningPathEntries)
          
          if (lpError) console.error('Error inserting learning paths:', lpError)
        }
      }
    } catch (lpErr) {
      console.error('Failed to generate learning path:', lpErr)
      // Don't fail the whole process if learning path fails
    }
    // --- END NEW ---

    // Log the event
    await supabase
      .from('event_logs')
      .insert({
        user_id: session.user_id,
        name: 'feedback_generated',
        payload: {
          session_id: sessionId,
          report_id: report.id,
          overall_score: reportData.overall_score
        }
      })

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