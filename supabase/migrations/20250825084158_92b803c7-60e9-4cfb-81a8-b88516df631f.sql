-- Add transcript and summary fields to interview_sessions table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'interview_sessions'
      AND column_name  = 'transcript'
  ) THEN
    ALTER TABLE public.interview_sessions 
      ADD COLUMN transcript TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'interview_sessions'
      AND column_name  = 'summary'
  ) THEN
    ALTER TABLE public.interview_sessions 
      ADD COLUMN summary TEXT;
  END IF;
END;
$$;

-- Create index for faster transcript searches
CREATE INDEX IF NOT EXISTS idx_interview_sessions_transcript 
  ON public.interview_sessions USING gin(to_tsvector('english', transcript));

-- Update the webhook function to be public (no auth required)
-- This allows VAPI to call our webhook without authentication