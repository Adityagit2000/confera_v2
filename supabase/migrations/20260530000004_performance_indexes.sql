-- Performance indexes for Confera

-- 1. Index for Dashboard and generate-prep-plan (latest sessions per user)
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id_created_at 
ON public.interview_sessions (user_id, created_at DESC);

-- 2. Index for Dashboard and generate-prep-plan (latest resumes per user)
CREATE INDEX IF NOT EXISTS idx_resumes_user_id_created_at 
ON public.resumes (user_id, created_at DESC);

-- 3. Index for user_skill_memory by user_id
CREATE INDEX IF NOT EXISTS idx_user_skill_memory_user_id 
ON public.user_skill_memory (user_id);

-- 4. Index for interview_answers (frequently queried by session_id and score)
CREATE INDEX IF NOT EXISTS idx_interview_answers_session_id_score 
ON public.interview_answers (session_id, score);

-- 5. Index for transcript_embeddings by user_id and created_at
CREATE INDEX IF NOT EXISTS idx_transcript_embeddings_user_id_created_at 
ON public.transcript_embeddings (user_id, created_at DESC);
