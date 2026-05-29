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
import { useToast } from '@/hooks/use-toast';

type AuthStep = 'signin' | 'verify-otp';

const Auth = () => {
  const [step, setStep] = useState<AuthStep>('signin');
  const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const { sendOtp, verifyOtp, resendOtp, signIn, user } = useAuth();
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await sendOtp(email);
    
    if (!error) {
      setStep('verify-otp');
      setResendTimer(60);
      toast({ 
        title: "Code sent!", 
        description: `Check ${email} for your 6-digit code` 
      });
    }
    setLoading(false);
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (!error) {
      navigate('/');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (otpOverride?: string) => {
    setLoading(true);
    const otp = otpOverride || otpValues.join('');
    
    const { error } = await verifyOtp(email, otp);
    
    if (!error) {
      navigate('/');
    }
    // If there is an error, useAuth already shows a toast
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

        <Card className="border-border/40 shadow-2xl bg-[#111111]/80 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <CardHeader className="space-y-2 pb-8">
            <CardTitle className="text-3xl font-bold text-center tracking-tight text-white">
              {step === 'signin' ? 'Welcome' : 'Check your email'}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground text-base">
              {step === 'signin' 
                ? 'Sign in or create an account to continue' 
                : `We've sent a 6-digit verification code to ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step !== 'verify-otp' && (
              <div className="space-y-3 mb-6">
                <Button 
                  className="w-full bg-white hover:bg-[#f5f5f5] border border-[#e0e0e0] hover:border-[#d0d0d0] text-[#1f1f1f] hover:text-[#1f1f1f] transition-all duration-300 h-12 text-sm font-semibold flex items-center justify-center relative overflow-hidden group shadow-sm hover:shadow-md"
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo: `${window.location.origin}/` }
                      });
                      if (error) throw error;
                    } catch (err: any) {
                      toast({ title: "OAuth Error", description: err.message || "Failed to connect to Google. Please try again.", variant: "destructive" });
                    }
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

            {step === 'signin' && loginMethod === 'otp' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
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
                <Button 
                  type="submit" 
                  className="w-full py-6 text-base" 
                  disabled={loading || !email}
                  variant="hero"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send OTP
                </Button>
                <div className="text-center mt-4 space-y-2">
                  <button 
                    type="button" 
                    onClick={() => setLoginMethod('password')} 
                    className="text-sm text-primary hover:underline"
                  >
                    Use password instead
                  </button>
                  <p className="text-xs text-muted-foreground">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                  </p>
                </div>
              </form>
            )}

            {step === 'signin' && loginMethod === 'password' && (
              <form onSubmit={handlePasswordSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password-email">Email address</Label>
                  <Input
                    id="password-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-input">Password</Label>
                  <Input
                    id="password-input"
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
                  disabled={loading || !email || !password}
                  variant="hero"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
                <div className="text-center mt-4 space-y-2">
                  <button 
                    type="button" 
                    onClick={() => setLoginMethod('otp')} 
                    className="text-sm text-primary hover:underline"
                  >
                    Use OTP instead
                  </button>
                  <p className="text-xs text-muted-foreground">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
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
                    onClick={() => setStep('signin')}
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