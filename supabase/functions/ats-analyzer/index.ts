import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { callAiWithFallback } from '../_shared/ai-service.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { resumeText, userId, jobRole = 'Software Engineer' } = await req.json()

    if (!resumeText) {
      throw new Error('resumeText is required')
    }

    const systemPrompt = `
    You are an expert AI recruiter and ATS (Applicant Tracking System) software.
    Evaluate candidates strictly based on the requirements and expectations for a ${jobRole}.
    `

    const userMessage = `
    Analyze the following resume text specifically for the role of "${jobRole}".
    
    Resume Text:
    ${resumeText.substring(0, 15000)}
    
    Provide a JSON response with the following exact structure:
    {
      "ats_score": (integer out of 100),
      "strengths": ["list of 3-5 key strengths matched to the ${jobRole} role"],
      "weaknesses": ["list of 2-4 areas of improvement"],
      "skills_found": ["list of key technical skills found"],
      "missing_skills": ["list of 2-4 critical skills expected for a ${jobRole} but missing"],
      "dos": ["3-5 specific 'Dos' (e.g., 'Do highlight your experience with X', 'Do quantify Y metrics') tailored to this resume and role"],
      "donts": ["3-5 specific 'Donts' (e.g., 'Don't use generic descriptions for Z', 'Don't forget to mention A') tailored to this resume and role"],
      "suggestions": ["2-4 broader actionable suggestions for career growth in ${jobRole} role"]
    }
    
    Only return valid JSON without any markdown formatting wrappers or explanation.
    `

    const aiResponse = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.3,
      responseMimeType: 'application/json'
    });

    const analysisResult = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    if (!analysisResult) {
      throw new Error('AI analysis failed to produce a result.')
    }

    // Increment usage counter if userId is provided
    if (userId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: profile } = await supabase
        .from('profiles')
        .select('resume_analyses_used_this_month')
        .eq('id', userId)
        .single();
      
      await supabase
        .from('profiles')
        .update({ resume_analyses_used_this_month: (profile?.resume_analyses_used_this_month || 0) + 1 })
        .eq('id', userId);

      // --- NEW: Generate Learning Path for Resume ---
      try {
        const weaknesses = analysisResult.weaknesses || []
        const missing_skills = analysisResult.missing_skills || []
        const suggestions = analysisResult.suggestions || []
        
        const allGaps = Array.from(new Set([...weaknesses, ...missing_skills, ...suggestions]))
        
        if (allGaps.length > 0) {
          const { data: resourcesData, error: resourcesError } = await supabase.functions.invoke('fetch-resources', {
            body: { topics: allGaps }
          })

          if (!resourcesError && resourcesData) {
            // Get the last resume analysis ID to link
            const { data: latestAnalysis } = await supabase
              .from('resume_analysis')
              .select('id')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (latestAnalysis) {
              const learningPathEntries = allGaps.map(gap => ({
                user_id: userId,
                title: gap,
                description: `Improvement identified from resume analysis: ${gap}`,
                resources: resourcesData[gap] || [],
                source_type: 'resume_analysis',
                source_id: latestAnalysis.id,
                is_completed: false
              }))

              const { error: lpError } = await supabase
                .from('learning_paths')
                .insert(learningPathEntries)
              
              if (lpError) console.error('Error inserting learning paths:', lpError)
            }
          }
        }
      } catch (lpErr) {
        console.error('Failed to generate learning path for resume:', lpErr)
      }
      // --- END NEW ---
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge Function Error:', (error as any).message)
    return new Response(JSON.stringify({ error: (error as any).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
