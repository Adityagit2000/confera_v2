/**
 * Shared Embedding Service for Confera
 * Uses Google Gemini text-embedding-004 (768 dimensions)
 * Reusable across embed-session, ai-interview-chat, etc.
 */

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingResult {
  values: number[];
}

/**
 * Generate a vector embedding for the given text using Gemini text-embedding-004.
 * Returns a 768-dimensional float array.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    throw new Error('[Embedding] GEMINI_API_KEY is not set');
  }

  // Truncate very long text to avoid token limits (embedding model handles ~2048 tokens)
  const truncated = text.length > 8000 ? text.substring(0, 8000) : text;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${geminiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: truncated }]
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[Embedding] Gemini embedding failed (${response.status}): ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;

  if (!values || !Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`[Embedding] Unexpected embedding shape: got ${values?.length || 0} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }

  return values;
}

/**
 * Generate embeddings for multiple texts in sequence.
 * Returns an array of 768-dimensional float arrays.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await getEmbedding(text);
    results.push(embedding);
  }
  return results;
}
