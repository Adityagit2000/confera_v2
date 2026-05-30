-- Migration: 20260530000000_ai_mock_upgrade.sql
-- Description: Creates knowledge_base, test_sessions, and certificates tables. Updates interview_answers and feedback_reports.

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================================
-- 1. KNOWLEDGE BASE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    subject TEXT NOT NULL,
    branch TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding 
ON public.knowledge_base 
USING hnsw (embedding vector_cosine_ops);

-- Enable RLS for knowledge_base
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policies for knowledge_base
CREATE POLICY "Authenticated users can read knowledge_base" 
ON public.knowledge_base FOR SELECT 
TO authenticated 
USING (true);

-- Insert policy restricted to service_role (only backend functions can insert)
CREATE POLICY "Service role can insert knowledge_base" 
ON public.knowledge_base FOR INSERT 
TO service_role 
WITH CHECK (true);

-- ==========================================
-- 2. TEST SESSIONS
-- ==========================================
-- Drop existing tables to recreate with new schema
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.test_sessions CASCADE;

CREATE TABLE public.test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch TEXT,
    test_type TEXT,
    questions JSONB,
    user_answers JSONB DEFAULT '{}'::jsonb,
    score INTEGER DEFAULT 0,
    total_questions INTEGER,
    time_taken_seconds INTEGER,
    status TEXT DEFAULT 'in_progress',
    certificate_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for test_sessions
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for test_sessions
CREATE POLICY "Users can manage their own test_sessions" 
ON public.test_sessions 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON public.test_sessions(user_id);

-- ==========================================
-- 3. CERTIFICATES
-- ==========================================
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    certificate_id TEXT UNIQUE,
    test_session_id UUID REFERENCES public.test_sessions(id),
    test_type TEXT,
    branch TEXT,
    score INTEGER,
    total_questions INTEGER,
    percentage INTEGER,
    issued_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for certificates
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Policies for certificates
CREATE POLICY "Users can view their own certificates" 
ON public.certificates 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Wait, the backend needs to insert. The authenticated user might insert if the edge function acts as the user, 
-- or we can just allow insert for the user. We'll use "ALL" or "INSERT" for the user.
CREATE POLICY "Users can insert their own certificates" 
ON public.certificates 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);

-- ==========================================
-- 4. MODIFY INTERVIEW ANSWERS
-- ==========================================
-- Safely add columns if they don't exist
ALTER TABLE public.interview_responses
    ADD COLUMN IF NOT EXISTS words_per_minute INTEGER,
    ADD COLUMN IF NOT EXISTS filler_word_count INTEGER,
    ADD COLUMN IF NOT EXISTS confidence_level TEXT,
    ADD COLUMN IF NOT EXISTS answer_structure TEXT,
    ADD COLUMN IF NOT EXISTS completeness_score INTEGER,
    ADD COLUMN IF NOT EXISTS behavioral_tags JSONB;

-- Note: The instructions mentioned "interview_answers", but the ai_mvp_schema uses "interview_responses".
-- We will also try to add to interview_answers if it exists for backwards compatibility.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interview_answers') THEN
        ALTER TABLE public.interview_answers
            ADD COLUMN IF NOT EXISTS words_per_minute INTEGER,
            ADD COLUMN IF NOT EXISTS filler_word_count INTEGER,
            ADD COLUMN IF NOT EXISTS confidence_level TEXT,
            ADD COLUMN IF NOT EXISTS answer_structure TEXT,
            ADD COLUMN IF NOT EXISTS completeness_score INTEGER,
            ADD COLUMN IF NOT EXISTS behavioral_tags JSONB;
    END IF;
END $$;

-- ==========================================
-- 5. MODIFY FEEDBACK REPORTS
-- ==========================================
-- The instructions mentioned "feedback_reports", but ai_mvp_schema uses "final_reports".
-- We will add it to final_reports, and also feedback_reports if it exists.
ALTER TABLE public.final_reports
    ADD COLUMN IF NOT EXISTS interview_personality_profile JSONB;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_reports') THEN
        ALTER TABLE public.feedback_reports
            ADD COLUMN IF NOT EXISTS interview_personality_profile JSONB;
    END IF;
END $$;

-- ==========================================
-- 6. MATCH KNOWLEDGE BASE (RPC for Similarity Search)
-- ==========================================
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  topic text,
  subject text,
  branch text,
  content text,
  source text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.topic,
    kb.subject,
    kb.branch,
    kb.content,
    kb.source,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
