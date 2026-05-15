CREATE TABLE IF NOT EXISTS public.user_skill_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    communication FLOAT DEFAULT 0.0,
    technical_depth FLOAT DEFAULT 0.0,
    problem_solving FLOAT DEFAULT 0.0,
    domain_knowledge FLOAT DEFAULT 0.0,
    weak_areas TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.user_skill_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skill memory"
    ON public.user_skill_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own skill memory"
    ON public.user_skill_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skill memory"
    ON public.user_skill_memory FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Optional trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_skill_memory_updated_at ON public.user_skill_memory;
CREATE TRIGGER update_user_skill_memory_updated_at
    BEFORE UPDATE ON public.user_skill_memory
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
