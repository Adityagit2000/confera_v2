import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Target, CheckCircle2, XCircle, Award, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function PracticeTestResults() {
  const { id } = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topicScores, setTopicScores] = useState<Record<string, { total: number, correct: number }>>({});

  useEffect(() => {
    fetchResults();
  }, [id]);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setSession(data);

      // Calculate topic-wise scores
      const topics: Record<string, { total: number, correct: number }> = {};
      const questions = data.questions || [];
      const answers = data.answers || {};

      questions.forEach((q: any, idx: number) => {
        const topic = q.topic || 'General';
        if (!topics[topic]) topics[topic] = { total: 0, correct: 0 };
        
        topics[topic].total++;
        if (answers[idx] === q.correct_answer) {
          topics[topic].correct++;
        }
      });

      setTopicScores(topics);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Failed to load test results.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-bold text-white mb-4">Results Not Found</h1>
        <p className="text-zinc-400 mb-8">We couldn't find the test session you're looking for.</p>
        <Link to="/practice-tests">
          <Button variant="outline" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">
            Return to Practice Tests
          </Button>
        </Link>
      </div>
    );
  }

  const { questions, answers, score, time_taken_seconds, certificate_eligible, test_type } = session;
  const totalQuestions = questions.length;
  const correctAnswers = Object.keys(answers).filter(k => answers[k] === questions[k].correct_answer).length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />

      <main className="container max-w-5xl mx-auto px-4 pt-32 space-y-8">
        
        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800 p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" className="stroke-zinc-800" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  className={cn("stroke-primary transition-all duration-1000 ease-out")} 
                  strokeWidth="12" fill="none" 
                  strokeDasharray={`${(score / 100) * 351} 351`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold text-white">{score}%</span>
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-white mb-2">{test_type} Results</h1>
              <p className="text-zinc-400 mb-6">
                You answered {correctAnswers} out of {totalQuestions} questions correctly.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
                  <Target className="w-5 h-5 text-emerald-400" />
                  <span className="text-white font-medium">{correctAnswers} Correct</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-white font-medium">{totalQuestions - correctAnswers} Incorrect</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span className="text-white font-medium">{formatTime(time_taken_seconds)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Certificate Badge Card */}
          <Card className={cn(
            "p-8 flex flex-col items-center justify-center text-center relative overflow-hidden",
            certificate_eligible 
              ? "bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/30" 
              : "bg-zinc-900/50 border-zinc-800"
          )}>
            {certificate_eligible && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
            )}
            <Award className={cn(
              "w-16 h-16 mb-4",
              certificate_eligible ? "text-yellow-400" : "text-zinc-600"
            )} />
            <h3 className="text-lg font-bold text-white mb-2">
              {certificate_eligible ? "Certificate Eligible!" : "Keep Practicing"}
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              {certificate_eligible 
                ? "You scored above 70% and have unlocked a placement readiness certificate." 
                : "Score at least 70% to unlock your placement readiness certificate."}
            </p>
            {certificate_eligible ? (
              <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold shadow-glow">
                Generate Certificate
              </Button>
            ) : (
              <Button disabled variant="outline" className="w-full bg-zinc-950 border-zinc-800">
                Locked
              </Button>
            )}
          </Card>
        </div>

        {/* Topic Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Topic Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(topicScores).map(([topic, stats]) => (
              <Card key={topic} className="bg-zinc-900/30 border-zinc-800/50 p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium mb-1">{topic}</h4>
                  <p className="text-sm text-zinc-400">{stats.correct} / {stats.total} correct</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">
                      {Math.round((stats.correct / stats.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-12 h-12 relative flex items-center justify-center">
                     <svg className="w-full h-full transform -rotate-90">
                      <circle cx="24" cy="24" r="20" className="stroke-zinc-800" strokeWidth="4" fill="none" />
                      <circle 
                        cx="24" cy="24" r="20" 
                        className="stroke-primary" 
                        strokeWidth="4" fill="none" 
                        strokeDasharray={`${(stats.correct / stats.total) * 125.6} 125.6`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Question Review */}
        <div className="space-y-4 pt-8 border-t border-zinc-800">
          <h2 className="text-xl font-bold text-white">Question Review</h2>
          <div className="space-y-6">
            {questions.map((q: any, i: number) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correct_answer;
              const isUnanswered = userAnswer === undefined;

              return (
                <Card key={i} className={cn(
                  "border p-6",
                  isCorrect ? "bg-emerald-950/20 border-emerald-900/50" : 
                  isUnanswered ? "bg-zinc-900/20 border-zinc-800" : 
                  "bg-red-950/20 border-red-900/50"
                )}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="mt-1">
                      {isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : isUnanswered ? (
                        <div className="w-6 h-6 rounded-full border-2 border-zinc-600 flex items-center justify-center text-xs text-zinc-500 font-bold">-</div>
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400">Question {i + 1}</span>
                        <span className="text-sm text-zinc-500">{q.topic}</span>
                      </div>
                      <p className="text-lg text-zinc-200">{q.question}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10 mb-6">
                    {q.options.map((opt: string, optIdx: number) => {
                      const isSelected = userAnswer === optIdx;
                      const isActualCorrect = q.correct_answer === optIdx;

                      return (
                        <div key={optIdx} className={cn(
                          "px-4 py-3 rounded-lg border text-sm flex items-center gap-3",
                          isActualCorrect && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                          isSelected && !isActualCorrect && "bg-red-500/10 border-red-500/30 text-red-300",
                          !isSelected && !isActualCorrect && "bg-zinc-950/50 border-zinc-800 text-zinc-400"
                        )}>
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border",
                            isActualCorrect && "bg-emerald-500 text-black border-emerald-500",
                            isSelected && !isActualCorrect && "bg-red-500 text-black border-red-500",
                            !isSelected && !isActualCorrect && "border-zinc-700"
                          )}>
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pl-10">
                    <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
                      <h5 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-primary" />
                        Explanation
                      </h5>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        {q.explanation}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
