import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate request
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    const { user, supabase } = auth

    const { resumeText, jobRole = 'Software Engineer' } = await req.json()
    // Use authenticated user ID instead of client-provided userId
    const userId = user.id

    if (!resumeText) {
      throw new Error('resumeText is required')
    }

    // Safe JSON parsing helper
    function safeParseJSON(text: string): any {
      try {
        const cleaned = text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        return JSON.parse(cleaned);
      } catch (e) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e2) {
            throw new Error(`Failed to parse AI response as JSON: ${text.substring(0, 200)}`);
          }
        }
        throw new Error(`No valid JSON found in response: ${text.substring(0, 200)}`);
      }
    }

    // 3. Call AI for analysis
    const systemPrompt = `
    You are an expert ATS resume analyzer. You must respond with ONLY a valid JSON object, no markdown, no explanation, no extra text. Just the raw JSON.
    Evaluate candidates strictly based on the requirements and expectations for a ${jobRole}.
    `;

    const userMessage = `
    Analyze this resume text specifically for the role of "${jobRole}".
    
    Resume Text:
    ${resumeText.substring(0, 15000)}
    
    Return ONLY this exact JSON structure with no deviations:
    {
      "ats_score": <integer 0-100>,
      "contact": {
        "name": "<full name>",
        "email": "<email>",
        "phone": "<phone number>"
      },
      "skills": ["skill1", "skill2"],
      "experience": [{"title": "", "company": "", "duration": "", "description": ""}],
      "education": [{"degree": "", "school": "", "year": ""}],
      "missing_keywords": [{"keyword": "", "importance": <1-10>}],
      "strengths": ["strength1"],
      "weaknesses": ["weakness1"],
      "suggestions": ["suggestion1"],
      "dos": ["do1", "do2"],
      "donts": ["dont1", "dont2"],
      "improvement_roadmap": [{"step": "", "impact": "", "priority": ""}]
    }
    `;

    const aiResponse = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.2,
      responseMimeType: 'application/json'
    });

    const analysisResult = safeParseJSON(aiResponse);

    if (!analysisResult) {
      throw new Error('AI analysis failed to produce a result.')
    }

    // Standardized data structure for saving/returning
    const standardizedData = {
      contact: {
        name: analysisResult.contact?.name || null,
        email: analysisResult.contact?.email || null,
        phone: analysisResult.contact?.phone || null
      },
      skills: analysisResult.skills || [],
      experience: analysisResult.experience || [],
      education: analysisResult.education || [],
      strengths: analysisResult.strengths || [],
      weaknesses: analysisResult.weaknesses || [],
      suggestions: analysisResult.suggestions || [],
      dos: analysisResult.dos || [],
      donts: analysisResult.donts || [],
      improvement_roadmap: analysisResult.improvement_roadmap || []
    };

    // Increment usage counter & update resume record if userId is provided
    if (userId) {
      
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

      const resumeData = {
        user_id: userId,
        ats_score: analysisResult.ats_score,
        parsed_data: standardizedData,
        keywords_missing: analysisResult.missing_keywords || [],
      };

      // Fix 3: Log exactly what is being saved
      console.log('Saving to DB - ats_score:', analysisResult.ats_score);
      console.log('Saving to DB - parsed_data:', JSON.stringify(standardizedData).substring(0, 500));
      console.log('Saving to DB - keywords_missing:', JSON.stringify(analysisResult.missing_keywords));

      // Update OR Insert the resumes record
      const { data: latestResume } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestResume) {
        await supabase
          .from('resumes')
          .update(resumeData)
          .eq('id', latestResume.id);
      } else {
        await supabase
          .from('resumes')
          .insert(resumeData);
      }

      // Also save to resume_analysis for history
      const { data: analysisRecord } = await supabase
        .from('resume_analysis' as any)
        .insert({
          user_id: userId,
          ats_score: analysisResult.ats_score,
          analysis: {
            ...analysisResult,
            parsed_data: standardizedData,
            keywords_missing: analysisResult.missing_keywords || []
          }
        })
        .select('id')
        .single();

      // --- NEW: Generate Learning Path for Resume ---
      try {
        const weaknesses = standardizedData.weaknesses || []
        const suggestions = standardizedData.suggestions || []
        const missing_keywords = (analysisResult.missing_keywords || []).map((k: any) => k.keyword)
        
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

    // Fix 4: Return full analysis results directly
    return new Response(JSON.stringify({ 
      success: true, 
      ats_score: analysisResult.ats_score,
      parsed_data: standardizedData,
      keywords_missing: analysisResult.missing_keywords || [],
      message: `Analysis complete. ATS Score: ${analysisResult.ats_score}%`
    }), {
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
