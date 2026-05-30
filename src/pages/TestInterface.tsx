import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LayoutGrid, ChevronLeft, ChevronRight, Star, Clock } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";

export default function TestInterface() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { questions, testType, testId, branch, timeLimit } = location.state || {};
  const sessionId = location.pathname.split('/').pop();
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true });
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 3600);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  if (!questions || !user) {
    return <Navigate to="/practice-tests" replace />;
  }

  const totalQ = questions.length;
  const currentQ = questions[currentIdx];

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

  const handleAnswerChange = (val: number) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: val }));
  };

  const toggleMarkForReview = () => {
    setMarkedForReview(prev => ({ ...prev, [currentIdx]: !prev[currentIdx] }));
  };

  const goToQuestion = (idx: number) => {
    setVisited(prev => ({ ...prev, [idx]: true }));
    setCurrentIdx(idx);
  };

  const submitTest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);
    
    try {
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

      const { data, error } = await supabase
        .from('test_sessions')
        .insert({
          id: sessionId,
          user_id: user.id,
          branch: branch || 'General',
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
      navigate(`/practice-tests/${sessionId}/results`, { replace: true });

    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Failed to submit test. Please try again.");
      setIsSubmitting(false);
    }
  };

  const getTimerColor = () => {
    if (timeRemaining < 300) return 'text-red-500 animate-pulse border-red-500/50';
    if (timeRemaining < 600) return 'text-amber-500 border-amber-500/50';
    return 'text-emerald-500 border-emerald-500/50';
  };

  const getQuestionStatusClass = (idx: number) => {
    if (idx === currentIdx) return "ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-950";
    if (markedForReview[idx]) return "bg-yellow-500 text-black";
    if (answers[idx] !== undefined) return "bg-indigo-600 text-white";
    if (visited[idx]) return "bg-zinc-900 border-2 border-white text-white";
    return "bg-zinc-800 text-zinc-400"; // not visited
  };

  const unansweredCount = totalQ - Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="font-bold text-white text-sm md:text-base">{testType}</h1>
          <p className="text-xs text-zinc-400">{branch}</p>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-300">
            Question {currentIdx + 1} of {totalQ}
          </div>
        </div>

        <div className="flex-1 flex justify-end">
          <div className={cn(
            "flex items-center justify-center w-12 h-12 rounded-full border-2",
            getTimerColor()
          )}>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] font-bold mt-1">MIN</span>
              <span className="text-xs font-mono font-bold">{Math.floor(timeRemaining / 60)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Left: Question Area */}
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col relative">
            
            <div className="mb-6 flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                Question {currentIdx + 1}
              </span>
              <span className="text-sm text-zinc-500">{currentQ.topic}</span>
            </div>

            <p className="text-lg md:text-2xl text-zinc-100 whitespace-pre-wrap leading-relaxed mb-10">
              {currentQ.question}
            </p>

            <div className="space-y-4 mb-auto">
              {currentQ.options.map((opt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => handleAnswerChange(i)}
                  className={cn(
                    "w-full flex items-center text-left p-4 rounded-xl border-2 transition-all duration-200",
                    answers[currentIdx] === i 
                      ? "bg-indigo-600/10 border-indigo-500 text-white" 
                      : "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center font-bold text-sm mr-4 transition-colors",
                    answers[currentIdx] === i 
                      ? "bg-indigo-600 text-white" 
                      : "bg-zinc-800 text-zinc-400"
                  )}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-base md:text-lg">{opt}</span>
                </button>
              ))}
            </div>

            {/* Bottom Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-12 pt-6 border-t border-zinc-800">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 h-12 px-6"
                  onClick={() => goToQuestion(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Previous
                </Button>
                <Button
                  variant="outline"
                  className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 h-12 px-6"
                  onClick={() => goToQuestion(Math.min(totalQ - 1, currentIdx + 1))}
                  disabled={currentIdx === totalQ - 1}
                >
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={toggleMarkForReview}
                  className={cn(
                    "h-12 px-6 border-zinc-700 transition-colors",
                    markedForReview[currentIdx] 
                      ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/20" 
                      : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  )}
                >
                  <Star className={cn("w-4 h-4 mr-2", markedForReview[currentIdx] && "fill-current")} />
                  {markedForReview[currentIdx] ? 'Review Added' : 'Mark for Review'}
                </Button>

                <Button
                  onClick={() => setShowSubmitModal(true)}
                  className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Submit Test
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Question Palette */}
        <div className="w-full xl:w-80 border-t xl:border-t-0 xl:border-l border-zinc-800 bg-zinc-950/50 p-6 overflow-y-auto hidden md:block">
          <div className="flex items-center gap-2 mb-6 text-white font-bold">
            <LayoutGrid className="w-5 h-5 text-indigo-400" />
            Question Palette
          </div>

          <div className="space-y-3 mb-8 text-xs text-zinc-400 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-indigo-600" /> Answered
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-yellow-500" /> Marked for Review
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-zinc-900 border-2 border-white" /> Visited, Not Answered
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-zinc-800" /> Not Visited
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {questions.map((_: any, idx: number) => (
              <button
                key={idx}
                onClick={() => goToQuestion(idx)}
                className={cn(
                  "h-10 w-full rounded flex items-center justify-center text-sm font-bold transition-all",
                  getQuestionStatusClass(idx)
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {unansweredCount > 0 ? (
                <>You have <strong className="text-white">{unansweredCount} questions unanswered</strong>. </>
              ) : (
                <>You have answered all questions. </>
              )}
              This cannot be undone. Do you want to submit your test?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white hover:bg-zinc-800 border-zinc-700">
              Return to Test
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={submitTest}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Calculating your results...' : 'Confirm Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
