import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, ChevronRight, ChevronLeft, Award } from 'lucide-react';
import BackButton from '@/components/BackButton';

interface Question {
  id: string;
  category: string;
  question_text: string;
  options: string[];
}

const AssessmentRoom = () => {
  const { id: assessmentId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!user || !assessmentId) return;

    const fetchAssessment = async () => {
      setLoading(true);
      try {
        const { data: assessment, error: assessmentError } = await supabase
          .from('assessments')
          .select('*')
          .eq('id', assessmentId)
          .single();

        if (assessmentError || !assessment) throw new Error("Assessment not found");

        if (assessment.status === 'completed') {
          setResult({
            scorePercentage: assessment.score_percentage,
            passed: assessment.passed,
            completed: true
          });
          setLoading(false);
          return;
        }

        const { data: qData, error: qError } = await supabase
          .from('assessment_questions')
          .select('id, category, question_text, options')
          .eq('assessment_id', assessmentId);

        if (qError || !qData) throw new Error("Questions not found");
        setQuestions(qData);
        
        // Timer calculation
        const startedAt = new Date(assessment.started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startedAt) / 1000);
        const remaining = (assessment.duration_minutes * 60) - elapsedSeconds;
        
        if (remaining <= 0) {
          handleSubmit(qData);
        } else {
          setTimeLeft(remaining);
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [user, assessmentId, navigate]);

  useEffect(() => {
    if (loading || result || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, result, timeLeft]);

  const handleSubmit = async (qs = questions) => {
    setSubmitting(true);
    try {
      const submissions = qs.map(q => ({
        questionId: q.id,
        selectedOption: answers[q.id] ?? -1
      }));

      const { data, error } = await supabase.functions.invoke('evaluate-assessment', {
        body: { assessmentId, submissions }
      });

      if (error) throw new Error(error.message);
      
      setResult(data);
      toast({
        title: "Assessment Submitted",
        description: "Your results are ready.",
      });
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptionSelect = (val: string) => {
    const qId = questions[currentIdx].id;
    setAnswers(prev => ({ ...prev, [qId]: parseInt(val) }));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-10 px-4">
        <BackButton />
        <Card className="max-w-md w-full glass-card border-border/50 text-center py-10">
          <CardHeader>
            <div className="mx-auto mb-4">
              {result.passed ? (
                <Award className="w-20 h-20 text-emerald-500 mx-auto" />
              ) : (
                <CheckCircle2 className="w-20 h-20 text-muted-foreground mx-auto" />
              )}
            </div>
            <CardTitle className="text-3xl font-bold">
              {result.passed ? "Congratulations!" : "Assessment Completed"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg text-muted-foreground">
              You scored <span className="text-primary font-bold text-2xl">{result.scorePercentage?.toFixed(0)}%</span>
            </p>
            {result.passed ? (
              <p className="text-emerald-500 font-medium">You have successfully passed the certification exam.</p>
            ) : (
              <p className="text-muted-foreground">You need 70% to pass. Keep practicing and try again!</p>
            )}
            {result.certificateHash && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm break-all font-mono">
                Certificate ID: {result.certificateHash}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-center mt-6">
            <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 flex flex-col">
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 p-4 glass-card rounded-2xl border border-border/50">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
              {currentQ?.category}
            </span>
          </div>
          <div className={`flex items-center gap-2 font-mono text-lg font-bold ${timeLeft < 300 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="glass-card border-border/50 shadow-glow">
                <CardHeader>
                  <CardTitle className="text-xl leading-relaxed">
                    {currentQ?.question_text}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-8">
                  <RadioGroup 
                    value={answers[currentQ?.id]?.toString()} 
                    onValueChange={handleOptionSelect}
                    className="space-y-4"
                  >
                    {currentQ?.options.map((opt, i) => (
                      <div key={i} className={`flex items-center space-x-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${answers[currentQ?.id] === i ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/30 hover:bg-muted/20'}`} onClick={() => handleOptionSelect(i.toString())}>
                        <RadioGroupItem value={i.toString()} id={`opt-${i}`} className="mt-0.5" />
                        <Label htmlFor={`opt-${i}`} className="flex-1 text-base cursor-pointer leading-relaxed">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
            disabled={currentIdx === 0}
            className="w-32"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Previous
          </Button>
          
          {isLast ? (
            <Button 
              onClick={() => handleSubmit()} 
              disabled={submitting}
              className="w-48 bg-gradient-to-r from-primary to-secondary"
            >
              {submitting ? "Submitting..." : "Submit Assessment"}
              {!submitting && <CheckCircle2 className="w-4 h-4 ml-2" />}
            </Button>
          ) : (
            <Button 
              onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
              className="w-32"
            >
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentRoom;
