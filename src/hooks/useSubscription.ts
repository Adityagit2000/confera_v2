import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useSubscription() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, plan, plan_expires_at, interviews_used_this_month, resume_analyses_used_this_month')
        .eq('id', user!.id)
        .single();
      
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching subscription profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const isPro = profile?.plan === 'pro' && 
    (profile?.plan_expires_at ? new Date(profile.plan_expires_at) > new Date() : false);

  const canStartInterview = isPro || (profile?.interviews_used_this_month || 0) < 2;
  const canAnalyzeResume = isPro || (profile?.resume_analyses_used_this_month || 0) < 2;

  return { 
    isPro, 
    canStartInterview, 
    canAnalyzeResume, 
    profile, 
    loading, 
    refetch: fetchProfile 
  };
}
