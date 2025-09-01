import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import CTA from "@/components/CTA";
import ResumeUpload from "@/components/ResumeUpload";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [interviewType, setInterviewType] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'auth' | 'resume' | 'interview'>('auth');
  const [resumeAnalyzed, setResumeAnalyzed] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const startFreeInterview = () => {
    if (!user) {
      setCurrentStep('auth');
    } else {
      setCurrentStep('resume');
    }
    setShowInterviewDialog(true);
  };

  const handleAuthComplete = () => {
    setCurrentStep('resume');
  };

  const handleResumeAnalysisComplete = (data: any) => {
    setResumeAnalyzed(true);
    setCurrentStep('interview');
    toast({
      title: "Resume Analysis Complete",
      description: `ATS Score: ${data.ats_score}% - Ready for interview!`,
    });
  };

  const handleStartInterview = async () => {
    if (!interviewType || !user) return;

    try {
      // Create session in database
      const { data: sessionData, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          type: interviewType,
          status: 'scheduled',
          scheduled_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Start the interview via edge function
      const { data: startData, error: startError } = await supabase.functions.invoke('start-interview', {
        body: { sessionId: sessionData.id }
      });

      if (startError) throw startError;

      toast({
        title: "Interview Started",
        description: "Your mock interview session is ready!",
      });

      setShowInterviewDialog(false);
      navigate(`/interview/${sessionData.id}`);
      
    } catch (error: any) {
      console.error('Error starting interview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start interview session",
        variant: "destructive"
      });
    }
  };

  const getDialogTitle = () => {
    switch (currentStep) {
      case 'auth': return 'Start Free Mock Interview';
      case 'resume': return 'Upload Your Resume';
      case 'interview': return 'Ready for Interview';
      default: return 'Start Free Mock Interview';
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero onStartFreeInterview={startFreeInterview} />
        <Features />
        <HowItWorks />
        <CTA onGetStarted={() => navigate('/auth')} />
      </main>
      <footer className="bg-card border-t border-muted py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 gradient-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-semibold text-foreground">Confera</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Confera. Powered by Advanced AI Technology.
          </p>
        </div>
      </footer>

      {/* Interview Modal */}
      <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          
          {/* Auth Step */}
          {currentStep === 'auth' && (
            <div className="space-y-4">
              <p className="text-muted-foreground">Sign in or create an account to start your personalized mock interview</p>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => navigate('/auth')} 
                  variant="hero"
                  className="w-full"
                >
                  Sign In / Create Account
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Free account • No credit card required
                </p>
              </div>
            </div>
          )}

          {/* Resume Step */}
          {currentStep === 'resume' && user && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Upload your resume to get personalized feedback and tailored interview questions
              </p>
              <ResumeUpload onAnalysisComplete={handleResumeAnalysisComplete} />
              {resumeAnalyzed && (
                <Button 
                  onClick={() => setCurrentStep('interview')}
                  variant="hero"
                  className="w-full"
                >
                  Continue to Interview Selection
                </Button>
              )}
            </div>
          )}

          {/* Interview Selection Step */}
          {currentStep === 'interview' && user && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Great! Your resume has been analyzed. Now choose your interview type:
              </p>
              <RadioGroup value={interviewType} onValueChange={setInterviewType}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="dsa" id="dsa" />
                  <Label htmlFor="dsa" className="flex-1 cursor-pointer">
                    <div>
                      <div className="font-medium">Data Structures & Algorithms</div>
                      <div className="text-sm text-muted-foreground">Coding problems and algorithmic thinking</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="system_design" id="system_design" />
                  <Label htmlFor="system_design" className="flex-1 cursor-pointer">
                    <div>
                      <div className="font-medium">System Design</div>
                      <div className="text-sm text-muted-foreground">Architecture and scalability discussions</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="hr" id="hr" />
                  <Label htmlFor="hr" className="flex-1 cursor-pointer">
                    <div>
                      <div className="font-medium">HR & Behavioral</div>
                      <div className="text-sm text-muted-foreground">Behavioral questions and cultural fit</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              <Button 
                onClick={handleStartInterview} 
                disabled={!interviewType}
                variant="hero"
                className="w-full"
              >
                Start Interview
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
