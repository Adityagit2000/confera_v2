import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  TrendingUp, 
  MessageSquare, 
  User, 
  Brain,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface FeedbackReport {
  id: string;
  overall_score: number;
  resume_score: number;
  technical_score: number;
  communication_score: number;
  behavior_score: number;
  summary: string;
  recommendations: any;
  created_at: string;
  session_id: string;
}

interface InterviewSession {
  id: string;
  type: string;
  created_at: string;
}

const Report = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId && user) {
      fetchReportData();
    }
  }, [sessionId, user]);

  const fetchReportData = async () => {
    try {
      // Fetch the report
      const { data: reportData, error: reportError } = await supabase
        .from('feedback_reports')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (reportError && reportError.code !== 'PGRST116') {
        throw reportError;
      }

      if (reportData) {
        setReport(reportData);
      }

      // Fetch session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user!.id)
        .single();

      if (sessionError) throw sessionError;

      setSession(sessionData);

      // If no report exists yet, try to generate it
      if (!reportData) {
        await generateReport();
      }
    } catch (error: any) {
      console.error('Error fetching report:', error);
      toast({
        title: "Error",
        description: "Failed to load report",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-feedback', {
        body: { sessionId }
      });

      if (error) throw error;

      setReport(data.report);
      toast({
        title: "Report Generated",
        description: "Your interview feedback is ready!",
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Report Generation Failed",
        description: error.message || "Could not generate report",
        variant: "destructive"
      });
    }
  };

  const downloadPDF = () => {
    toast({
      title: "PDF Download",
      description: "PDF generation feature coming soon!",
    });
  };

  const shareReport = () => {
    toast({
      title: "Share Report",
      description: "Sharing feature coming soon!",
    });
  };

  const startNewInterview = () => {
    navigate('/dashboard');
  };

  const getInterviewTypeLabel = (type: string) => {
    switch (type) {
      case 'dsa': return 'Data Structures & Algorithms';
      case 'system_design': return 'System Design';
      case 'hr': return 'HR & Behavioral';
      default: return type;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (!report || !session) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Report Not Found</h2>
          <p className="text-muted-foreground">This interview report is not available.</p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-muted sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Interview Report</h1>
              <p className="text-sm text-muted-foreground">
                {getInterviewTypeLabel(session.type)} • {new Date(session.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={shareReport}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPDF}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Overall Score */}
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{report.overall_score}%</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Overall Performance</h2>
                  <p className={`text-lg font-semibold ${getScoreColor(report.overall_score)}`}>
                    {getScoreLabel(report.overall_score)}
                  </p>
                </div>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {report.summary}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">Resume</h3>
                    <p className="text-2xl font-bold">{report.resume_score}%</p>
                  </div>
                </div>
                <Progress value={report.resume_score} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {getScoreLabel(report.resume_score)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Brain className="w-8 h-8 text-purple-500" />
                  <div>
                    <h3 className="font-semibold">Technical</h3>
                    <p className="text-2xl font-bold">{report.technical_score}%</p>
                  </div>
                </div>
                <Progress value={report.technical_score} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {getScoreLabel(report.technical_score)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <MessageSquare className="w-8 h-8 text-green-500" />
                  <div>
                    <h3 className="font-semibold">Communication</h3>
                    <p className="text-2xl font-bold">{report.communication_score}%</p>
                  </div>
                </div>
                <Progress value={report.communication_score} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {getScoreLabel(report.communication_score)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <User className="w-8 h-8 text-orange-500" />
                  <div>
                    <h3 className="font-semibold">Behavioral</h3>
                    <p className="text-2xl font-bold">{report.behavior_score}%</p>
                  </div>
                </div>
                <Progress value={report.behavior_score} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {getScoreLabel(report.behavior_score)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Feedback */}
          {report.recommendations && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Strengths */}
              {report.recommendations.strengths?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>Key Strengths</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {report.recommendations.strengths.map((strength: string, index: number) => (
                        <li key={index} className="flex items-start space-x-3">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Areas for Improvement */}
              {report.recommendations.improvements?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span>Areas for Improvement</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {report.recommendations.improvements.map((improvement: string, index: number) => (
                        <li key={index} className="flex items-start space-x-3">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Next Steps */}
          {report.recommendations?.nextSteps?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.recommendations.nextSteps.map((step: string, index: number) => (
                    <li key={index} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                      <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" onClick={startNewInterview} size="lg">
                Practice Another Interview
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} size="lg">
                View All Sessions
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Keep practicing to improve your interview performance!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Report;