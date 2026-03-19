-- SQL Schema for new Confera features

-- Enable Row Level Security (RLS)
-- Make sure to run this script in your Supabase SQL Editor

-- 1. Create resume_analysis table
CREATE TABLE IF NOT EXISTS public.resume_analysis (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resume_url text,
    ats_score integer NOT NULL DEFAULT 0,
    analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for resume_analysis
ALTER TABLE public.resume_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resume analysis" 
ON public.resume_analysis FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resume analysis" 
ON public.resume_analysis FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resume analysis" 
ON public.resume_analysis FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resume analysis" 
ON public.resume_analysis FOR DELETE 
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_resume_analysis_user_id ON public.resume_analysis(user_id);


-- 2. Create interview_sessions table
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    job_role text NOT NULL,
    transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
    score integer,
    feedback jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for interview_sessions
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interview sessions" 
ON public.interview_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interview sessions" 
ON public.interview_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interview sessions" 
ON public.interview_sessions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interview sessions" 
ON public.interview_sessions FOR DELETE 
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);

-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS interviews_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS resume_analyses_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_subscription_id TEXT,
  plan TEXT NOT NULL,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'active', 'cancelled', 'expired')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);


-- 3. Create learning_paths table
CREATE TABLE IF NOT EXISTS public.learning_paths (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    resources JSONB DEFAULT '[]'::JSONB, -- Array of {title, url}
    is_completed BOOLEAN DEFAULT false,
    source_type TEXT NOT NULL CHECK (source_type IN ('resume_analysis', 'mock_interview')),
    source_id UUID NOT NULL, -- UUID of the resume_analysis or interview_session
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for learning_paths
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning paths" 
ON public.learning_paths FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning paths" 
ON public.learning_paths FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning paths" 
ON public.learning_paths FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning paths" 
ON public.learning_paths FOR DELETE 
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON public.learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_source_id ON public.learning_paths(source_id);
