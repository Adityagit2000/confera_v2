import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ data: any, error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: any }>;
  resendOtp: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Generate a random 8-character uppercase alphanumeric referral code */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * After a user signs in, ensure they have a referral code.
 * If they don't have one, generate and save it.
 * Also process any pending referral link from localStorage.
 */
async function ensureReferralCodeAndLink(userId: string) {
  try {
    // Check if user already has a referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (!profile?.referral_code) {
      // Generate and set referral code (retry up to 3 times for uniqueness collisions)
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateReferralCode();
        const { error } = await supabase
          .from('profiles')
          .update({ referral_code: code })
          .eq('id', userId);

        if (!error) {
          console.log(`[Referral] Generated referral code: ${code}`);
          break;
        }
        // If error is unique constraint violation, retry with a new code
        if (error.code === '23505') continue;
        console.error('[Referral] Error setting referral code:', error);
        break;
      }
    }

    // Check if there's a referral code in localStorage from a referral link
    const storedRefCode = localStorage.getItem('confera_referral_code');
    if (storedRefCode) {
      // Look up the referrer by their referral code
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', storedRefCode)
        .single();

      if (referrer && referrer.id !== userId) {
        // Check if this referral link hasn't already been processed
        const { data: existingReferral } = await supabase
          .from('referrals')
          .select('id')
          .eq('referred_id', userId)
          .limit(1);

        if (!existingReferral || existingReferral.length === 0) {
          // Insert the referral record
          const { error: refError } = await supabase
            .from('referrals')
            .insert({
              referrer_id: referrer.id,
              referred_id: userId,
              status: 'pending',
            });

          if (!refError) {
            console.log(`[Referral] Linked user ${userId} to referrer ${referrer.id}`);
          } else {
            console.error('[Referral] Error creating referral link:', refError);
          }
        }
      }
      // Always clear after processing (even if referrer not found)
      localStorage.removeItem('confera_referral_code');
    }
  } catch (error) {
    console.error('[Referral] Error in ensureReferralCodeAndLink:', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Clean URL hash if it contains OAuth tokens
        if ((event === 'SIGNED_IN' || session) && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        
        if (session?.user) {
          // Check user role
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
              
              setIsAdmin(profile?.role === 'admin');
            } catch (error) {
              console.error('Error fetching user profile:', error);
            }
          }, 0);

          // Ensure referral code exists and process any referral link
          if (event === 'SIGNED_IN') {
            setTimeout(() => {
              ensureReferralCodeAndLink(session.user.id);
            }, 500);
          }
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '',
        },
        emailRedirectTo: `${window.location.origin}/auth`,
      }
    });

    return { data, error };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (error) {
      toast({
        title: "Verification Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account Verified",
        description: "Your account has been successfully verified Welcome to Confera!",
      });
    }

    return { error };
  };

  const resendOtp = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      toast({
        title: "Resend Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "OTP Resent",
        description: "A new verification code has been sent to your email.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign In Error",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signOut = async () => {
    window.speechSynthesis.cancel()
    
    // Mark any active sessions as completed before signing out
    if (user?.id) {
      await supabase
        .from('interview_sessions')
        .update({ status: 'completed' })
        .eq('user_id', user.id)
        .eq('status', 'active');
    }

    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      verifyOtp,
      resendOtp,
      signOut,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};