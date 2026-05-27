-- Create test_sessions table
CREATE TABLE IF NOT EXISTS public.test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    branch TEXT,
    test_type TEXT NOT NULL,
    subjects_covered TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::JSONB,
    answers JSONB DEFAULT '{}'::JSONB,
    score INTEGER DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    certificate_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can insert their own test sessions"
ON public.test_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own test sessions"
ON public.test_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own test sessions"
ON public.test_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test sessions"
ON public.test_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Create Index
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON public.test_sessions(user_id);
