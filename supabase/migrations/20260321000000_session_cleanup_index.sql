-- Fast index for stale session queries
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status_created 
ON public.interview_sessions(status, created_at)
WHERE status = 'active';
