import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import CTA from "@/components/CTA";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [interviewType, setInterviewType] = useState<string>('');
  const navigate = useNavigate();

  const startFreeInterview = () => {
    setShowInterviewDialog(true);
  };

  const handleStartInterview = () => {
    // For now, redirect to auth - in a real app this would start the interview
    navigate('/auth');
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Free Mock Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">Choose your interview type to get started:</p>
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
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleStartInterview} 
                disabled={!interviewType}
                variant="hero"
                className="w-full"
              >
                Continue to Sign Up
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Create a free account to start your mock interview
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
