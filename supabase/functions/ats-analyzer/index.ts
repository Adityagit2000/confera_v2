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
    Extract contact information, skills, experience, and education from the resume.
    Calculate an ATS score (0-100) based on how well the candidate matches the ${jobRole} role.
    Identify missing keywords and assign an importance score (1-10) to each.
    `

    const userMessage = `
    Analyze the following resume text specifically for the role of "${jobRole}".
    
    Resume Text:
    ${resumeText.substring(0, 15000)}
    
    Provide a JSON response with the following exact structure:
    {
      "ats_score": (integer),
      "parsed_data": {
        "contact": { "name": "...", "email": "...", "phone": "..." },
        "skills": ["skill1", "skill2"],
        "experience": [{ "title": "...", "company": "...", "duration": "...", "description": "..." }],
        "education": [{ "degree": "...", "school": "...", "year": "..." }],
        "strengths": ["list of 3-5 key strengths"],
        "weaknesses": ["list of 2-4 areas of improvement"],
        "suggestions": ["2-4 broadly actionable suggestions"]
      },
      "keywords_missing": [
        { "keyword": "...", "importance": (1-10) }
      ],
      "dos": ["3-5 specific 'Dos'"],
      "donts": ["3-5 specific 'Donts'"],
      "improvement_roadmap": [
        { "step": "...", "impact": "+X points", "priority": "High/Medium/Low" }
      ]
    }
    
    Only return valid JSON without any markdown formatting wrappers or explanation.
    `

    const aiResponse = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.2,
      responseMimeType: 'application/json'
    });

    const analysisResult = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    if (!analysisResult) {
      throw new Error('AI analysis failed to produce a result.')
    }

    // Increment usage counter & update resume record if userId is provided
    if (userId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Update profile usage
      const { data: profile } = await supabase
        .from('profiles')
        .select('resume_analyses_used_this_month')
        .eq('id', userId)
        .single();
      
      await supabase
        .from('profiles')
        .update({ resume_analyses_used_this_month: (profile?.resume_analyses_used_this_month || 0) + 1 })
        .eq('id', userId);

      // IMPORTANT: Update OR Insert the resumes record
      // We look for the latest resume for this user or a specific one if provided
      const { data: latestResume } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const resumeData = {
        user_id: userId,
        ats_score: analysisResult.ats_score,
        parsed_data: analysisResult.parsed_data,
        keywords_missing: analysisResult.keywords_missing,
        // We also store the full result in resume_analysis for history if needed
      };

      let resumeIdToUse = '';

      if (latestResume) {
        resumeIdToUse = latestResume.id;
        await supabase
          .from('resumes')
          .update(resumeData)
          .eq('id', latestResume.id);
      } else {
        const { data: newResume } = await supabase
          .from('resumes')
          .insert(resumeData)
          .select('id')
          .single();
        if (newResume) resumeIdToUse = newResume.id;
      }

      // Also save to resume_analysis for backward compatibility or history
      const { data: analysisRecord } = await supabase
        .from('resume_analysis')
        .insert({
          user_id: userId,
          ats_score: analysisResult.ats_score,
          analysis: analysisResult
        })
        .select('id')
        .single();

      // --- NEW: Generate Learning Path for Resume ---
      try {
        const weaknesses = analysisResult.parsed_data.weaknesses || []
        const suggestions = analysisResult.parsed_data.suggestions || []
        const missing_keywords = (analysisResult.keywords_missing || []).map((k: any) => k.keyword)
        
        const allGaps = Array.from(new Set([...weaknesses, ...suggestions, ...missing_keywords]))
        
        if (allGaps.length > 0 && analysisRecord) {
          const { data: resourcesData, error: resourcesError } = await supabase.functions.invoke('fetch-resources', {
            body: { topics: allGaps }
          })

          if (!resourcesError && resourcesData) {
            const learningPathEntries = allGaps.map(gap => ({
              user_id: userId,
              title: gap,
              description: `Improvement identified from resume analysis: ${gap}`,
              resources: resourcesData[gap] || [],
              source_type: 'resume_analysis',
              source_id: analysisRecord.id,
              is_completed: false
            }))

            const { error: lpError } = await supabase
              .from('learning_paths')
              .insert(learningPathEntries)
            
            if (lpError) console.error('Error inserting learning paths:', lpError)
          }
        }
      } catch (lpErr) {
        console.error('Failed to generate learning path for resume:', lpErr)
      }
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
