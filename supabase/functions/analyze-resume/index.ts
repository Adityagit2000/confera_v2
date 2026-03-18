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
    const systemPrompt = `You are an ATS (Applicant Tracking System) expert. Analyze the resume provided via the URL and evaluate it against the role: "${jobRole || 'General Member'}".
    Respond STRICTLY in JSON format:
    {
      "ats_score": 85,
      "feedback": "Strong technical skills, but needs more quantifiable impact metrics.",
      "skills_found": ["React", "TypeScript", "Node.js"],
      "missing_keywords": ["AWS", "Docker"],
      "improvements": ["Add metrics", "Highlight leadership"]
    }`;

    const userPrompt = `Analysis needed for this resume: ${signedUrl}`;
    
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