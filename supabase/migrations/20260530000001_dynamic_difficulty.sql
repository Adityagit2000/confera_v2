-- Migration to add difficulty_level to interview_sessions

ALTER TABLE public.interview_sessions
ADD COLUMN difficulty_level text DEFAULT 'medium';

-- Add a comment for documentation
COMMENT ON COLUMN public.interview_sessions.difficulty_level IS 'Tracks the current adaptive difficulty level of the AI (easy, medium, hard)';
