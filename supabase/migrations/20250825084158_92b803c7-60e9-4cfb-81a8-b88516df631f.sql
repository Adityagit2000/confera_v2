-- Add transcript and summary fields to interview_sessions table
ALTER TABLE public.interview_sessions 
ADD COLUMN transcript TEXT,
ADD COLUMN summary TEXT;

-- Create index for faster transcript searches
CREATE INDEX idx_interview_sessions_transcript ON public.interview_sessions USING gin(to_tsvector('english', transcript));

-- Update the webhook function to be public (no auth required)
-- This allows VAPI to call our webhook without authentication