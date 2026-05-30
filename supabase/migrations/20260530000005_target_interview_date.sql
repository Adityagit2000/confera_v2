-- Migration: Add target_interview_date to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_interview_date timestamp with time zone;
