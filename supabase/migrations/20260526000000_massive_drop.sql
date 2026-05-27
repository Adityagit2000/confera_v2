-- 1. Coupons Table
CREATE TABLE public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percentage INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert our default 60% off coupon
INSERT INTO public.coupons (code, discount_percentage) VALUES ('PLACED60', 60), ('LAUNCH60', 60), ('HIREME60', 60);

-- 2. Universal Assessments Table
CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_role TEXT NOT NULL, -- e.g., 'Frontend Developer', 'Mechanical Engineer', 'Data Scientist'
    total_questions INT NOT NULL DEFAULT 20,
    duration_minutes INT NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'active',
    score_percentage FLOAT,
    passed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 3. Assessment Questions Table
CREATE TABLE public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'Aptitude', 'Technical'
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- ["A", "B", "C", "D"]
    correct_option INT NOT NULL, 
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Submissions & Certificates
CREATE TABLE public.assessment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    selected_option INT,
    is_correct BOOLEAN
);

CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
    job_role TEXT NOT NULL,
    certificate_hash TEXT UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Allow users to read active coupons
CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT USING (is_active = true);

-- Apply standard user-matching RLS to other tables (auth.uid() = user_id)
CREATE POLICY "Users can manage their own assessments" ON public.assessments FOR ALL USING (auth.uid() = user_id);
-- Note: assessment_questions don't have user_id, so we link them via assessments for RLS
CREATE POLICY "Users can read questions of their assessments" ON public.assessment_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.assessments a 
    WHERE a.id = assessment_questions.assessment_id AND a.user_id = auth.uid()
  )
);
CREATE POLICY "Users can manage their submissions" ON public.assessment_submissions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can read their certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);
