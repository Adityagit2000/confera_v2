import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- analyze-resume: Function started ---');

  try {
    const body = await req.json();
    const { resumePath, resumeId, jobRole } = body;
    console.log(`Payload: resumePath=${resumePath}, resumeId=${resumeId}, jobRole=${jobRole}`);

    if (!resumeId) throw new Error('resumeId is required');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the resume record to verify path
    const { data: resume, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .single();

    if (fetchError || !resume) throw new Error(`Resume record not found for ID: ${resumeId}`);

    // --- SANITIZATION ---
    const sanitizeJobRole = (role: string): string => {
      if (!role) return 'Software Engineer';
      return role
        .replace(/[;()"'<>]/g, '') // Strip symbols
        .substring(0, 50)           // Limit length
        .trim() || 'Software Engineer';
    };
    const safeJobRole = sanitizeJobRole(jobRole);
    // -------------------

    // --- PAYWALL ENFORCEMENT ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan, plan_expires_at, resume_analyses_used_this_month')
      .eq('id', resume.user_id)
      .single()

    if (profileError) {
      console.error('Error fetching profile for paywall check:', profileError)
      throw new Error('Failed to verify subscription status')
    }

    const isPro = profile.plan === 'pro' && 
      (profile.plan_expires_at ? new Date(profile.plan_expires_at) > new Date() : false)
    
    if (!isPro && (profile.resume_analyses_used_this_month || 0) >= 2) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Resume analysis limit reached', 
        details: 'You have used your 2 free resume analyses for this month. Upgrade to Pro for unlimited access.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    // ---------------------------

    const finalPath = resumePath || resume.file_url;
    console.log(`Using path for analysis: ${finalPath}`);

    // 2. Generate a fresh signed URL
    const { data: signedUrlData, error: signedError } = await supabaseAdmin
      .storage
      .from('resumes')
      .createSignedUrl(finalPath, 120);

    if (signedError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${signedError?.message}`);
    }
    
    const signedUrl = signedUrlData.signedUrl;
    console.log('Signed URL generated successfully');

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
    Evaluate candidates strictly based on the requirements and expectations for a ${safeJobRole}.
    `;

    const userPrompt = `
    Analyze this resume text for a ${safeJobRole} position.
    URL: ${signedUrl}

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

    Resume text should be fetched from the signed URL provided above.
    `;
    
    const aiResponse = await callAiWithFallback({
      systemPrompt,
      userMessage: userPrompt,
      temperature: 0.1,
      responseMimeType: 'application/json'
    });
    
    console.log('AI Response received');

    const parsed = safeParseJSON(aiResponse);

    const standardizedData = {
      contact: {
        name: parsed.contact?.name || null,
        email: parsed.contact?.email || null,
        phone: parsed.contact?.phone || null
      },
      skills: parsed.skills || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      suggestions: parsed.suggestions || [],
      dos: parsed.dos || [],
      donts: parsed.donts || [],
      improvement_roadmap: parsed.improvement_roadmap || []
    };

    // Fix 3: Log exactly what is being saved
    console.log('Saving to DB - ats_score:', parsed.ats_score);
    console.log('Saving to DB - parsed_data:', JSON.stringify(standardizedData).substring(0, 500));
    console.log('Saving to DB - keywords_missing:', JSON.stringify(parsed.missing_keywords));

    // 4. Update the resume record with standardized structure
    const { error: updateError } = await supabaseAdmin
      .from('resumes')
      .update({
        ats_score: parsed.ats_score,
        keywords_missing: parsed.missing_keywords || [],
        parsed_data: standardizedData
      })
      .eq('id', resumeId);

    if (updateError) throw new Error(`Failed to update resume record: ${updateError.message}`);

    // Increment usage counter for non-pro users
    if (!isPro) {
      const { error: incrementError } = await supabaseAdmin
        .from('profiles')
        .update({ resume_analyses_used_this_month: (profile.resume_analyses_used_this_month || 0) + 1 })
        .eq('id', resume.user_id);
      
      if (incrementError) {
        console.error('Error incrementing resume usage counter:', incrementError);
      }
    }

    console.log('Analysis completed and saved.');

    // Fix 4: Return full analysis results directly
    return new Response(JSON.stringify({ 
      success: true, 
      ats_score: parsed.ats_score,
      parsed_data: standardizedData,
      keywords_missing: parsed.missing_keywords || [],
      message: `Analysis complete. ATS Score: ${parsed.ats_score}%`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in analyze-resume:', error.message, error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})