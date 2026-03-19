import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import ResumeUpload from "@/components/ResumeUpload";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { InterviewSelectionModal } from "@/components/InterviewSelectionModal";

const Index = () => {
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleStartMockInterview = () => {
    if (!user) {
      navigate('/auth');
    } else {
      setShowInterviewModal(true);
    }
  };

  const handleAnalyzeResume = () => {
    if (!user) {
      navigate('/auth');
    } else {
      setShowResumeModal(true);
    }
  };

  const handleResumeAnalysisComplete = (data: any) => {
    setShowResumeModal(false);
    toast({
      title: "Resume Analysis Complete",
      description: `ATS Score: ${data.ats_score}% - Ready for interview!`,
    });
    // Open the interview selection modal automatically after resume analyze
    setTimeout(() => {
       setShowInterviewModal(true);
    }, 500);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero 
          onStartFreeInterview={handleStartMockInterview} 
          onWatchDemo={handleAnalyzeResume} 
        />
        <Features />
        <HowItWorks />
      </main>
      <footer className="bg-background border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 items-center border-b border-border/50 pb-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="text-xl font-bold text-foreground">Confera</span>
              </div>
              <p className="text-muted-foreground max-w-sm">
                The world's most advanced AI interview preparation platform.
              </p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              © 2026 Confera. Powered by Advanced AI Technology.
            </p>
          </div>
        </div>
      </footer>

      {/* Premium Interview Selection Modal */}
      <InterviewSelectionModal 
        open={showInterviewModal} 
        onOpenChange={setShowInterviewModal} 
      />

      {/* Resume Upload Modal */}
      <Dialog open={showResumeModal} onOpenChange={setShowResumeModal}>
         <DialogContent className="max-w-2xl bg-card border-border/50 p-0 overflow-hidden">
           <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b border-border/50">
             <DialogTitle className="text-xl inline-block">Upload Resume</DialogTitle>
             <DialogDescription className="mt-1">
               Upload for instant ATS compatibility scoring and intelligent skill extraction.
             </DialogDescription>
           </div>
           <div className="p-6">
             <ResumeUpload onAnalysisComplete={handleResumeAnalysisComplete} />
           </div>
         </DialogContent>
       </Dialog>
    </div>
  );
};

export default Index;
