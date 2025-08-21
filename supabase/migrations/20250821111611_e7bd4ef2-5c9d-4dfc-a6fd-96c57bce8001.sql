-- Create enums
CREATE TYPE public.user_role AS ENUM ('student', 'admin');
CREATE TYPE public.interview_type AS ENUM ('dsa', 'system_design', 'hr');
CREATE TYPE public.session_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create resumes table
CREATE TABLE public.resumes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_url TEXT,
    parsed_data JSONB,
    ats_score INTEGER,
    keywords_missing JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create interview_sessions table
CREATE TABLE public.interview_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type interview_type NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status session_status NOT NULL DEFAULT 'scheduled',
    vapi_call_id TEXT,
    duration_sec INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create interview_answers table
CREATE TABLE public.interview_answers (
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
CREATE TABLE public.feedback_reports (
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
CREATE TABLE public.event_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for resumes
CREATE POLICY "Users can view their own resumes" ON public.resumes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own resumes" ON public.resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own resumes" ON public.resumes
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all resumes" ON public.resumes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for interview sessions
CREATE POLICY "Users can view their own sessions" ON public.interview_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sessions" ON public.interview_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.interview_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all sessions" ON public.interview_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for interview answers
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
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for feedback reports
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
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for event logs
CREATE POLICY "Users can view their own events" ON public.event_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert events" ON public.event_logs
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all events" ON public.event_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id, 
        NEW.email,
        NEW.raw_user_meta_data->>'name',
        'student'
    );
    
    -- Log user creation event
    INSERT INTO public.event_logs (user_id, name, payload)
    VALUES (NEW.id, 'user_created', jsonb_build_object('email', NEW.email));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
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
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX idx_resumes_created_at ON public.resumes(created_at);
CREATE INDEX idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_created_at ON public.interview_sessions(created_at);
CREATE INDEX idx_interview_sessions_status ON public.interview_sessions(status);
CREATE INDEX idx_interview_answers_session_id ON public.interview_answers(session_id);
CREATE INDEX idx_feedback_reports_session_id ON public.feedback_reports(session_id);
CREATE INDEX idx_event_logs_user_id ON public.event_logs(user_id);
CREATE INDEX idx_event_logs_created_at ON public.event_logs(created_at);