-- Add job_role column to interview_sessions table
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS job_role TEXT;

-- Update RLS policies if necessary (though existing ones should cover new column)
-- No changes needed to policies as they allow access to all columns for the owner.
