-- Add missing columns to interview_sessions table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'interview_sessions'
      AND column_name  = 'status'
  ) THEN
    ALTER TABLE public.interview_sessions 
      ADD COLUMN status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'interview_sessions'
      AND column_name  = 'vapi_call_id'
  ) THEN
    ALTER TABLE public.interview_sessions 
      ADD COLUMN vapi_call_id TEXT;
  END IF;
END;
$$;

-- Create index on status for better performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON public.interview_sessions(status);

-- Create index on vapi_call_id for lookups
CREATE INDEX IF NOT EXISTS idx_interview_sessions_vapi_call_id ON public.interview_sessions(vapi_call_id);