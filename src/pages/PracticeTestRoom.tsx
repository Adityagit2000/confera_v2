import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Clock, Flag, LayoutGrid, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PracticeTestRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { questions, testType, testId, timeLimit } = location.state || {};
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 3600);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if no state
  if (!questions || !user) {
    return <Navigate to="/practice-tests" replace />;
  }

  const currentQ = questions[currentIdx];
  const totalQ = questions.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev: number) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (val: string) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: parseInt(val) }));
  };

  const toggleMarkForReview = () => {
    setMarkedForReview(prev => ({ ...prev, [currentIdx]: !prev[currentIdx] }));
  };

  const submitTest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Calculate score
      let correctCount = 0;
      let subjects = new Set<string>();
      
      questions.forEach((q: any, i: number) => {
        if (q.topic) subjects.add(q.topic);
        if (answers[i] === q.correct_answer) {
          correctCount++;
        }
      });

      const scorePercentage = Math.round((correctCount / totalQ) * 100);
      const isEligible = scorePercentage >= 70;
      const timeTaken = timeLimit - timeRemaining;

      // Save to database
      const { data, error } = await supabase
        .from('test_sessions')
        .insert({
          user_id: user.id,
          branch: testId.includes('cse') ? 'CSE' : testId.includes('ece') ? 'ECE' : testId.includes('me') ? 'ME' : 'General',
          test_type: testType,
          subjects_covered: Array.from(subjects).join(', '),
          questions: questions,
          answers: answers,
          score: scorePercentage,
          time_taken_seconds: timeTaken,
          completed_at: new Date().toISOString(),
          certificate_eligible: isEligible
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success("Test submitted successfully!");
      navigate(`/practice-tests/results/${data.id}`, { replace: true });

    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Failed to submit test. Please try again.");
      setIsSubmitting(false);
    }
  };

  const getQuestionStatus = (idx: number) => {
    if (markedForReview[idx]) return 'review';
    if (answers[idx] !== undefined) return 'answered';
    if (idx === currentIdx) return 'current';
    return 'unanswered';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Header Bar */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-sm md:text-base">{testType}</h1>
            <p className="text-xs text-zinc-400">Mock Examination</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center gap-2 font-mono font-bold text-lg px-4 py-1.5 rounded-full",
            timeRemaining < 300 ? "text-red-400 bg-red-400/10" : "text-white bg-zinc-900"
          )}>
            <Clock className="w-4 h-4" />
            {formatTime(timeRemaining)}
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" className="bg-primary text-black hover:bg-primary/90 font-bold">
                Submit Test
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-950 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Submit Test?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  You have answered {Object.keys(answers).length} out of {totalQ} questions. 
                  Are you sure you want to submit? You cannot return to the test after submitting.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent text-white hover:bg-zinc-800 border-zinc-700">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={submitTest}
                  className="bg-primary text-black hover:bg-primary/90 font-bold"
                >
                  Confirm Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Question Area (Left) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
          <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-white">Question {currentIdx + 1}</span>
                <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                  {currentQ.topic}
                </span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                  currentQ.difficulty === 'easy' && "text-emerald-400 bg-emerald-400/10",
                  currentQ.difficulty === 'medium' && "text-amber-400 bg-amber-400/10",
                  currentQ.difficulty === 'hard' && "text-red-400 bg-red-400/10"
                )}>
                  {currentQ.difficulty}
                </span>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={toggleMarkForReview}
                className={cn(
                  "gap-2",
                  markedForReview[currentIdx] ? "text-amber-400 hover:text-amber-300 bg-amber-400/10" : "text-zinc-400 hover:text-white"
                )}
              >
                <Flag className="w-4 h-4" />
                {markedForReview[currentIdx] ? 'Marked for Review' : 'Mark for Review'}
              </Button>
            </div>

            <Card className="bg-zinc-900/50 border-zinc-800 p-6 md:p-8 flex-1">
              <p className="text-lg md:text-xl text-zinc-100 whitespace-pre-wrap leading-relaxed mb-8">
                {currentQ.question}
              </p>

              <RadioGroup 
                value={answers[currentIdx]?.toString()} 
                onValueChange={handleAnswerChange}
                className="space-y-3"
              >
                {currentQ.options.map((opt: string, i: number) => (
                  <div key={i} className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value={i.toString()} 
                      id={`opt-${i}`} 
                      className="sr-only"
                    />
                    <Label
                      htmlFor={`opt-${i}`}
                      className={cn(
                        "flex flex-1 items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200",
                        answers[currentIdx] === i 
                          ? "bg-primary/10 border-primary text-white" 
                          : "bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                        answers[currentIdx] === i ? "border-primary bg-primary text-black" : "border-zinc-600"
                      )}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-base">{opt}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </Card>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <Button
                variant="outline"
                className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                onClick={() => setCurrentIdx(prev => Math.min(totalQ - 1, prev + 1))}
                disabled={currentIdx === totalQ - 1}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Question Palette Sidebar (Right) */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950/50 p-4 md:p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6 text-white font-bold">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Question Palette
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> Answered
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-zinc-700" /> Unanswered
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-amber-500" /> Marked Review
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-white ring-2 ring-primary ring-offset-1 ring-offset-zinc-950" /> Current
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((_: any, idx: number) => {
              const status = getQuestionStatus(idx);
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={cn(
                    "h-10 w-full rounded-lg text-sm font-bold flex items-center justify-center transition-all",
                    status === 'answered' && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                    status === 'unanswered' && "bg-zinc-800 text-zinc-400 border border-zinc-700",
                    status === 'review' && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                    status === 'current' && "bg-zinc-800 text-white ring-2 ring-primary ring-offset-2 ring-offset-zinc-950",
                  )}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
