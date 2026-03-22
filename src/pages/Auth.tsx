import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

type AuthStep = 'signup' | 'verify-otp' | 'signin';

const Auth = () => {
  const [step, setStep] = useState<AuthStep>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [consentChecked, setConsentChecked] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const { signUp, signIn, verifyOtp, resendOtp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signUp(email, password, name);
    
    if (!error) {
      setStep('verify-otp');
      setResendTimer(60);
      toast({ 
        title: "Code sent!", 
        description: `Check ${email} for your 6-digit code` 
      });
    } else {
      // If user already exists, we should try to resend the OTP automatically
      if (error.message?.includes("User already registered") || error.status === 400) {
        setStep('verify-otp');
        setResendTimer(60);
        await resendOtp(email);
        toast({ 
          title: "Verification code sent", 
          description: "An account already exists. We've sent a new verification code to your email.",
        });
      } else {
        toast({ 
          title: "Error", 
          description: error.message, 
          variant: "destructive" 
        });
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (otpOverride?: string) => {
    setLoading(true);
    const otp = otpOverride || otpValues.join('');
    
    const { error } = await verifyOtp(email, otp);
    
    if (!error) {
      toast({ title: "Account created!", description: "Welcome to Confera!" });
      navigate('/');
    } else {
      toast({ 
        title: "Invalid code", 
        description: "Please check the code and try again", 
        variant: "destructive" 
      });
    }
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otpValues];
    newOtp[index] = value.slice(-1);
    setOtpValues(newOtp);
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (newOtp.every(v => v !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    
    setLoading(true);
    const { error } = await resendOtp(email);
    if (!error) {
      setResendTimer(60);
      toast({ title: "Code resent!", description: "Check your email for a new code" });
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (!error) {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070708] px-4 py-8 sm:p-6 relative overflow-hidden">
      <BackButton />
      {/* Background radial glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center space-x-3 mb-6 group transition-all duration-300">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform duration-500">
              <span className="text-primary-foreground font-bold text-2xl">C</span>
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">Confera</span>
          </Link>
          <p className="text-muted-foreground text-lg">Master your future with AI-powered preparation</p>
        </div>
-
        <Card className="border-border/40 shadow-2xl bg-[#111111]/80 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <CardHeader className="space-y-2 pb-8">
            <CardTitle className="text-3xl font-bold text-center tracking-tight text-white">
              {step === 'signin' ? 'Welcome back' : step === 'signup' ? 'Create an account' : 'Check your email'}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground text-base">
              {step === 'signin' 
                ? 'Enter your credentials to access your session' 
                : step === 'signup' 
                  ? 'Join thousands of candidates preparing for top-tier roles'
                  : `We've sent a 6-digit verification code to ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step !== 'verify-otp' && (
              <div className="space-y-3 mb-6">
                <Button 
                  className="w-full bg-white hover:bg-[#f5f5f5] border border-[#e0e0e0] hover:border-[#d0d0d0] text-[#1f1f1f] hover:text-[#1f1f1f] transition-all duration-300 h-12 text-sm font-semibold flex items-center justify-center relative overflow-hidden group shadow-sm hover:shadow-md"
                  onClick={() => {
                    supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: `${window.location.origin}/` }
                    });
                  }}
                >
                  <div className="absolute left-6 flex items-center justify-center">
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </div>
                  <span className="w-full text-center">Continue with Google</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-[#24292e] hover:bg-black border-[#444] text-white transition-all duration-300 h-12 text-sm font-semibold flex items-center justify-center relative overflow-hidden group shadow-sm hover:shadow-md"
                  onClick={() => {
                    supabase.auth.signInWithOAuth({
                      provider: 'github',
                      options: { redirectTo: `${window.location.origin}/` }
                    });
                  }}
                >
                  <div className="absolute left-6 flex items-center justify-center">
                    <svg className="w-5 h-5 flex-shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                  </div>
                  <span className="w-full text-center">Continue with GitHub</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-[#0A66C2] hover:bg-[#084e96] border-transparent text-white transition-all duration-300 h-12 text-sm font-semibold flex items-center justify-center relative overflow-hidden group shadow-sm hover:shadow-md"
                  onClick={() => {
                    supabase.auth.signInWithOAuth({
                      provider: 'linkedin_oidc',
                      options: { redirectTo: `${window.location.origin}/` }
                    });
                  }}
                >
                  <div className="absolute left-6 flex items-center justify-center">
                    <svg className="w-5 h-5 flex-shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
                    </svg>
                  </div>
                  <span className="w-full text-center">Continue with LinkedIn</span>
                </Button>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#111111] px-2 text-muted-foreground font-medium">or continue with email</span>
                  </div>
                </div>
              </div>
            )}
            {step === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email address</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full py-6 text-base" 
                  disabled={loading}
                  variant="hero"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => setStep('signup')}
                      className="text-primary hover:text-primary/80 transition-colors font-medium underline-offset-4 hover:underline"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </form>
            )}

            {step === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex items-center space-x-2 sm:space-x-6 py-2">
                  <Checkbox 
                    id="terms" 
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I agree to the{" "}
                      <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                      {" "}and{" "}
                      <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      I consent to AI data processing of my resume and localization of my data.
                    </p>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !consentChecked}
                  variant="hero"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign Up
                </Button>
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Already have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => setStep('signin')}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            )}

            {step === 'verify-otp' && (
              <div className="space-y-6">
                <div className="flex justify-center gap-2 sm:gap-3">
                  {otpValues.map((value, index) => (
                    <Input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={value}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-10 h-10 sm:w-12 sm:h-12 text-center text-xl sm:text-2xl font-bold bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  ))}
                </div>
                
                <Button 
                  onClick={() => handleVerifyOtp()}
                  className="w-full py-6 text-base" 
                  disabled={loading || otpValues.some(v => v === '')}
                  variant="hero"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify and continue
                </Button>
                
                <div className="flex flex-col space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResendOtp}
                    disabled={loading || resendTimer > 0}
                    className="w-full border-border/50 hover:bg-muted/50 h-11"
                  >
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend verification code'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep('signup')}
                    disabled={loading}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    Use a different email
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;