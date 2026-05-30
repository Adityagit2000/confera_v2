-- Add missing columns to certificates to support both test_sessions and universal assessments
ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS job_role TEXT,
ADD COLUMN IF NOT EXISTS certificate_hash TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
