import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeErrorResponse(message: string, status: number, details?: string) {
  console.error(`[analyze-resume] ERROR (${status}): ${message}${details ? ' | ' + details : ''}`)
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details: details || null,
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

function safeParseJSON(text: string): any {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    return JSON.parse(cleaned)
  } catch (_e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (_e2) {
        throw new Error(`Failed to parse AI response as JSON: ${text.substring(0, 300)}`)
      }
    }
    throw new Error(`No valid JSON found in AI response: ${text.substring(0, 300)}`)
  }
}

const sanitizeJobRole = (role: string): string => {
  if (!role) return 'Software Engineer'
  return role
    .replace(/[;()"'<>]/g, '')
    .substring(0, 50)
    .trim() || 'Software Engineer'
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- analyze-resume: Function started ---')

  // ─── Step 0: Authenticate request ────────────────────────────────────────
  const auth = await authenticateRequest(req, corsHeaders)
  if ('response' in auth) return auth.response
  const { user, supabase: supabaseAdmin } = auth

  // ─── Step 1: Parse request body ──────────────────────────────────────────
  let resumePath: string | undefined
  let resumeId: string | undefined
  let jobRole: string | undefined

  try {
    console.log('[Step 1] Parsing request body...')
    const body = await req.json()
    resumePath = body.resumePath
    resumeId = body.resumeId
    jobRole = body.jobRole
    console.log(`[Step 1] Payload: resumePath=${resumePath}, resumeId=${resumeId}, jobRole=${jobRole}`)
  } catch (err: any) {
    return makeErrorResponse(
      'Invalid request body',
      400,
      `Failed to parse JSON body: ${err.message}`
    )
  }

  if (!resumeId) {
    return makeErrorResponse('resumeId is required', 400)
  }

  const safeJobRole = sanitizeJobRole(jobRole || '')

  // ─── Step 2: Fetch resume record ─────────────────────────────────────────
  let resume: any
  try {
    console.log('[Step 2] Fetching resume record from database...')
    const { data, error } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .single()

    if (error) {
      return makeErrorResponse(
        'Resume record not found',
        404,
        `Supabase query error: ${error.message} (code: ${error.code})`
      )
    }
    if (!data) {
      return makeErrorResponse('Resume record not found', 404, `No record for ID: ${resumeId}`)
    }

    // Verify ownership — user can only analyze their own resume
    if (data.user_id !== user.id) {
      return makeErrorResponse('Forbidden: resume does not belong to this user', 403)
    }

    resume = data
    console.log(`[Step 2] Resume record found. user_id=${resume.user_id}, file_url=${resume.file_url}`)
  } catch (err: any) {
    return makeErrorResponse(
      'Failed to fetch resume record',
      500,
      `Exception during DB query: ${err.message}\n${err.stack}`
    )
  }

  // ─── Step 3: Paywall enforcement ─────────────────────────────────────────
  let isPro = false
  let profile: any
  try {
    console.log('[Step 3] Checking subscription status...')
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan, plan_expires_at, resume_analyses_used_this_month')
      .eq('id', resume.user_id)
      .single()

    if (profileError) {
      return makeErrorResponse(
        'Failed to verify subscription status',
        500,
        `Profile query error: ${profileError.message} (code: ${profileError.code})`
      )
    }

    profile = profileData
    isPro = profile.plan === 'pro' &&
      (profile.plan_expires_at ? new Date(profile.plan_expires_at) > new Date() : false)

    console.log(`[Step 3] Plan: ${profile.plan}, isPro: ${isPro}, analyses used: ${profile.resume_analyses_used_this_month || 0}`)

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
  } catch (err: any) {
    return makeErrorResponse(
      'Paywall check failed',
      500,
      `Exception during paywall enforcement: ${err.message}\n${err.stack}`
    )
  }

  // ─── Step 4: Download resume from Storage ────────────────────────────────
  const finalPath = resumePath || resume.file_url
  let resumeTextContent = ''

  try {
    console.log(`[Step 4] Downloading resume file from Storage. Path: ${finalPath}`)
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('resumes')
      .download(finalPath)

    if (downloadError || !fileData) {
      return makeErrorResponse(
        'Failed to download resume file from storage',
        500,
        `Storage download error: ${downloadError?.message || 'No data returned'}. Path: ${finalPath}`
      )
    }

    // Extract text content from the downloaded blob
    const arrayBuffer = await fileData.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    console.log(`[Step 4] File downloaded successfully. Size: ${bytes.length} bytes`)

    // For PDF files, we'll pass the raw text extraction attempt
    // The AI model will receive the file content as base64 or raw text
    try {
      resumeTextContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      // If it's a PDF, the text will contain binary data — that's OK, we'll also generate a signed URL
      console.log(`[Step 4] Text decoded. Length: ${resumeTextContent.length} chars (first 100: ${resumeTextContent.substring(0, 100).replace(/[^\x20-\x7E]/g, '?')})`)
    } catch (decodeErr: any) {
      console.warn(`[Step 4] Text decode warning (non-fatal): ${decodeErr.message}`)
    }
  } catch (err: any) {
    return makeErrorResponse(
      'Failed to download resume from storage',
      500,
      `Exception during file download: ${err.message}\n${err.stack}`
    )
  }

  // ─── Step 5: Generate signed URL for AI access ───────────────────────────
  let signedUrl = ''
  try {
    console.log('[Step 5] Generating signed URL for AI model access...')
    const { data: signedUrlData, error: signedError } = await supabaseAdmin
      .storage
      .from('resumes')
      .createSignedUrl(finalPath, 300) // 5 minute expiry

    if (signedError || !signedUrlData?.signedUrl) {
      return makeErrorResponse(
        'Failed to generate signed URL',
        500,
        `Signed URL error: ${signedError?.message || 'No signed URL returned'}. Path: ${finalPath}`
      )
    }

    signedUrl = signedUrlData.signedUrl
    console.log('[Step 5] Signed URL generated successfully')
  } catch (err: any) {
    return makeErrorResponse(
      'Failed to generate signed URL',
      500,
      `Exception during signed URL generation: ${err.message}\n${err.stack}`
    )
  }

  // ─── Step 6: Call AI for analysis ────────────────────────────────────────
  let aiResponse = ''
  try {
    console.log('[Step 6] Calling AI service for resume analysis...')

    const systemPrompt = `
    You are an expert resume analyst and ATS specialist.
    Analyze the following resume and return ONLY a JSON object. No markdown. No explanation.
    Evaluate candidates strictly based on the requirements and expectations for a ${safeJobRole}.
    `

    const userPrompt = `
    Analyze this resume text for a ${safeJobRole} position.
    URL: ${signedUrl}

    Return ONLY this exact JSON structure with no deviations:
    {
      "candidate_name": "<full name>",
      "total_experience_years": <integer>,
      "technical_skills": ["skill1", "skill2"],
      "soft_skills": ["skill1", "skill2"],
      "job_roles": ["role1"],
      "key_achievements": ["achievement1"],
      "ats_score": <integer 0-100>,
      "ats_improvements": ["improvement1"],
      "summary": "<2-3 lines>"
    }

    Resume text should be fetched from the signed URL provided above.
    `

    aiResponse = await callAiWithFallback({
      systemPrompt,
      userMessage: userPrompt,
      temperature: 0.1,
      responseMimeType: 'application/json'
    })

    console.log(`[Step 6] AI response received. Length: ${aiResponse?.length || 0} chars`)
    console.log(`[Step 6] AI response preview: ${aiResponse?.substring(0, 300)}`)
  } catch (err: any) {
    return makeErrorResponse(
      'AI analysis failed',
      502,
      `All AI providers failed. Error: ${err.message}\n${err.stack}`
    )
  }

  // ─── Step 7: Parse AI response ───────────────────────────────────────────
  let parsed: any
  try {
    console.log('[Step 7] Parsing AI response as JSON...')
    parsed = safeParseJSON(aiResponse)
    console.log(`[Step 7] Parsed successfully. ATS Score: ${parsed.ats_score}, Candidate: ${parsed.candidate_name}`)
  } catch (err: any) {
    return makeErrorResponse(
      'Failed to parse AI response',
      502,
      `JSON parse error: ${err.message}`
    )
  }

  // ─── Step 8: Build standardized data structure ───────────────────────────
  const standardizedData = {
    contact: {
      name: parsed.candidate_name || null,
      email: null,
      phone: null
    },
    skills: [...(parsed.technical_skills || []), ...(parsed.soft_skills || [])],
    experience: parsed.job_roles?.map((role: string) => ({
      title: role,
      company: "Unknown",
      duration: `${parsed.total_experience_years} years total`,
      description: ""
    })) || [],
    education: [],
    strengths: parsed.key_achievements || [],
    weaknesses: [],
    suggestions: parsed.ats_improvements || [],
    dos: [],
    donts: [],
    improvement_roadmap: parsed.ats_improvements?.map((imp: string) => ({
      step: imp,
      impact: "High",
      priority: "High"
    })) || [],

    // Preserve new fields
    candidate_name: parsed.candidate_name,
    total_experience_years: parsed.total_experience_years,
    technical_skills: parsed.technical_skills,
    soft_skills: parsed.soft_skills,
    job_roles: parsed.job_roles,
    key_achievements: parsed.key_achievements,
    summary: parsed.summary
  }

  console.log('[Step 8] Standardized data built successfully')
  console.log(`[Step 8] ats_score: ${parsed.ats_score}`)
  console.log(`[Step 8] parsed_data preview: ${JSON.stringify(standardizedData).substring(0, 500)}`)

  // ─── Step 9: Update resume record in database ───────────────────────────
  try {
    console.log('[Step 9] Upserting analysis results to database...')
    const updatePayload = {
      ats_score: parsed.ats_score,
      keywords_missing: parsed.ats_improvements?.map((imp: string) => ({ keyword: imp, importance: 8 })) || [],
      parsed_data: standardizedData
    }
    console.log(`[Step 9] Update payload keys: ${Object.keys(updatePayload).join(', ')}`)

    const { error: updateError } = await supabaseAdmin
      .from('resumes')
      .update(updatePayload)
      .eq('id', resumeId)

    if (updateError) {
      return makeErrorResponse(
        'Failed to save analysis results',
        500,
        `DB update error: ${updateError.message} (code: ${updateError.code})`
      )
    }
    console.log('[Step 9] Analysis results saved to database successfully')
  } catch (err: any) {
    return makeErrorResponse(
      'Failed to save analysis results',
      500,
      `Exception during DB update: ${err.message}\n${err.stack}`
    )
  }

  // ─── Step 10: Increment usage counter ────────────────────────────────────
  if (!isPro) {
    try {
      console.log('[Step 10] Incrementing usage counter for free-tier user...')
      const { error: incrementError } = await supabaseAdmin
        .from('profiles')
        .update({
          resume_analyses_used_this_month: (profile.resume_analyses_used_this_month || 0) + 1
        })
        .eq('id', resume.user_id)

      if (incrementError) {
        // Non-fatal — log but don't fail the request
        console.error(`[Step 10] WARNING: Failed to increment usage counter: ${incrementError.message}`)
      } else {
        console.log('[Step 10] Usage counter incremented successfully')
      }
    } catch (err: any) {
      // Non-fatal
      console.error(`[Step 10] WARNING: Exception incrementing counter: ${err.message}`)
    }
  }

  // ─── Step 11: Return success response ────────────────────────────────────
  console.log('--- analyze-resume: Function completed successfully ---')

  return new Response(JSON.stringify({
    success: true,
    ats_score: parsed.ats_score,
    parsed_data: standardizedData,
    keywords_missing: parsed.ats_improvements?.map((imp: string) => ({ keyword: imp, importance: 8 })) || [],
    message: `Analysis complete. ATS Score: ${parsed.ats_score}%`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})