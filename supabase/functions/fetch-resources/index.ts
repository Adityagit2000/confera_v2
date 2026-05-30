import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest } from '../_shared/request-context.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const PRE_FETCHED_RESOURCES: Record<string, {title: string, url: string}[]> = {
  "SQL Window Functions": [
    {
      "title": "Database SQL Primer (Part 2) [ Window Functions ] - LeetCode Discuss",
      "url": "https://leetcode.com/discuss/study-guide/1600719/database-sql-primer-part-2-window-functions/"
    },
    {
      "title": "Top SQL 50 Study Plan - LeetCode",
      "url": "https://leetcode.com/studyplan/top-sql-50/"
    },
    {
      "title": "SQL Window Functions Tutorial - PostgreSQL Documentation",
      "url": "https://www.postgresql.org/docs/current/tutorial-window.html"
    }
  ],
  "PySpark Optimization": [
    {
      "title": "Performance Tuning - Apache Spark 3.5.0 Official Documentation",
      "url": "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    },
    {
      "title": "PySpark Optimization Full Course 2025 (Step-By-Step)",
      "url": "https://www.youtube.com/watch?v=CY_WaxCxJco"
    },
    {
      "title": "Tuning Apache Spark - Best Practices",
      "url": "https://spark.apache.org/docs/latest/tuning.html"
    }
  ],
  "Python LLM development": [
    {
      "title": "LangChain Python - Introduction and Quickstart",
      "url": "https://python.langchain.com/docs/get_started/introduction"
    },
    {
      "title": "LlamaIndex Documentation - Data Framework for LLM Apps",
      "url": "https://docs.llamaindex.ai/en/stable/"
    },
    {
      "title": "Build Your Own LLM App with Python (freeCodeCamp)",
      "url": "https://www.youtube.com/watch?v=UU1WVnMk4E8"
    }
  ],
  "Vector Databases (Pinecone/Weaviate)": [
    {
      "title": "Pinecone Quickstart Guide - Semantic Search & RAG",
      "url": "https://docs.pinecone.io/guides/get-started/quickstart"
    },
    {
      "title": "Weaviate Quickstart - Cloud Deployment and Setup",
      "url": "https://docs.weaviate.io/weaviate/quickstart"
    },
    {
      "title": "The Complete Guide to Vector Database Fundamentals",
      "url": "https://www.youtube.com/watch?v=8KrTO9bS91s"
    }
  ]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  try {
    // Authenticate request
    const auth = await authenticateRequest(req, getCorsHeaders(req.headers.get('origin')))
    if ('response' in auth) return auth.response

    const { topics } = await req.json()
    const results: Record<string, {title: string, url: string}[]> = {}

    for (const topic of topics) {
      if (PRE_FETCHED_RESOURCES[topic]) {
        results[topic] = PRE_FETCHED_RESOURCES[topic]
        continue
      }

      // If not in pre-fetched, use Gemini to suggest links
      // This is a fallback since we can't call the Browser Agent tool here
      if (GEMINI_API_KEY) {
        const prompt = `Find 3 high-quality learning resources (LeetCode practice links or official documentation) for the topic: "${topic}". 
        Return ONLY a JSON array of objects with "title" and "url" keys.
        Example: [{"title": "LeetCode SQL 50", "url": "https://leetcode.com/studyplan/top-sql-50/"}]`

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        })

        if (response.ok) {
          const data = await response.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]"
          try {
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            results[topic] = JSON.parse(cleaned)
          } catch (e) {
            console.error(`Error parsing AI response for ${topic}:`, e)
            results[topic] = []
          }
        } else {
          results[topic] = []
        }
      } else {
        results[topic] = []
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
