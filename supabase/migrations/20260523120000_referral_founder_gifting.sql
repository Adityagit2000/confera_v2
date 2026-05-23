-- ============================================================================
-- Migration: Referral System + Founder Access + Admin Gifting
-- Created: 2026-05-23
-- ============================================================================

-- ── Part 2: Referral System ─────────────────────────────────────────────────

-- Add referral_code to profiles (unique, auto-generated per user)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create index for fast referral code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  converted_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can see referrals where they are the referrer
CREATE POLICY "Users can view referrals they made"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);

-- Referral earnings table
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referral_id UUID REFERENCES public.referrals(id) NOT NULL,
  amount_paise INTEGER NOT NULL,
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_out BOOLEAN DEFAULT false
);

ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

-- Users can see their own earnings
CREATE POLICY "Users can view own earnings"
  ON public.referral_earnings FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_user ON public.referral_earnings(user_id);


-- ── Part 3: Founder Free Access ─────────────────────────────────────────────

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT false;

-- NOTE: After running this migration, execute separately in SQL Editor:
-- UPDATE public.profiles SET is_founder = true
-- WHERE id IN (
--   SELECT id FROM auth.users
--   WHERE email IN ('aditya06.jha@gmail.com', '06aditya.jha@gmail.com')
-- );


-- ── Part 4: Admin Gifting System ────────────────────────────────────────────

-- Admin actions log
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Gift pro access function — callable from SQL editor
-- Usage: SELECT gift_pro_access('friend@email.com', 30);
CREATE OR REPLACE FUNCTION public.gift_pro_access(user_email TEXT, duration_days INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  target_name TEXT;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN 'ERROR: No user found with email ' || user_email;
  END IF;

  -- Get user name for logging
  SELECT name INTO target_name FROM public.profiles WHERE id = target_user_id;

  -- Update profile to pro with expiry
  UPDATE public.profiles
  SET plan = 'pro',
      plan_expires_at = now() + (duration_days || ' days')::INTERVAL
  WHERE id = target_user_id;

  -- Log the admin action
  INSERT INTO public.admin_actions (action_type, target_user_id, performed_by, notes)
  VALUES (
    'gift_pro_access',
    target_user_id,
    'admin_sql',
    'Gifted ' || duration_days || ' days of Pro access to ' || COALESCE(target_name, user_email)
  );

  RETURN 'SUCCESS: Gifted ' || duration_days || ' days Pro to ' || COALESCE(target_name, user_email) || ' (ID: ' || target_user_id || ')';
END;
$$;
