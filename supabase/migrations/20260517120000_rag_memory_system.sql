-- ============================================================
-- RAG Memory System & Agentic Intelligence Layer
-- Migration: pgvector, transcript_embeddings, prep_plans,
--            user_skill_memory extensions, vector search RPC
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Transcript Embeddings (RAG vector store)
CREATE TABLE IF NOT EXISTS public.transcript_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    interview_type TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    embedding extensions.vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transcript_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own embeddings"
    ON public.transcript_embeddings FOR SELECT
    USING (auth.uid() = user_id);

-- Insert via service_role key only (edge functions)
CREATE POLICY "Service can insert embeddings"
    ON public.transcript_embeddings FOR INSERT
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_user_id
    ON public.transcript_embeddings(user_id);

CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_session_id
    ON public.transcript_embeddings(session_id);

CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_type
    ON public.transcript_embeddings(user_id, interview_type);

-- HNSW vector index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_vector
    ON public.transcript_embeddings
    USING hnsw (embedding extensions.vector_cosine_ops);


-- 3. Prep Plans table
CREATE TABLE IF NOT EXISTS public.prep_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_focus TEXT NOT NULL,
    coaching_note TEXT NOT NULL,
    priority_interview_type TEXT NOT NULL,
    daily_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prep_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prep plans"
    ON public.prep_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service can insert prep plans"
    ON public.prep_plans FOR INSERT
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_prep_plans_user_id
    ON public.prep_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_prep_plans_created_at
    ON public.prep_plans(user_id, created_at DESC);


-- 4. Extend user_skill_memory with behavioral metrics
ALTER TABLE public.user_skill_memory
    ADD COLUMN IF NOT EXISTS filler_word_rate FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS avg_answer_length INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;


-- 5. RPC function for vector similarity search
--    Encapsulates the pgvector query so edge functions just pass a float array
CREATE OR REPLACE FUNCTION match_transcript_embeddings(
    query_embedding extensions.vector(768),
    match_user_id UUID,
    match_interview_type TEXT,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    question TEXT,
    answer TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.id,
        te.session_id,
        te.question,
        te.answer,
        1 - (te.embedding <=> query_embedding) AS similarity
    FROM public.transcript_embeddings te
    WHERE te.user_id = match_user_id
      AND te.interview_type = match_interview_type
    ORDER BY te.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
