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

    // 3. Call AI for analysis
    const systemPrompt = `
    You are an expert AI recruiter and ATS (Applicant Tracking System) software.
    Evaluate candidates strictly based on the requirements and expectations for a ${jobRole || 'Software Engineer'}.
    Extract contact information, skills, experience, and education from the resume.
    Calculate an ATS score (0-100) based on how well the candidate matches the role.
    Identify missing keywords and assign an importance score (1-10) to each.
    `;

    const userPrompt = `
    Analyze the resume provided via the URL specifically for the role of "${jobRole || 'Software Engineer'}".
    URL: ${signedUrl}

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
    `;
    
    const aiResponse = await callAiWithFallback({
      systemPrompt,
      userMessage: userPrompt,
      temperature: 0.1,
      responseMimeType: 'application/json'
    });
    
    console.log('AI Response received');

    const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // 4. Update the resume record
    const { error: updateError } = await supabaseAdmin
      .from('resumes')
      .update({
        ats_score: parsed.ats_score,
        parsed_data: parsed,
        keywords_missing: parsed.missing_keywords
      })
      .eq('id', resumeId);

    if (updateError) throw new Error(`Failed to update resume record: ${updateError.message}`);

    console.log('Analysis completed and saved.');

    return new Response(JSON.stringify({ 
      success: true, 
      results: parsed 
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