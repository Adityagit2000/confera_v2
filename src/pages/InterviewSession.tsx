import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Clock, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  MessageSquare,
  ArrowLeft
} from 'lucide-react';

interface InterviewData {
  id: string;
  type: string;
  status?: string;
  vapi_call_id?: string;
  user_id: string;
  created_at: string;
  scheduled_at?: string;
  duration_sec?: number;
  updated_at?: string;
}

const InterviewSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  useEffect(() => {
    if (sessionId && user) {
      fetchInterviewData();
    }
  }, [sessionId, user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionActive]);

  const fetchInterviewData = async () => {
    try {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;

      setInterview(data as InterviewData);
      
      if ((data as any).vapi_call_id && (data as any).status === 'active') {
        setJoinUrl(`https://vapi.ai/call/${(data as any).vapi_call_id}`);
        setSessionActive(true);
      }
    } catch (error: any) {
      console.error('Error fetching interview:', error);
      toast({
        title: "Error",
        description: "Failed to load interview session",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
    if (!interview) return;

    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-interview', {
        body: { sessionId: interview.id }
      });

      if (error) throw error;

      setJoinUrl(data.joinUrl);
      setSessionActive(true);
      
      toast({
        title: "Interview Started",
        description: "Your AI interviewer is ready to begin!",
      });
      
      // Update local state
      setInterview(prev => prev ? { ...prev, status: 'active', vapi_call_id: data.vapiCallId } : null);
      
    } catch (error: any) {
      console.error('Error starting interview:', error);
      toast({
        title: "Failed to Start",
        description: error.message || "Could not start the interview",
        variant: "destructive"
      });
    } finally {
      setStarting(false);
    }
  };

  const endInterview = async () => {
    if (!interview) return;

    try {
      const { error } = await supabase.functions.invoke('generate-feedback', {
        body: { sessionId: interview.id }
      });

      if (error) throw error;

      toast({
        title: "Interview Completed",
        description: "Generating your feedback report...",
      });
      
      // Navigate to report
      navigate(`/report/${interview.id}`);
      
    } catch (error: any) {
      console.error('Error ending interview:', error);
      toast({
        title: "Error",
        description: "Failed to end interview properly",
        variant: "destructive"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInterviewTypeLabel = (type: string) => {
    switch (type) {
      case 'dsa': return 'Data Structures & Algorithms';
      case 'system_design': return 'System Design';
      case 'hr': return 'HR & Behavioral';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading interview session...</p>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Interview Not Found</h2>
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
              <h1 className="text-lg font-semibold">Interview Session</h1>
              <p className="text-sm text-muted-foreground">
                {getInterviewTypeLabel(interview.type)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant={(interview.status === 'active') ? 'default' : 'secondary'}>
              {interview.status || 'scheduled'}
            </Badge>
            {sessionActive && (
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeElapsed)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {!sessionActive ? (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Ready to Start?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      {getInterviewTypeLabel(interview.type)} Interview
                    </h3>
                    <p className="text-muted-foreground">
                      Your AI interviewer will ask you several questions and provide real-time feedback.
                      Make sure you're in a quiet environment with good internet connection.
                    </p>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Interview Tips:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Speak clearly and at a comfortable pace</li>
                    <li>• Think out loud to show your reasoning process</li>
                    <li>• Ask clarifying questions when needed</li>
                    <li>• Take your time to provide thoughtful answers</li>
                  </ul>
                </div>

                <Button 
                  onClick={startInterview}
                  disabled={starting}
                  className="w-full"
                  variant="hero"
                  size="lg"
                >
                  {starting ? 'Starting Interview...' : 'Start Interview'}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Interview Area */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Interview in Progress</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Live</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
                      <div className="text-center">
                        <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          AI Interview Session Active
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Join the call: <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open Interview Room</a>
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center space-x-4">
                      <Button
                        variant={isMuted ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant={!isVideoOn ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setIsVideoOn(!isVideoOn)}
                      >
                        {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={endInterview}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        End Interview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Session Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">{formatTime(timeElapsed)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{getInterviewTypeLabel(interview.type)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="default">Active</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Quick Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Your responses are being analyzed in real-time. 
                      A detailed report will be generated at the end of the session.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InterviewSession;