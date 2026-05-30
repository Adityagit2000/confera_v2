import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Calendar,
  Upload,
  BarChart3,
  LogOut,
  Home,
  Settings,
  FolderClock,
  Mic,
  PlusCircle,
  Cpu,
  Network,
  Users,
  Play,
  Zap,
  Menu,
  X,
  BookOpen,
  Sparkles,
  RefreshCw,
  Clock,
  GraduationCap,
  Award,
  Flame
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ResumeUpload from '@/components/ResumeUpload';
import { InterviewSelectionModal } from '@/components/InterviewSelectionModal';
import { motion } from 'framer-motion';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/UpgradeModal';
import { ReferralSection } from '@/components/dashboard/ReferralSection';
import { CreditCard, Gift } from 'lucide-react';

interface DashboardStats {
  totalSessions: number;
  avgScore: number;
  resumeScore: number | null;
  recentSessions: any[];
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    avgScore: 0,
    resumeScore: null,
    recentSessions: []
  });
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [interviewType, setInterviewType] = useState<string>('');
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const { toast } = useToast();
  const { isPro, isFounder, canStartInterview, canAnalyzeResume, profile, refetch: refetchSubscription } = useSubscription();
  const [prepPlan, setPrepPlan] = useState<any>(null);
  const [prepPlanLoading, setPrepPlanLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || hasFetched) return;
    let cancelled = false;
    setHasFetched(true);

    fetchDashboardData();
    fetchPrepPlan();

    // Silently clean up any stale active sessions on the backend
    supabase.functions.invoke('cleanup-stale-sessions').catch(() => {});

    // Show welcome toast once per session
    const hasWelcomed = sessionStorage.getItem('confera_welcomed');
    if (!hasWelcomed) {
      setTimeout(() => {
        if (cancelled) return;
        toast({
          title: `Welcome back, ${profile?.name || user?.email?.split('@')[0]}!`,
          description: "Ready to crush your next interview session?",
          className: "bg-background/80 backdrop-blur-xl border-primary/20",
        });
        sessionStorage.setItem('confera_welcomed', 'true');
      }, 1000);
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = profile?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

    if (hour >= 5 && hour < 12) {
      const morningLines = [
        `Rise and grind`,
        `Morning energy`,
        `Early start`,
        `Good morning`,
      ];
      return morningLines[Math.floor(Math.random() * morningLines.length)];
    }
    if (hour >= 12 && hour < 17) {
      const afternoonLines = [
        `Good afternoon`,
        `Keep the momentum`,
        `Afternoon grind`,
        `Still going strong`,
      ];
      return afternoonLines[Math.floor(Math.random() * afternoonLines.length)];
    }
    if (hour >= 17 && hour < 21) {
      const eveningLines = [
        `Good evening`,
        `Evening session`,
        `Winding down or just starting`,
        `Evening grind`,
      ];
      return eveningLines[Math.floor(Math.random() * eveningLines.length)];
    }
    // Late night: 9pm to 5am
    const lateNightLines = [
      `Burning the midnight oil`,
      `Late night grind`,
      `Still at it`,
      `The night owls win`,
    ];
    return lateNightLines[Math.floor(Math.random() * lateNightLines.length)];
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      const [sessionsResult, resumesResult] = await Promise.all([
        supabase
          .from('interview_sessions')
          .select('*, feedback_reports(overall_score)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('resumes')
          .select('ats_score, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
      ])

      const { data: sessions, error: sessionsError } = sessionsResult
      const { data: resumes, error: resumesError } = resumesResult

      const totalSessions = sessions?.length || 0;
      const scoresWithData = sessions?.filter(s => s.feedback_reports?.[0]?.overall_score) || [];
      const avgScore = scoresWithData.length > 0
        ? Math.round(scoresWithData.reduce((sum, s) => sum + (s.feedback_reports[0]?.overall_score || 0), 0) / scoresWithData.length)
        : 0;

      // Handle session aging (active > 24h = incomplete)
      const processedSessions = sessions?.map(session => {
        const ageMinutes = (new Date().getTime() - new Date(session.created_at).getTime()) / 60000;
        const isStale = session.status === 'active' && ageMinutes > 10;
        const isVeryStale = session.status === 'active' && ageMinutes > 120;

        if (isVeryStale || isStale) {
          Promise.resolve(
            supabase
              .from('interview_sessions')
              .update({ status: 'completed' })
              .eq('id', session.id)
          ).catch(() => {});
          return { ...session, status: 'completed' };
        }
        return session;
      }) || [];

      // Filter: show active sessions (user can continue) OR
      // completed sessions that have a feedback report.
      // Hide ghost sessions - completed with no report and no transcript.
      const visibleSessions = processedSessions.filter(session => {
        if (session.status === 'scheduled' || session.status === 'active') {
          // Only show active sessions that are recent (last 30 mins)
          // so user can continue them. Older active ones are ghosts.
          const ageMinutes = (new Date().getTime() - new Date(session.created_at).getTime()) / 60000;
          return ageMinutes <= 30;
        }
        // For completed: show if there's a feedback report attached
        if (session.status === 'completed') {
          return session.feedback_reports?.[0]?.overall_score != null;
        }
        return false;
      });

      setStats({
        totalSessions,
        avgScore,
        resumeScore: resumes?.[0]?.ats_score || null,
        recentSessions: visibleSessions
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchPrepPlan = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: plans } = await supabase
        .from('prep_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (plans && plans.length > 0) {
        const plan = plans[0];
        const ageMs = Date.now() - new Date(plan.created_at).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (ageMs < sevenDaysMs) {
          setPrepPlan(plan);
        }
      }
    } catch {
      // No plan found - that's fine
    }
  }, [user]);

  const generatePrepPlan = useCallback(async () => {
    if (!user?.id) return;
    setPrepPlanLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-prep-plan', {
        body: { userId: user.id }
      });
      if (error) throw new Error(error.message || 'Error from server');
      if (data?.error) throw new Error(data.error);
      
      toast({ title: "Prep Plan Generated", description: "Your personalized 7-day plan is ready!" });
      await fetchPrepPlan();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate prep plan", variant: "destructive" });
    } finally {
      setPrepPlanLoading(false);
    }
  }, [user, toast, fetchPrepPlan]);

  const calculateTrend = (current: number, previous: number) => {
    if (!previous) return null;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  const startInterview = useCallback(async () => {
    if (!interviewType || !user) return;
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          type: interviewType as 'dsa' | 'system_design' | 'hr',
          status: 'scheduled'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { data: startData, error: startError } = await supabase.functions.invoke('start-interview', {
        body: { sessionId: sessionData.id }
      });

      if (startError) throw startError;

      toast({ title: "Interview Started", description: "Your mock interview session is ready!" });
      setShowInterviewDialog(false);
      window.location.href = `/interview/${sessionData.id}`;
    } catch (error: any) {
      console.error('Error starting interview:', error);
      toast({ title: "Error", description: error.message || "Failed to start interview", variant: "destructive" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewType, user]);

  const getInterviewTypeLabel = (type: string) => {
    switch (type) {
      case 'technical_core':
      case 'technical': return 'Technical & Core Skills';
      case 'behavioral_hr':
      case 'behavioral': return 'Behavioral & HR Fit';
      case 'scenario_case':
      case 'scenario': return 'Scenario / Case Study';
      case 'dsa': return 'Data Structures & Algorithms';
      case 'system_design': return 'System Design';
      case 'hr': return 'HR & Behavioral';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'active': return 'bg-success/20 text-success border-success/30';
      case 'scheduled': return 'bg-primary/20 text-primary border-primary/30';
      case 'incomplete': return 'bg-muted/50 text-muted-foreground border-border';
      default: return 'bg-muted/50 text-muted-foreground border-border';
    }
  };

  const handleNavClick = useCallback((section: string) => {
    if (section === 'resume') navigate('/ats');
    if (section === 'interview') setShowInterviewDialog(true);
    if (section === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (section === 'sessions') document.getElementById('recent-sessions')?.scrollIntoView({ behavior: 'smooth' });
    if (section === 'analytics') document.getElementById('stats-overview')?.scrollIntoView({ behavior: 'smooth' });
    if (section === 'settings') toast({ title: "Settings", description: "Settings panel coming soon." });
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border drop-shadow-2xl z-40 hidden lg:flex lg:flex-col">
          <div className="h-20 flex items-center px-6 border-b border-border/50">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mr-3 animate-pulse" />
            <div className="w-24 h-5 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex-1 px-4 py-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <div className="w-5 h-5 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-32 animate-pulse" />
              </div>
            ))}
          </div>
        </aside>
        
        <main className="flex-1 lg:ml-64 relative min-h-screen pb-20 px-6 py-10 max-w-6xl mx-auto w-full">
          <div className="mb-10">
            <div className="h-10 bg-muted rounded w-3/4 mb-3 animate-pulse" />
            <div className="h-5 bg-muted rounded w-1/2 animate-pulse" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-6 border border-border/50 bg-card h-40 animate-pulse relative overflow-hidden" />
            ))}
          </div>
          
          <div className="flex flex-wrap gap-4 mb-12">
            <div className="h-12 w-48 bg-muted rounded-lg animate-pulse" />
            <div className="h-12 w-48 bg-muted rounded-lg animate-pulse" />
          </div>
          
          <div className="glass-card rounded-2xl border border-border/50 overflow-hidden h-96 animate-pulse" />
        </main>
      </div>
    );
  }

  const resetDate = new Date()
  resetDate.setMonth(resetDate.getMonth() + 1)
  resetDate.setDate(1)
  const resetDateLabel = resetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className="flex min-h-screen bg-background">
      {/* Dark Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border drop-shadow-2xl z-40 hidden lg:flex lg:flex-col">
        <div className="h-20 flex items-center px-6 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mr-3">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Confera</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <button onClick={() => handleNavClick('top')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-medium transition-colors">
            <Home className="w-5 h-5" /> Home
          </button>
          <button onClick={() => handleNavClick('resume')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <FileText className="w-5 h-5 group-hover:text-primary transition-colors" /> Resume Analysis
          </button>
          <button onClick={() => handleNavClick('interview')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <Mic className="w-5 h-5 group-hover:text-primary transition-colors" /> Mock Interview
          </button>
          <button onClick={() => navigate('/practice-tests')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <GraduationCap className="w-5 h-5 group-hover:text-primary transition-colors" /> Practice Tests
          </button>
          <button onClick={() => navigate('/certifications')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <Award className="w-5 h-5 group-hover:text-primary transition-colors" /> Certifications
          </button>
          <button onClick={() => handleNavClick('sessions')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <FolderClock className="w-5 h-5 group-hover:text-primary transition-colors" /> Past Sessions
          </button>
          <button onClick={() => handleNavClick('analytics')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <BarChart3 className="w-5 h-5 group-hover:text-primary transition-colors" /> Analytics
          </button>
          <button onClick={() => window.location.href = '/pricing'} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <CreditCard className="w-5 h-5 group-hover:text-primary transition-colors" /> Pricing & Plan
          </button>
          <button onClick={() => document.getElementById('referral-section')?.scrollIntoView({ behavior: 'smooth' })} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <Gift className="w-5 h-5 group-hover:text-green-400 transition-colors" /> Referrals
          </button>
          <button onClick={() => handleNavClick('settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <Settings className="w-5 h-5 group-hover:text-primary transition-colors" /> Settings
          </button>
        </nav>

        <div className="p-4 border-t border-border/50">
          <Button 
            variant="destructive-link" 
            onClick={signOut} 
            className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[#fee2e2] transition-colors group"
          >
            <LogOut className="w-5 h-5 group-hover:text-[#ef4444]" />
            <span className="group-hover:text-[#ef4444]">Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 relative min-h-screen pb-24 lg:pb-20">
        {/* Mobile Header (Hidden on LG) */}
        <header className="lg:hidden h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button onClick={() => setMobileSidebarOpen(true)} className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-white font-bold text-xs">C</span>
              </div>
              <span className="text-lg font-bold">Confera</span>
            </div>
          </div>
          <Button variant="destructive-link" size="icon" onClick={signOut} className="hover:bg-[#fee2e2] group">
            <LogOut className="w-5 h-5 group-hover:text-[#ef4444]" />
          </Button>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border flex flex-col animate-in slide-in-from-left duration-300 shadow-2xl">
              <div className="h-20 flex items-center justify-between px-6 border-b border-border/50">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mr-3">
                    <span className="text-white font-bold text-sm">C</span>
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground">Confera</span>
                </div>
                <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                <button onClick={() => { handleNavClick('top'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-medium transition-colors">
                  <Home className="w-5 h-5" /> Home
                </button>
                <button onClick={() => { handleNavClick('resume'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <FileText className="w-5 h-5 group-hover:text-primary transition-colors" /> Resume Analysis
                </button>
                <button onClick={() => { handleNavClick('interview'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <Mic className="w-5 h-5 group-hover:text-primary transition-colors" /> Mock Interview
                </button>
                <button onClick={() => { navigate('/practice-tests'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <GraduationCap className="w-5 h-5 group-hover:text-primary transition-colors" /> Practice Tests
                </button>
                <button onClick={() => { navigate('/certifications'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <Award className="w-5 h-5 group-hover:text-primary transition-colors" /> Certifications
                </button>
                <button onClick={() => { handleNavClick('sessions'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <FolderClock className="w-5 h-5 group-hover:text-primary transition-colors" /> Past Sessions
                </button>
                <button onClick={() => { handleNavClick('analytics'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <BarChart3 className="w-5 h-5 group-hover:text-primary transition-colors" /> Analytics
                </button>
                <button onClick={() => { window.location.href = '/pricing'; }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <CreditCard className="w-5 h-5 group-hover:text-primary transition-colors" /> Pricing & Plan
                </button>
                <button onClick={() => { document.getElementById('referral-section')?.scrollIntoView({ behavior: 'smooth' }); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <Gift className="w-5 h-5 group-hover:text-green-400 transition-colors" /> Referrals
                </button>
                <button onClick={() => { handleNavClick('settings'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
                  <Settings className="w-5 h-5 group-hover:text-primary transition-colors" /> Settings
                </button>
              </nav>

              <div className="p-4 border-t border-border/50">
                <Button 
                  variant="destructive-link" 
                  onClick={() => { signOut(); setMobileSidebarOpen(false); }} 
                  className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[#fee2e2] transition-colors group"
                >
                  <LogOut className="w-5 h-5 group-hover:text-[#ef4444]" />
                  <span className="group-hover:text-[#ef4444]">Sign Out</span>
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="px-4 sm:px-6 py-6 sm:py-10 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
              {getGreeting()}, <span className="text-gradient capitalize">{profile?.name?.split(' ')[0] || user?.email?.split('@')[0]}</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              {(() => {
                const hour = new Date().getHours();
                const count = stats.totalSessions;
                const score = stats.avgScore;
                if (hour >= 22 || hour < 5) {
                  return count > 0
                    ? `${count} interviews in - the work you're putting in at this hour is what separates you.`
                    : `Most people are asleep. You're here. That already puts you ahead.`;
                }
                if (hour >= 5 && hour < 12) {
                  return count > 0
                    ? `You're off to a strong start. ${score > 0 ? `Averaging ${score}% - let's push that higher.` : `Keep the sessions coming.`}`
                    : `Fresh start. Today's a good day to run your first mock interview.`;
                }
                if (count > 0 && score >= 75) {
                  return `Strong numbers. ${score}% average across ${count} sessions - you're in the top tier.`;
                }
                if (count > 0 && score > 0) {
                  return `${count} sessions done. There's room to improve - that's exactly why you're here.`;
                }
                return `Here's a breakdown of your interview progress.`;
              })()}
            </p>
          </motion.div>

          {/* Stats Cards with Glow */}
          <div id="stats-overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="glass-card rounded-2xl p-6 border border-border/50 bg-gradient-to-b from-card to-background relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-all font-bold"></div>
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold text-foreground mb-1">{stats.totalSessions}</div>
                  <p className="text-muted-foreground text-sm font-medium">Total Interviews</p>
                  {!isPro && !isFounder && (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        {profile?.interviews_used_this_month || 0}/5 free used this month
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Resets {resetDateLabel}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="glass-card rounded-2xl p-6 border border-border/50 bg-gradient-to-b from-card to-background relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-secondary/20 transition-all"></div>
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  {stats.avgScore > 0 && (
                    <div className="text-xs font-bold text-success flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" /> improving
                    </div>
                  )}
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold text-foreground mb-1">{stats.avgScore}%</div>
                  <p className="text-muted-foreground text-sm font-medium mb-3">Average Score</p>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${stats.avgScore}%` }}></div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="glass-card rounded-2xl p-6 border border-border/50 bg-gradient-to-b from-card to-background relative overflow-hidden group h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-accent/20 transition-all"></div>
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-3 rounded-xl bg-accent/10 text-accent">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>
                <div className="relative z-10">
                  {stats.resumeScore !== null ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="28" className="stroke-muted fill-none" strokeWidth="4" />
                          <circle 
                            cx="32" cy="32" r="28" 
                            className={`fill-none ${stats.resumeScore >= 75 ? 'stroke-success' : stats.resumeScore >= 50 ? 'stroke-yellow-500' : 'stroke-destructive'}`}
                            strokeWidth="4" 
                            strokeDasharray={175.9}
                            strokeDashoffset={175.9 - (175.9 * stats.resumeScore) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                          {stats.resumeScore}%
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-foreground">Resume Health</div>
                        <Button variant="link" size="sm" onClick={() => navigate('/ats')} className="p-0 h-auto text-primary text-xs">Update Resume</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center pt-2">
                      <p className="text-muted-foreground text-sm mb-3">No resume uploaded</p>
                      <Button size="sm" onClick={() => setShowResumeDialog(true)} className="bg-primary/20 hover:bg-primary/30 text-primary border-none">
                        Upload Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="glass-card rounded-2xl p-6 border border-border/50 bg-gradient-to-b from-card to-background relative overflow-hidden group h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-all"></div>
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
                    <Flame className="w-6 h-6" />
                  </div>
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold text-foreground mb-1">{profile?.current_streak || 0} <span className="text-xl text-muted-foreground font-medium">days</span></div>
                  <p className="text-muted-foreground text-sm font-medium mb-3">Current Streak</p>
                  <p className="text-xs text-muted-foreground/60">Longest: {profile?.longest_streak || 0} days</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Quick Actions Array */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button variant="premium" size="lg" className="w-full sm:w-auto px-8 h-14 text-base shadow-glow hover:scale-[1.02] transition-transform" onClick={() => {
              if (canStartInterview) setShowInterviewDialog(true);
              else {
                setUpgradeMessage("You've used all your free interviews this month. Upgrade to Pro for unlimited access.");
                setShowUpgradeModal(true);
              }
            }}>
              <Mic className="w-5 h-5 mr-2" /> Start New Interview
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 h-14 text-base glass-card border-border hover:bg-card/80 hover:text-white hover:scale-[1.02] transition-all" onClick={() => {
              if (canAnalyzeResume) navigate('/ats');
              else {
                setUpgradeMessage("You've used your free resume analysis this month. Upgrade to Pro for unlimited analysis.");
                setShowUpgradeModal(true);
              }
            }}>
              <Upload className="w-5 h-5 mr-2 text-primary" /> Update Resume
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 h-14 text-base glass-card border-border hover:bg-primary/20 hover:text-primary hover:border-primary/30 hover:scale-[1.02] transition-all" onClick={async () => {
              if (canStartInterview) {
                try {
                  const { data: sessionData, error: sessionError } = await supabase
                    .from('interview_sessions')
                    .insert({
                      user_id: user?.id,
                      type: 'quick_practice',
                      job_role: 'General'
                    })
                    .select()
                    .single();

                  if (sessionError) throw sessionError;

                  await supabase.functions.invoke('start-interview', {
                    body: { sessionId: sessionData.id, job_role: 'General' }
                  });

                  navigate(`/interview/${sessionData.id}`);
                } catch (error) {
                  toast({ title: "Error", description: "Failed to start quick practice", variant: "destructive" });
                }
              }
              else {
                setUpgradeMessage("You've used all your free interviews this month. Upgrade to Pro for unlimited access.");
                setShowUpgradeModal(true);
              }
            }}>
              <Zap className="w-5 h-5 mr-2 text-accent" /> Quick Practice
            </Button>
          </div>

          {/* Prep Plan Section */}
          <div className="mb-12">
            {prepPlan ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    Your 7-Day Prep Plan
                  </h3>
                  <Button variant="ghost" size="sm" onClick={generatePrepPlan} disabled={prepPlanLoading} className="text-muted-foreground hover:text-primary">
                    <RefreshCw className={`w-4 h-4 mr-2 ${prepPlanLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Focus + Coaching Card */}
                <div className="glass-card rounded-2xl p-6 border border-primary/20 bg-gradient-to-br from-primary/5 to-card mb-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">Weekly Focus</span>
                    </div>
                    <p className="text-foreground font-semibold text-lg mb-3">{prepPlan.weekly_focus}</p>
                    <div className="bg-background/40 p-4 rounded-xl border border-primary/10 mb-4">
                      <p className="text-sm font-semibold text-foreground/80 mb-1 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Coach's Note
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{prepPlan.coaching_note}</p>
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        prepPlan.priority_interview_type === 'dsa' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                        prepPlan.priority_interview_type === 'system_design' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                        prepPlan.priority_interview_type === 'hr' || prepPlan.priority_interview_type === 'behavioral' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                        'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      }`}>
                        Priority: {prepPlan.priority_interview_type?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 7-Day Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {(prepPlan.daily_tasks || []).map((task: any, idx: number) => (
                    <div key={idx} className="glass-card rounded-xl p-4 border border-border/50 bg-card/50 hover:border-primary/30 transition-colors group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-primary uppercase tracking-widest">Day {task.day || idx + 1}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" /> {task.duration_minutes}m
                        </span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-muted/50 text-xs font-semibold text-foreground/80 mb-2">{task.topic}</span>
                      <p className="text-sm text-muted-foreground leading-relaxed">{task.task}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <div className="glass-card rounded-2xl p-8 border border-border/50 bg-card/30 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Personalized Prep Plan</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Complete an interview session and Confera will generate a personalized 7-day preparation plan based on your strengths and weaknesses.
                  </p>
                  <Button onClick={generatePrepPlan} disabled={prepPlanLoading} className="bg-primary hover:bg-primary-glow text-primary-foreground shadow-glow">
                    {prepPlanLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Plan</>}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Referral Section */}
          <div id="referral-section" className="mb-12">
            <ReferralSection />
          </div>

          {/* Recent Sessions Table */}
          <div id="recent-sessions" className="glass-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50 bg-card/40 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Recent Sessions</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary hover:text-primary-glow hover:bg-primary/10"
                onClick={() => setShowAllSessions(!showAllSessions)}
              >
                {showAllSessions ? 'Show Less' : `View All (${stats.recentSessions.length})`}
              </Button>
            </div>
            
            <div className="p-0">
              {stats.recentSessions.length > 0 ? (
                <div className="w-full">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/30 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-12 sm:col-span-5">Interview Type</div>
                    <div className="hidden sm:block sm:col-span-3">Date</div>
                    <div className="col-span-6 sm:col-span-2 text-center md:text-left">Status</div>
                    <div className="col-span-6 sm:col-span-2 text-right">Score/Action</div>
                  </div>
                  <div className="divide-y divide-border/30">
                    {(showAllSessions ? stats.recentSessions : stats.recentSessions.slice(0, 5)).map((session) => (
                      <div 
                        key={session.id} 
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() => {
                          if (session.status === 'scheduled' || session.status === 'active') {
                            window.location.href = `/interview/${session.id}`;
                          } else {
                            window.location.href = `/report/${session.id}`;
                          }
                        }}
                      >
                        <div className="col-span-12 sm:col-span-5 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${session.type === 'technical_core' || session.type === 'technical' || session.type === 'dsa' ? 'bg-primary/10 text-primary' : session.type === 'scenario_case' || session.type === 'scenario' || session.type === 'system_design' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'}`}>
                            {session.type === 'technical_core' || session.type === 'technical' || session.type === 'dsa' ? <Cpu className="w-5 h-5" /> : session.type === 'scenario_case' || session.type === 'scenario' || session.type === 'system_design' ? <Network className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{getInterviewTypeLabel(session.type)}</div>
                            <div className="sm:hidden text-xs text-muted-foreground mt-0.5">{new Date(session.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="hidden sm:block sm:col-span-3 text-sm text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </div>
                        <div className="col-span-6 sm:col-span-2 flex justify-center md:justify-start">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(session.status)} capitalize`}>
                            {session.status}
                          </span>
                        </div>
                        <div className="col-span-6 sm:col-span-2 text-right">
                          {session.status === 'scheduled' || session.status === 'active' ? (
                            <Button 
                              size="sm" 
                              className="bg-primary hover:bg-primary-glow text-white px-3 shadow-glow"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/interview/${session.id}`;
                              }}
                            >
                              Continue <Play className="w-3 h-3 ml-1 fill-current" />
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-primary hover:bg-primary/10 px-3 border border-primary/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/report/${session.id}`;
                              }}
                            >
                              View Report
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 px-6 relative overflow-hidden group/empty">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover/empty:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-12 group-hover/empty:rotate-0 transition-transform duration-500 border border-primary/20">
                      <FolderClock className="w-12 h-12 text-primary" />
                    </div>
                    <h3 className="font-bold text-2xl text-foreground mb-3">Your Journey Starts Here</h3>
                    <p className="text-muted-foreground mb-10 max-w-sm mx-auto text-lg leading-relaxed">
                      You haven't completed any mock interviews yet. Start your first session to unlock personalized insights and stats.
                    </p>
                    <Button 
                      onClick={() => setShowInterviewDialog(true)} 
                      size="lg"
                      className="bg-primary hover:bg-primary-glow text-primary-foreground shadow-glow h-14 px-10 rounded-2xl font-bold text-lg hover:scale-105 transition-all"
                    >
                      <PlusCircle className="w-5 h-5 mr-2" /> Start Your First Interview
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/50 px-2 py-2 flex items-center justify-around">
        <button onClick={() => handleNavClick('top')} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-primary">
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Home</span>
        </button>
        <button onClick={() => {
          if (canStartInterview) setShowInterviewDialog(true);
          else {
            setUpgradeMessage("You've used all your free interviews this month. Upgrade to Pro for unlimited access.");
            setShowUpgradeModal(true);
          }
        }} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors">
          <Mic className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Interview</span>
        </button>
        <button onClick={() => handleNavClick('resume')} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors">
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Resume</span>
        </button>
        <button onClick={() => handleNavClick('sessions')} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors">
          <FolderClock className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Sessions</span>
        </button>
      </nav>

      {/* Modals */}
      <InterviewSelectionModal 
        open={showInterviewDialog} 
        onOpenChange={setShowInterviewDialog} 
      />

      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent className="max-w-2xl bg-card border-border/50 p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b border-border/50">
            <DialogTitle className="text-xl inline-block">Upload Resume</DialogTitle>
            <DialogDescription className="mt-1">
              Upload for instant ATS compatibility scoring and intelligent skill extraction.
            </DialogDescription>
          </div>
          <div className="p-6">
            <ResumeUpload onAnalysisComplete={() => {
              setShowResumeDialog(false);
              fetchDashboardData();
              refetchSubscription();
            }} />
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        description={upgradeMessage}
      />
    </div>
  );
};

export default Dashboard;