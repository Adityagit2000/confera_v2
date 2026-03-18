-- Create missing enums
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.interview_type AS ENUM ('dsa', 'system_design', 'hr');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.session_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Update existing resumes table structure if needed
ALTER TABLE public.resumes 
ADD COLUMN IF NOT EXISTS keywords_missing JSONB;

-- Create interview_answers table
CREATE TABLE IF NOT EXISTS public.interview_answers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer_text TEXT,
    answer_transcript TEXT,
    raw_audio_url TEXT,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create feedback_reports table
CREATE TABLE IF NOT EXISTS public.feedback_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    resume_score INTEGER CHECK (resume_score >= 0 AND resume_score <= 100),
    technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
    communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
    behavior_score INTEGER CHECK (behavior_score >= 0 AND behavior_score <= 100),
    summary TEXT,
    recommendations JSONB,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create event_logs table
CREATE TABLE IF NOT EXISTS public.event_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create security definer function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
    SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Create RLS policies for interview answers
-- Make idempotent: drop if they already exist
DROP POLICY IF EXISTS "Users can view answers for their sessions" ON public.interview_answers;
DROP POLICY IF EXISTS "Users can create answers for their sessions" ON public.interview_answers;
DROP POLICY IF EXISTS "Admins can view all answers" ON public.interview_answers;

CREATE POLICY "Users can view answers for their sessions" ON public.interview_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions 
            WHERE id = interview_answers.session_id AND user_id = auth.uid()
        )
    );
CREATE POLICY "Users can create answers for their sessions" ON public.interview_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interview_sessions 
            WHERE id = interview_answers.session_id AND user_id = auth.uid()
        )
    );
CREATE POLICY "Admins can view all answers" ON public.interview_answers
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Create RLS policies for feedback reports
-- Make idempotent: drop if they already exist
DROP POLICY IF EXISTS "Users can view reports for their sessions" ON public.feedback_reports;
DROP POLICY IF EXISTS "Users can create reports for their sessions" ON public.feedback_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.feedback_reports;

CREATE POLICY "Users can view reports for their sessions" ON public.feedback_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions 
            WHERE id = feedback_reports.session_id AND user_id = auth.uid()
        )
    );
CREATE POLICY "Users can create reports for their sessions" ON public.feedback_reports
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.interview_sessions 
            WHERE id = feedback_reports.session_id AND user_id = auth.uid()
        )
    );
CREATE POLICY "Admins can view all reports" ON public.feedback_reports
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Create RLS policies for event logs
-- Make idempotent: drop if they already exist
DROP POLICY IF EXISTS "Users can view their own events" ON public.event_logs;
DROP POLICY IF EXISTS "System can insert events" ON public.event_logs;
DROP POLICY IF EXISTS "Admins can view all events" ON public.event_logs;

CREATE POLICY "Users can view their own events" ON public.event_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert events" ON public.event_logs
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all events" ON public.event_logs
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
        'student'
    );
    
    -- Log user creation event
    INSERT INTO public.event_logs (user_id, name, payload)
    VALUES (NEW.id, 'user_created', jsonb_build_object('email', NEW.email));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interview_answers_session_id ON public.interview_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_session_id ON public.feedback_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON public.event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON public.event_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);