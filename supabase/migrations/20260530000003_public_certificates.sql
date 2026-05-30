-- Allow public access to certificates so they can be verified by anyone
DROP POLICY IF EXISTS "Public can view certificates" ON public.certificates;
CREATE POLICY "Public can view certificates" 
ON public.certificates 
FOR SELECT 
TO public 
USING (true);

-- Allow public access to assessments linked to a certificate
DROP POLICY IF EXISTS "Public can view assessments linked to certificates" ON public.assessments;
CREATE POLICY "Public can view assessments linked to certificates" 
ON public.assessments 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 FROM public.certificates WHERE assessment_id = assessments.id
  )
);

-- Allow public access to profiles linked to a certificate (to fetch the name)
DROP POLICY IF EXISTS "Public can view profiles linked to certificates" ON public.profiles;
CREATE POLICY "Public can view profiles linked to certificates" 
ON public.profiles 
FOR SELECT 
TO public 
USING (
  EXISTS (
    SELECT 1 FROM public.certificates WHERE user_id = profiles.id
  )
);
