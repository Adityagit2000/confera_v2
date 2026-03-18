-- AI MVP Schema: Roles, ATS Analysis, Questions, Responses, Evaluations, Final Reports

-- =========================
-- ROLES
-- Represents target roles/job profiles for ATS and interviews
-- =========================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    keywords JSONB, -- optional curated keyword set for this role
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_roles_user_id ON public.roles(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_created_at ON public.roles(created_at);

-- Make role policies idempotent
DROP POLICY IF EXISTS "Users can manage their own roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.roles;

CREATE POLICY "Users can manage their own roles" ON public.roles
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.roles
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- =========================
-- ATS ANALYSIS
-- Stores structured ATS evaluations per resume/role
-- =========================
CREATE TABLE IF NOT EXISTS public.ats_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    missing_keywords TEXT[],
    strengths TEXT[],
    improvements TEXT[],
    raw_json JSONB, -- full LLM response for future reprocessing
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_analysis ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ats_analysis_user_id ON public.ats_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_ats_analysis_resume_id ON public.ats_analysis(resume_id);
CREATE INDEX IF NOT EXISTS idx_ats_analysis_role_id ON public.ats_analysis(role_id);
CREATE INDEX IF NOT EXISTS idx_ats_analysis_created_at ON public.ats_analysis(created_at);

-- Make ats_analysis policies idempotent
DROP POLICY IF EXISTS "Users can view their own ats_analysis" ON public.ats_analysis;
DROP POLICY IF EXISTS "Users can insert their own ats_analysis" ON public.ats_analysis;
DROP POLICY IF EXISTS "Admins can view all ats_analysis" ON public.ats_analysis;

CREATE POLICY "Users can view their own ats_analysis" ON public.ats_analysis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ats_analysis" ON public.ats_analysis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all ats_analysis" ON public.ats_analysis
    FOR SELECT USING (public.get_current_user_role() = 'admin');

-- =========================
-- INTERVIEW QUESTIONS
-- Stores explicitly generated questions per session
-- =========================
CREATE TABLE IF NOT EXISTS public.interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id ON public.interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_order ON public.interview_questions(session_id, order_index);

-- Make interview_questions policies idempotent
DROP POLICY IF EXISTS "Users can view questions for their sessions" ON public.interview_questions;
DROP POLICY IF EXISTS "System can insert questions" ON public.interview_questions;
DROP POLICY IF EXISTS "Admins can view all questions" ON public.interview_questions;

CREATE POLICY "Users can view questions for their sessions" ON public.interview_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = interview_questions.session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert questions" ON public.interview_questions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all questions" ON public.interview_questions
    FOR SELECT USING (public.get_current_user_role() = 'admin');

-- =========================
-- INTERVIEW RESPONSES
-- More explicit normalized responses table; interview_answers remains for backward compat
-- =========================
CREATE TABLE IF NOT EXISTS public.interview_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.interview_questions(id) ON DELETE SET NULL,
    answer_text TEXT,
    answer_transcript TEXT,
    raw_audio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_interview_responses_session_id ON public.interview_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_responses_question_id ON public.interview_responses(question_id);

-- Make interview_responses policies idempotent
DROP POLICY IF EXISTS "Users can view responses for their sessions" ON public.interview_responses;
DROP POLICY IF EXISTS "System can insert responses" ON public.interview_responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.interview_responses;

CREATE POLICY "Users can view responses for their sessions" ON public.interview_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = interview_responses.session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert responses" ON public.interview_responses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all responses" ON public.interview_responses
    FOR SELECT USING (public.get_current_user_role() = 'admin');

-- =========================
-- RESPONSE EVALUATIONS
-- Per-answer evaluations from LLM
-- =========================
CREATE TABLE IF NOT EXISTS public.response_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    response_id UUID NOT NULL REFERENCES public.interview_responses(id) ON DELETE CASCADE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
    communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
    strengths TEXT[],
    weaknesses TEXT[],
    improvement_notes TEXT[],
    raw_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.response_evaluations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_response_evaluations_session_id ON public.response_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_response_evaluations_response_id ON public.response_evaluations(response_id);
CREATE INDEX IF NOT EXISTS idx_response_evaluations_created_at ON public.response_evaluations(created_at);

-- Make response_evaluations policies idempotent
DROP POLICY IF EXISTS "Users can view evaluations for their sessions" ON public.response_evaluations;
DROP POLICY IF EXISTS "System can insert evaluations" ON public.response_evaluations;
DROP POLICY IF EXISTS "Admins can view all evaluations" ON public.response_evaluations;

CREATE POLICY "Users can view evaluations for their sessions" ON public.response_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = response_evaluations.session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert evaluations" ON public.response_evaluations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all evaluations" ON public.response_evaluations
    FOR SELECT USING (public.get_current_user_role() = 'admin');

-- =========================
-- FINAL REPORTS
-- High-level evaluation report per interview session
-- =========================
CREATE TABLE IF NOT EXISTS public.final_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
    communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
    strengths TEXT[],
    weaknesses TEXT[],
    improvement_plan TEXT[],
    raw_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.final_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_final_reports_session_id ON public.final_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_final_reports_created_at ON public.final_reports(created_at);

-- Make final_reports policies idempotent
DROP POLICY IF EXISTS "Users can view final reports for their sessions" ON public.final_reports;
DROP POLICY IF EXISTS "System can insert final reports" ON public.final_reports;
DROP POLICY IF EXISTS "Admins can view all final reports" ON public.final_reports;

CREATE POLICY "Users can view final reports for their sessions" ON public.final_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interview_sessions s
            WHERE s.id = final_reports.session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert final reports" ON public.final_reports
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all final reports" ON public.final_reports
    FOR SELECT USING (public.get_current_user_role() = 'admin');

