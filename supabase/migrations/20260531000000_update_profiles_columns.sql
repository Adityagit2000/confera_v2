-- Migration: Add subscription and referral columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS interviews_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS resume_analyses_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_code TEXT;
