import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not set' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  
  const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { jobRole } = await req.json();
    if (!jobRole) {
      return new Response(JSON.stringify({ error: 'jobRole is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Generating assessment for: ${jobRole}, user: ${user.id}`);

    let subTopics = '';
    if (jobRole === 'Data Engineering & Analytics') {
      subTopics = '\nCRITICAL FOCUS: Ensure the technical questions heavily test Advanced SQL (Window functions, CTEs), PySpark (Dataframes vs RDDs, transformations), Data Warehousing (Star vs Snowflake schema), and ETL/ELT pipelines.';
    } else if (jobRole === 'Generative AI & Machine Learning Engineering') {
      subTopics = '\nCRITICAL FOCUS: Ensure the technical questions heavily test LLM Architecture (Attention mechanism, Tokenization), RAG (Vector DBs, Embeddings), MLOps (Model monitoring, Deployment), and Model Evaluation (Precision, Recall, F1, ROC-AUC).';
    } else if (jobRole === 'Advanced Full-Stack & System Design') {
      subTopics = '\nCRITICAL FOCUS: Ensure the technical questions heavily test System Design (Load balancing, Caching, Sharding), Advanced React (Hooks, Performance optimization), Node.js (Event loop, Streams), and API Design (REST vs GraphQL).';
    }

    const prompt = `You are an Expert Technical Examiner. Generate a strict 20-question Multiple Choice Question (MCQ) assessment for the following job role/branch: "${jobRole}".${subTopics}

Distribution:
- 5 Aptitude & Logical Reasoning questions (Universal).
- 15 Core Technical questions strictly tailored to "${jobRole}". Ensure these are ORIGINAL, HIGH-QUALITY, and EXPERT-LEVEL questions.

Rules:
1. The technical questions MUST directly test the skills required for ${jobRole}. If it is a software role, include code snippets or architectural questions. If it is a core engineering role (Mechanical/Civil), test physics, materials, and domain-specific theorems. If it is business/finance, test case logic and formulas.
2. Provide 4 highly plausible options.
3. Return ONLY a valid JSON array of objects matching this schema:
[{
  "category": "Aptitude" | "Technical",
  "question_text": "string",
  "options": ["string", "string", "string", "string"],
  "correct_option": number (0-3),
  "explanation": "string"
}]`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json"
        }
      })
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('Gemini API Error:', errorText);
      throw new Error('Failed to generate assessment content');
    }

    const geminiData = await geminiRes.json();
    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    let questions;
    try {
      questions = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      throw new Error('AI returned invalid JSON format');
    }

    if (!Array.isArray(questions) || questions.length !== 20) {
       console.warn(`Generated ${questions.length} questions, expected 20.`);
       // We proceed anyway, though strictly we asked for 20.
    }

    // Insert Assessment
    const { data: assessment, error: assessmentError } = await supabaseAuth
      .from('assessments')
      .insert({
        user_id: user.id,
        job_role: jobRole,
        total_questions: questions.length,
        duration_minutes: 30,
        status: 'active'
      })
      .select('id')
      .single();

    if (assessmentError || !assessment) {
      console.error('Failed to create assessment record:', assessmentError);
      throw new Error('Failed to create assessment in database');
    }

    const assessmentId = assessment.id;

    // Prepare questions for bulk insert
    const dbQuestions = questions.map(q => ({
      assessment_id: assessmentId,
      category: q.category,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      explanation: q.explanation
    }));

    const { error: questionsError } = await supabaseAuth
      .from('assessment_questions')
      .insert(dbQuestions);

    if (questionsError) {
      console.error('Failed to insert assessment questions:', questionsError);
      // Rollback is manual in standard Supabase REST, ignoring for simplicity
      throw new Error('Failed to insert questions into database');
    }

    // Fetch the inserted questions back to return to the client without `correct_option`
    const { data: insertedQuestions, error: fetchError } = await supabaseAuth
      .from('assessment_questions')
      .select('id, category, question_text, options')
      .eq('assessment_id', assessmentId);

    if (fetchError) {
      console.error('Failed to fetch inserted questions:', fetchError);
      throw new Error('Failed to fetch generated questions');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      assessmentId,
      questions: insertedQuestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Edge Function Catch Block:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
