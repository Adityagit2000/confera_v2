-- Add file_url column to resumes table to store uploaded resume file reference (idempotent)
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add file_size column to track file size
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add file_type column to track MIME type
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add original_filename column to track original file name
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS original_filename TEXT;