import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { callAiWithFallback } from '../_shared/ai-service.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('--- generate-test: Function called ---');

  try {
    let userId: string;
    let dbClient: any;
    const body = await req.json();
    
    const auth = await authenticateRequest(req, corsHeaders)
    if ('response' in auth) return auth.response
    userId = auth.user.id;
    dbClient = auth.supabase;

    const { branch, test_type, question_count = 30 } = body;

    if (!test_type) {
      throw new Error('test_type is required');
    }
    if (!branch) {
      throw new Error('branch is required');
    }

    // 1. Fetch previously asked questions
    const { data: pastSessions } = await dbClient
      .from('test_sessions')
      .select('questions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    let pastQuestions: string[] = [];
    if (pastSessions && pastSessions.length > 0) {
      pastSessions.forEach((session: any) => {
        if (session.questions && Array.isArray(session.questions)) {
          pastQuestions.push(...session.questions.map((q: any) => q.question));
        }
      });
    }

    const pastQuestionsText = pastQuestions.length > 0 
      ? `DO NOT REPEAT THESE PREVIOUS QUESTIONS:\n${pastQuestions.join('\n')}` 
      : 'No previous questions for this user.';

    // 2. Perform RAG lookup on knowledge_base
    let referenceKnowledge = 'No reference knowledge found.';
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "models/text-embedding-004",
              content: { parts: [{ text: `${test_type} ${branch}` }] }
            })
          }
        );
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const embedding = embedData.embedding?.values;
          if (embedding) {
            const { data: kbData, error: kbError } = await dbClient.rpc('match_knowledge_base', {
              query_embedding: embedding,
              match_threshold: 0.5,
              match_count: 10
            });
            
            if (!kbError && kbData && kbData.length > 0) {
              referenceKnowledge = kbData.map((kb: any) => kb.content).join('\n\n');
              console.log(`generate-test: Found ${kbData.length} reference chunks`);
            } else if (kbError) {
              console.error('generate-test: RAG match error', kbError);
            }
          }
        } else {
           console.warn('generate-test: Failed to fetch embeddings', await embedRes.text());
        }
      } catch (err) {
        console.error('generate-test: Embedding generation exception', err);
      }
    }

    // 3. Generate questions
    const systemPrompt = `You are a senior placement examiner with 15 years of experience setting papers for TCS, Infosys, Wipro, Accenture, Deloitte, McKinsey, and GATE. You know exactly what Indian placement drives test and what companies actually ask. Generate a placement preparation test. STRICT RULES: Never repeat or closely rephrase any question from the PREVIOUSLY ASKED list. Mix difficulty exactly: 40% easy, 40% medium, 20% hard. Include conceptual questions, application/scenario questions, and tricky edge-case questions that test deep understanding not memorization. Use the REFERENCE KNOWLEDGE provided to make questions accurate and grounded in real syllabus content. For aptitude tests include: quantitative (percentages profit loss time speed distance probability permutation combination series averages), logical reasoning (seating arrangement blood relations coding decoding direction sense syllogisms), verbal (sentence correction vocabulary reading comprehension para jumbles). For CSE technical include: DSA (arrays strings linked lists stacks queues trees graphs DP sorting searching hashing time/space complexity), OOPs (encapsulation inheritance polymorphism abstraction SOLID principles design patterns with real code scenarios), DBMS (normalization 1NF to BCNF SQL queries joins subqueries window functions indexing B+ tree transactions ACID deadlock), OS (process thread CPU scheduling algorithms with Gantt charts memory management paging segmentation virtual memory page replacement deadlock detection), CN (OSI 7 layers TCP/IP HTTP HTTPS DNS DHCP routing protocols subnetting CIDR TCP handshake congestion control). Return ONLY a valid JSON array of exactly ${question_count} objects. Each object: question (string), options (array of exactly 4 strings), correct_answer (integer 0 to 3), explanation (string 2-3 sentences with why correct answer is right and why others are wrong), topic (string), difficulty (easy or medium or hard). Absolutely no markdown, no code fences, no preamble. Raw JSON array only.`;

    const userMessage = `Generate a test for test type: ${test_type}, Branch: ${branch}, count: ${question_count}.
    
PREVIOUSLY ASKED:
${pastQuestionsText}

REFERENCE KNOWLEDGE:
${referenceKnowledge}`;

    let responseText = await callAiWithFallback({
      systemPrompt,
      userMessage,
      temperature: 0.7,
      maxTokens: 8000,
      responseMimeType: 'application/json'
    });

    let questions: any;
    let parseSuccess = false;
    
    const parseResponse = (text: string) => {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let q = JSON.parse(cleaned);
      if (!Array.isArray(q)) {
        if (q.questions && Array.isArray(q.questions)) q = q.questions;
        else throw new Error('Expected JSON array');
      }
      return q;
    };

    try {
      questions = parseResponse(responseText);
      parseSuccess = true;
    } catch {
      console.warn('generate-test: JSON parse failed. Retrying once.');
      // Retry logic
      responseText = await callAiWithFallback({
        systemPrompt: systemPrompt + " YOU MUST FIX THE JSON. IT WAS INVALID BEFORE. RAW ARRAY ONLY.",
        userMessage,
        temperature: 0.2,
        maxTokens: 8000,
        responseMimeType: 'application/json'
      });
      questions = parseResponse(responseText);
      parseSuccess = true;
    }

    if (!parseSuccess || !questions || questions.length === 0) {
      throw new Error('AI failed to generate valid questions array');
    }

    // 4. Create test_session row
    const { data: sessionData, error: sessionError } = await dbClient
      .from('test_sessions')
      .insert({
        user_id: userId,
        branch,
        test_type,
        questions,
        total_questions: questions.length,
        status: 'in_progress'
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('generate-test: Session creation error:', sessionError);
      throw new Error('Failed to create test session in DB');
    }

    // 5. Return to frontend WITHOUT correct answers
    const safeQuestions = questions.map((q: any) => {
      const { correct_answer, explanation, ...safeQ } = q;
      return safeQ;
    });

    console.log(`generate-test: Successfully generated ${questions.length} questions for session ${sessionData.id}`);

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionData.id,
      questions: safeQuestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in generate-test:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
