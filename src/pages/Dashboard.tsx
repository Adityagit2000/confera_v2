import { useEffect, useState } from 'react';
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
  LogOut
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import ResumeUpload from '@/components/ResumeUpload';

interface DashboardStats {
  totalSessions: number;
  avgScore: number;
  resumeScore: number | null;
  recentSessions: any[];
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
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
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      // Fetch interview sessions
      const { data: sessions } = await supabase
        .from('interview_sessions')
        .select(`
          *,
          feedback_reports(overall_score)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch resume data
      const { data: resumes } = await supabase
        .from('resumes')
        .select('ats_score')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

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
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
    if (!interviewType || !user) return;

    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          type: interviewType as 'dsa' | 'system_design' | 'hr',
          status: 'scheduled'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Interview Started",
        description: "Your mock interview session has been created!",
      });

      setShowInterviewDialog(false);
      
      // Navigate to interview session page
      window.location.href = `/interview/${data.id}`;
      
    } catch (error: any) {
      console.error('Error starting interview:', error);
      toast({
        title: "Error",
        description: "Failed to start interview session",
        variant: "destructive"
      });
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
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'scheduled': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-muted sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">C</span>
            </div>
            <span className="text-xl font-bold">Confera Dashboard</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.email?.split('@')[0]}
            </span>
            <Button variant="ghost" onClick={signOut} size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-elegant transition-all duration-300 bg-gradient-primary text-primary-foreground">
                <CardContent className="p-6 text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg">Start Free Interview</h3>
                  <p className="text-sm opacity-90 mt-1">Begin mock interview now</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Mock Interview</DialogTitle>
                <DialogDescription>
                  Choose the type of interview you'd like to practice with our AI interviewer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="interview-type">Choose Interview Type:</Label>
                <RadioGroup value={interviewType} onValueChange={setInterviewType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dsa" id="dsa" />
                    <Label htmlFor="dsa">Data Structures & Algorithms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system_design" id="system_design" />
                    <Label htmlFor="system_design">System Design</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hr" id="hr" />
                    <Label htmlFor="hr">HR & Behavioral</Label>
                  </div>
                </RadioGroup>
                <Button 
                  onClick={startInterview} 
                  disabled={!interviewType}
                  className="w-full"
                  variant="hero"
                >
                  Start Now
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-elegant transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold text-lg">Upload Resume</h3>
                  <p className="text-sm text-muted-foreground mt-1">Get ATS score & analysis</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Your Resume</DialogTitle>
                <DialogDescription>
                  Upload your resume to get an ATS compatibility score and detailed analysis.
                </DialogDescription>
              </DialogHeader>
              <ResumeUpload onAnalysisComplete={() => {
                setShowResumeDialog(false);
                fetchDashboardData(); // Refresh dashboard data
              }} />
            </DialogContent>
          </Dialog>

          <Card className="cursor-pointer hover:shadow-elegant transition-all duration-300">
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold text-lg">Past Sessions</h3>
              <p className="text-sm text-muted-foreground mt-1">View interview history</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-elegant transition-all duration-300">
            <CardContent className="p-6 text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold text-lg">Analytics</h3>
              <p className="text-sm text-muted-foreground mt-1">Track your progress</p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span>Total Sessions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.totalSessions}</div>
              <p className="text-sm text-muted-foreground mt-1">Mock interviews completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span>Average Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.avgScore}%</div>
              <Progress value={stats.avgScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Resume Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.resumeScore !== null ? (
                <>
                  <div className="text-3xl font-bold text-primary">{stats.resumeScore}%</div>
                  <Progress value={stats.resumeScore} className="mt-2" />
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">No resume uploaded yet</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Upload Resume
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Interview Sessions</CardTitle>
            <CardDescription>Your latest mock interview attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentSessions.length > 0 ? (
              <div className="space-y-4">
                {stats.recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(session.status)}`}></div>
                      <div>
                        <h4 className="font-medium">{getInterviewTypeLabel(session.type)}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                        {session.status}
                      </Badge>
                      {session.feedback_reports?.[0]?.overall_score && (
                        <span className="text-sm font-medium text-primary">
                          {session.feedback_reports[0].overall_score}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">No interviews yet</h3>
                <p className="text-muted-foreground mb-4">Start your first mock interview to see your progress</p>
                <Button variant="hero" onClick={() => setShowInterviewDialog(true)}>
                  Start First Interview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;