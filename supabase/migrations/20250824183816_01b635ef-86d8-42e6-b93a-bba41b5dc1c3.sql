-- Fix foreign key constraint for interview_sessions
-- Drop the existing foreign key constraint that references users table
ALTER TABLE public.interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_user_id_fkey;

-- Add new foreign key constraint that references profiles table instead
ALTER TABLE public.interview_sessions 
ADD CONSTRAINT interview_sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;