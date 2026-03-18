import { useEffect, useState } from 'react';
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
  Play
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ResumeUpload from '@/components/ResumeUpload';
import { InterviewSelectionModal } from '@/components/InterviewSelectionModal';
import { motion } from 'framer-motion';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/UpgradeModal';
import { CreditCard } from 'lucide-react';

interface DashboardStats {
  totalSessions: number;
  avgScore: number;
  resumeScore: number | null;
  recentSessions: any[];
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    avgScore: 0,
    resumeScore: null,
    recentSessions: []
  });
  const [loading, setLoading] = useState(true);
  const [interviewType, setInterviewType] = useState<string>('');
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const { toast } = useToast();
  const { isPro, canStartInterview, canAnalyzeResume, profile, refetch: refetchSubscription } = useSubscription();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('interview_sessions')
        .select(`*, feedback_reports(overall_score)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (sessionsError) console.error('Sessions error:', sessionsError);

      const { data: resumes, error: resumesError } = await supabase
        .from('resumes')
        .select('ats_score')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (resumesError) console.error('Resumes error:', resumesError);

      const totalSessions = sessions?.length || 0;
      const scoresWithData = sessions?.filter(s => s.feedback_reports?.[0]?.overall_score) || [];
      const avgScore = scoresWithData.length > 0
        ? Math.round(scoresWithData.reduce((sum, s) => sum + (s.feedback_reports[0]?.overall_score || 0), 0) / scoresWithData.length)
        : 0;

      setStats({
        totalSessions,
        avgScore,
        resumeScore: resumes?.[0]?.ats_score || null,
        recentSessions: sessions?.slice(0, 5) || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
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
  };

  const getInterviewTypeLabel = (type: string) => {
    switch (type) {
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
      default: return 'bg-muted/50 text-muted-foreground border-border';
    }
  };

  const handleNavClick = (section: string) => {
    if (section === 'resume') navigate('/ats');
    if (section === 'interview') setShowInterviewDialog(true);
    if (section === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (section === 'sessions') document.getElementById('recent-sessions')?.scrollIntoView({ behavior: 'smooth' });
    if (section === 'analytics') document.getElementById('stats-overview')?.scrollIntoView({ behavior: 'smooth' });
    if (section === 'settings') toast({ title: "Settings", description: "Settings panel coming soon." });
  };

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
          <button onClick={() => handleNavClick('sessions')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <FolderClock className="w-5 h-5 group-hover:text-primary transition-colors" /> Past Sessions
          </button>
          <button onClick={() => handleNavClick('analytics')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <BarChart3 className="w-5 h-5 group-hover:text-primary transition-colors" /> Analytics
          </button>
          <button onClick={() => window.location.href = '/pricing'} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <CreditCard className="w-5 h-5 group-hover:text-primary transition-colors" /> Pricing & Plan
          </button>
          <button onClick={() => handleNavClick('settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group">
            <Settings className="w-5 h-5 group-hover:text-primary transition-colors" /> Settings
          </button>
        </nav>

        <div className="p-4 border-t border-border/50">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 relative min-h-screen pb-20">
        {/* Mobile Header (Hidden on LG) */}
        <header className="lg:hidden h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-lg font-bold">Confera</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </header>

        {/* Welcome Banner */}
        <div className="px-6 py-10 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
              Welcome back, <span className="text-gradient capitalize">{user?.email?.split('@')[0]}</span>
            </h1>
            <p className="text-muted-foreground text-lg">Here's a breakdown of your interview progress.</p>
          </motion.div>

          {/* Stats Cards with Glow */}
          <div id="stats-overview" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
              <div className="glass-card rounded-2xl p-6 border border-border/50 bg-gradient-to-b from-card to-background relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-accent/20 transition-all"></div>
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-3 rounded-xl bg-accent/10 text-accent">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
                <div className="relative z-10">
                  {stats.resumeScore !== null ? (
                    <>
                      <div className="text-4xl font-extrabold text-foreground mb-1">{stats.resumeScore}%</div>
                      <p className="text-muted-foreground text-sm font-medium mb-3">ATS Compatibility</p>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-accent h-1.5 rounded-full" style={{ width: `${stats.resumeScore}%` }}></div>
                      </div>
                    </>
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
          </div>

          {/* Quick Actions Array */}
          <div className="flex flex-wrap gap-4 mb-12">
            <Button size="lg" className="bg-primary hover:bg-primary-glow text-primary-foreground font-semibold px-6 shadow-glow" onClick={() => {
              if (canStartInterview) setShowInterviewDialog(true);
              else {
                setUpgradeMessage("You've used all your free interviews this month. Upgrade to Pro for unlimited access.");
                setShowUpgradeModal(true);
              }
            }}>
              <Mic className="w-5 h-5 mr-2" /> Start New Interview
            </Button>
            <Button size="lg" variant="outline" className="glass-card border-border hover:bg-card hover:text-foreground" onClick={() => {
              if (canAnalyzeResume) navigate('/ats');
              else {
                setUpgradeMessage("You've used your free resume analysis this month. Upgrade to Pro for unlimited analysis.");
                setShowUpgradeModal(true);
              }
            }}>
              <Upload className="w-5 h-5 mr-2 text-muted-foreground" /> Update Resume
            </Button>
          </div>

          {/* Recent Sessions Table */}
          <div id="recent-sessions" className="glass-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-border/50 bg-card/40 flex justify-between items-center">
              <h3 className="font-semibold text-lg">Recent Sessions</h3>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary-glow hover:bg-primary/10">View All</Button>
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
                    {stats.recentSessions.map((session) => (
                      <div 
                        key={session.id} 
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() => {
                          if (session.status === 'scheduled') window.location.href = `/interview/${session.id}`;
                          else if (session.status === 'completed') window.location.href = `/report/${session.id}`;
                        }}
                      >
                        <div className="col-span-12 sm:col-span-5 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${session.type === 'dsa' ? 'bg-primary/10 text-primary' : session.type === 'system_design' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'}`}>
                            {session.type === 'dsa' ? <Cpu className="w-5 h-5" /> : session.type === 'system_design' ? <Network className="w-5 h-5" /> : <Users className="w-5 h-5" />}
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
                          {session.status === 'completed' && session.feedback_reports?.[0]?.overall_score ? (
                            <div className="font-bold text-lg text-foreground bg-primary/10 inline-block px-3 py-1 rounded-lg">
                              {session.feedback_reports[0].overall_score}%
                            </div>
                          ) : session.status === 'scheduled' ? (
                            <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10 hover:text-primary-glow px-3 border border-primary/20">
                              Continue <Play className="w-3 h-3 ml-1 fill-current" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 px-6">
                  <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FolderClock className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-medium text-xl text-foreground mb-2">No past sessions</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">You haven't completed any mock interviews yet. Start your journey below.</p>
                  <Button onClick={() => setShowInterviewDialog(true)} className="bg-primary hover:bg-primary-glow text-primary-foreground shadow-glow">
                    <PlusCircle className="w-4 h-4 mr-2" /> Start First Interview
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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