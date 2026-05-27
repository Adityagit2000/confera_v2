-- Create interview certificates table
CREATE TABLE IF NOT EXISTS public.interview_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    average_score FLOAT NOT NULL,
    interview_count INT NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interview_certificates ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view certificates for verification purposes
CREATE POLICY "Anyone can view certificates" 
ON public.interview_certificates 
FOR SELECT 
USING (true);

-- Only edge functions / authenticated users can insert their own certificate
CREATE POLICY "Users can insert their own certificates" 
ON public.interview_certificates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own certificates" 
ON public.interview_certificates 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
