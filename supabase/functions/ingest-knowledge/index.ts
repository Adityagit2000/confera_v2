import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  console.log('--- ingest-knowledge: Function called ---');

  try {
    // 1. Service Role Authentication
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      throw new Error('Unauthorized: Service Role key required');
    }

    const { items } = await req.json();

    if (!items || !Array.isArray(items)) {
      throw new Error('items array is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!);
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    let successCount = 0;

    // 2. Process items with rate limiting
    for (const item of items) {
      const { topic, subject, branch, content, source } = item;

      if (!topic || !subject || !branch || !content) {
        console.warn('ingest-knowledge: Skipping invalid item', item);
        continue;
      }

      try {
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "models/text-embedding-004",
              content: { parts: [{ text: `Topic: ${topic}\nSubject: ${subject}\nBranch: ${branch}\nContent: ${content}` }] }
            })
          }
        );

        if (!embedRes.ok) {
          throw new Error(`Embedding API failed: ${await embedRes.text()}`);
        }

        const embedData = await embedRes.json();
        const embedding = embedData.embedding?.values;

        if (embedding) {
          const { error: insertError } = await supabase
            .from('knowledge_base')
            .insert({
              topic,
              subject,
              branch,
              content,
              source,
              embedding
            });

          if (insertError) {
            console.error('ingest-knowledge: DB Insert Error:', insertError);
          } else {
            successCount++;
          }
        }
      } catch (err) {
        console.error('ingest-knowledge: Processing Error:', err);
      }

      // Rate Limiting: 100ms delay to stay within 10 req/s
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`ingest-knowledge: Successfully ingested ${successCount} items`);

    return new Response(JSON.stringify({
      success: true,
      ingested_count: successCount,
      total_attempted: items.length
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('FATAL ERROR in ingest-knowledge:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: error.message.includes('Unauthorized') ? 401 : 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
})
