-- Enable RLS on existing tables that don't have it
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for existing tables
-- Resumes policies  
CREATE POLICY "Users can view their own resumes" ON public.resumes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own resumes" ON public.resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own resumes" ON public.resumes
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all resumes" ON public.resumes
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Interview sessions policies
CREATE POLICY "Users can view their own sessions" ON public.interview_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sessions" ON public.interview_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.interview_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all sessions" ON public.interview_sessions
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Users table policies (if it should be accessible)
CREATE POLICY "Users can view their own user record" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own user record" ON public.users
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Fix function search paths for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
    SELECT role::TEXT FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;