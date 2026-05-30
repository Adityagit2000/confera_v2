import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Target, CheckCircle2, XCircle, Award, RefreshCcw, Share2, Eye, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function TestResults() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Correct' | 'Incorrect' | 'Skipped'>('All');

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      setSession(data);

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
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">Loading your results...</p>
        </div>
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

  const { questions, answers, score, time_taken_seconds, certificate_eligible, test_type, user_id } = session;
  const totalQuestions = questions.length;
  const correctAnswers = Object.keys(answers).filter(k => answers[k] === questions[k].correct_answer).length;
  const unattemptedAnswers = totalQuestions - Object.keys(answers).length;
  const incorrectAnswers = totalQuestions - correctAnswers - unattemptedAnswers;

  // Topic Breakdown
  const topics: Record<string, { total: number, correct: number }> = {};
  questions.forEach((q: any, idx: number) => {
    const topic = q.topic || 'General';
    if (!topics[topic]) topics[topic] = { total: 0, correct: 0 };
    topics[topic].total++;
    if (answers[idx] === q.correct_answer) {
      topics[topic].correct++;
    }
  });

  const getScoreColor = () => {
    if (score >= 70) return 'stroke-emerald-500';
    if (score >= 50) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  const getScoreTextClass = () => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const filteredQuestions = questions.map((q: any, i: number) => ({ q, i })).filter(({ q, i }: { q: any, i: number }) => {
    const isCorrect = answers[i] === q.correct_answer;
    const isSkipped = answers[i] === undefined;
    if (filter === 'Correct') return isCorrect;
    if (filter === 'Incorrect') return !isCorrect && !isSkipped;
    if (filter === 'Skipped') return isSkipped;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-foreground pb-20 font-sans">
      <Header />

      <main className="container max-w-5xl mx-auto px-4 pt-32 space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Score Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800 p-8 flex flex-col md:flex-row items-center gap-10">
              <div className="relative shrink-0">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="72" className="stroke-zinc-800" strokeWidth="12" fill="none" />
                  <circle 
                    cx="80" cy="80" r="72" 
                    className={cn(getScoreColor(), "transition-all duration-1000 ease-out")} 
                    strokeWidth="12" fill="none" 
                    strokeDasharray={`${(score / 100) * 452} 452`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className={cn("text-4xl font-bold", getScoreTextClass())}>{score}%</span>
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left w-full">
                <h1 className="text-3xl font-bold text-white mb-2">{test_type} Results</h1>
                <p className="text-zinc-400 mb-8">Performance breakdown and analysis.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                    <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                    <div className="text-lg font-bold text-white">{formatTime(time_taken_seconds)}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">Time</div>
                  </div>
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                    <div className="text-lg font-bold text-emerald-400">{correctAnswers}</div>
                    <div className="text-xs text-emerald-500 uppercase tracking-wider">Correct</div>
                  </div>
                  <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center">
                    <XCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                    <div className="text-lg font-bold text-red-400">{incorrectAnswers}</div>
                    <div className="text-xs text-red-500 uppercase tracking-wider">Incorrect</div>
                  </div>
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                    <Target className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                    <div className="text-lg font-bold text-white">{unattemptedAnswers}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">Skipped</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Topic Breakdown Table */}
            <Card className="bg-zinc-900/50 border-zinc-800 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-indigo-400" />
                Topic-wise Performance
              </h2>
              <div className="space-y-4">
                {Object.entries(topics).map(([topic, stats]) => {
                  const percent = Math.round((stats.correct / stats.total) * 100);
                  let barColor = "bg-red-500";
                  if (percent >= 70) barColor = "bg-emerald-500";
                  else if (percent >= 50) barColor = "bg-amber-500";

                  return (
                    <div key={topic} className="flex flex-col gap-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-medium text-zinc-200">{topic}</span>
                        <span className="text-sm text-zinc-400">{stats.correct}/{stats.total} ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-1000", barColor)} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Certificate Card */}
          <div className="lg:col-span-1">
            {certificate_eligible ? (
              <Card className="bg-gradient-to-br from-emerald-950 to-emerald-900 border-emerald-500/50 p-8 text-center relative overflow-hidden h-full flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
                <Award className="w-20 h-20 text-emerald-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                <h3 className="text-2xl font-bold text-white mb-3">Congratulations!</h3>
                <p className="text-emerald-200/80 mb-8">
                  You earned a certificate for scoring {score}% on the {test_type}.
                </p>
                <div className="space-y-3 mt-auto">
                  <Button 
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                    onClick={() => navigate(`/certificate/${user_id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" /> View Certificate
                  </Button>
                  <Button variant="outline" className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-900">
                    <Share2 className="w-4 h-4 mr-2" /> Share on LinkedIn
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="bg-gradient-to-br from-amber-950/50 to-amber-900/20 border-amber-500/30 p-8 text-center h-full flex flex-col justify-center">
                <Award className="w-16 h-16 text-amber-500/50 mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-3">Keep Practicing</h3>
                <p className="text-amber-200/60 mb-8">
                  Score 70% or above to earn a certificate. You scored {score}% - you need {70 - score}% more.
                </p>
                <Button 
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold mt-auto"
                  onClick={() => navigate('/practice-tests')}
                >
                  <RefreshCcw className="w-4 h-4 mr-2" /> Retake Test
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* Question Review Section */}
        <div className="space-y-6 pt-8 border-t border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white">Question Review</h2>
            
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
              {['All', 'Correct', 'Incorrect', 'Skipped'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                    filter === f 
                      ? "bg-zinc-800 text-white" 
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {filteredQuestions.map(({ q, i }) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correct_answer;
              const isUnanswered = userAnswer === undefined;

              return (
                <Card key={i} className={cn(
                  "border p-6 md:p-8 transition-colors",
                  isCorrect ? "bg-emerald-950/10 border-emerald-900/30" : 
                  isUnanswered ? "bg-zinc-900/20 border-zinc-800" : 
                  "bg-red-950/10 border-red-900/30"
                )}>
                  <div className="flex items-start gap-4 mb-8">
                    <div className="mt-1 shrink-0">
                      {isCorrect ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : isUnanswered ? (
                        <div className="w-8 h-8 rounded-full border border-zinc-600 flex items-center justify-center text-zinc-500 font-bold">-</div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                          <XCircle className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-300">Q {i + 1}</span>
                        <span className="text-sm text-zinc-500">{q.topic}</span>
                      </div>
                      <p className="text-lg text-zinc-100 leading-relaxed">{q.question}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8 ml-0 md:ml-12">
                    {q.options.map((opt: string, optIdx: number) => {
                      const isSelected = userAnswer === optIdx;
                      const isActualCorrect = q.correct_answer === optIdx;

                      return (
                        <div key={optIdx} className={cn(
                          "px-4 py-3 rounded-xl border text-base flex items-center gap-4 transition-colors",
                          isActualCorrect && "bg-emerald-500/10 border-emerald-500/50 text-emerald-100",
                          isSelected && !isActualCorrect && "bg-red-500/10 border-red-500/50 text-red-100",
                          !isSelected && !isActualCorrect && "bg-zinc-950/50 border-zinc-800 text-zinc-400"
                        )}>
                          <div className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-xs font-bold border",
                            isActualCorrect && "bg-emerald-500 text-black border-emerald-500",
                            isSelected && !isActualCorrect && "bg-red-500 text-black border-red-500",
                            !isSelected && !isActualCorrect && "bg-zinc-900 border-zinc-700 text-zinc-500"
                          )}>
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span className="flex-1">{opt}</span>
                          
                          {/* Show badge for selected vs correct to be extremely clear */}
                          {isActualCorrect && <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider ml-auto">Correct Answer</span>}
                          {isSelected && !isActualCorrect && <span className="text-xs font-bold text-red-400 uppercase tracking-wider ml-auto">Your Answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="ml-0 md:ml-12 bg-[#0A0A0A] rounded-xl border border-zinc-800 p-5">
                    <h5 className="text-sm font-bold text-indigo-400 mb-2 uppercase tracking-wider">
                      Explanation
                    </h5>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      {q.explanation}
                    </p>
                  </div>
                </Card>
              );
            })}
            
            {filteredQuestions.length === 0 && (
              <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                No questions found for the "{filter}" filter.
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
