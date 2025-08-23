-- Add missing columns to interview_sessions table
ALTER TABLE public.interview_sessions 
ADD COLUMN status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
ADD COLUMN vapi_call_id TEXT;

-- Create index on status for better performance
CREATE INDEX idx_interview_sessions_status ON public.interview_sessions(status);

-- Create index on vapi_call_id for lookups
CREATE INDEX idx_interview_sessions_vapi_call_id ON public.interview_sessions(vapi_call_id);