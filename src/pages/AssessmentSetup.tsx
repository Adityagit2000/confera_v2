import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

const AssessmentSetup = () => {
  const [jobRole, setJobRole] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!jobRole.trim()) {
      toast({
        title: "Required",
        description: "Please enter a job role or branch.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate an assessment.",
      });
      navigate('/auth');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-assessment', {
        body: { jobRole: jobRole.trim() }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.assessmentId) {
        navigate(`/assessment-room/${data.assessmentId}`);
      } else {
        throw new Error("Failed to retrieve assessment ID");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: err.message || "Something went wrong.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 sm:py-20 px-4 sm:px-6 relative flex flex-col items-center justify-center">
      <BackButton />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Card className="glass-card border-border/50 shadow-glow overflow-hidden">
          <CardHeader className="text-center pb-8">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Universal Assessment</CardTitle>
            <CardDescription className="text-base mt-2">
              What role are you preparing for?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-muted-foreground">Target Role or Branch</label>
              <Input
                id="role"
                placeholder="e.g., Full Stack Developer, Civil Engineer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                disabled={isGenerating}
                className="h-12 text-lg"
              />
            </div>
            
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !jobRole.trim()}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 animate-pulse" />
                  <span>AI is assembling your custom paper...</span>
                </div>
              ) : (
                "Generate Certification Exam"
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AssessmentSetup;
