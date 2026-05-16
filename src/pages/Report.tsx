import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  MessageSquare, 
  Code,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
  Target,
  Zap,
  TrendingUp,
  Share2,
  Download,
  PlayCircle
} from 'lucide-react';
import { motion } from 'framer-motion';


const Report = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [reportData, setReportData] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [answerCoaching, setAnswerCoaching] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!sessionId || !user?.id || hasFetched) return;
    let cancelled = false;
    setHasFetched(true);

    fetchReportData();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id]);

  const fetchReportData = async () => {
    try {
      const { data: session, error: sessError } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessError) throw sessError;
      setSessionData(session);

      const { data: report, error: repError } = await supabase
        .from('feedback_reports')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (repError && repError.code !== 'PGRST116') {
         throw repError;
      }

      if (report) {
         setReportData(report);
      } else {
         const transcript = typeof session.transcript === 'string' ? JSON.parse(session.transcript) : session.transcript;
         if (transcript && transcript.length > 2) {
             await generateReport();
         }
      }

      // Fetch per-answer coaching data
      try {
        const { data: answers } = await supabase
          .from('interview_answers')
          .select('question, answer_text, tags')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (answers) {
          const coachingRows = answers
            .filter(a => a.tags && (a.tags as any).coaching)
            .map(a => ({
              question: a.question,
              answer: a.answer_text,
              ...(a.tags as any).coaching
            }));
          setAnswerCoaching(coachingRows);
        }
      } catch (coachErr) {
        console.warn('Failed to load per-answer coaching:', coachErr);
      }
    } catch (error: any) {
      console.error('Error loading report:', error);
      toast({ title: "Error", description: "Failed to load report", variant: "destructive" });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('generate-feedback', {
        body: { sessionId }
      });
      if (error) throw error;
      
      const { data: report } = await supabase
        .from('feedback_reports')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (report) setReportData(report);
    } catch (error: any) {
      toast({ title: "Error generating report", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20', stroke: 'stroke-success' };
    if (score >= 60) return { text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', stroke: 'stroke-yellow-500' };
    return { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', stroke: 'stroke-destructive' };
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link Copied", description: "Report link copied to clipboard." });
  };

  const handleDownload = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-6 shadow-glow" /> 
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          Analyzing Performance
        </h2>
        <p className="text-muted-foreground mt-2 animate-pulse">Generating your comprehensive feedback report...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center space-y-6 flex-col">
        <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">Report Not Ready</h2>
        <p className="text-muted-foreground max-w-md">The interview session was likely too short or no feedback could be generated from the transcript.</p>
        <Button variant="hero" onClick={() => navigate('/dashboard')} className="mt-4">Return to Dashboard</Button>
      </div>
    );
  }

  const recommendations = typeof reportData.recommendations === 'string' 
    ? JSON.parse(reportData.recommendations) 
    : (reportData.recommendations || {});

  const overallScoreColor = getScoreColor(reportData.overall_score || 0);

  const CircularScore = ({ score, label, icon: Icon }: { score: number, label: string, icon: any }) => {
    const colors = getScoreColor(score);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="flex flex-col items-center p-6 bg-card/50 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 ${colors.bg}`}></div>
        
        <div className="relative w-32 h-32 flex items-center justify-center mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="64" cy="64" r="40" className="stroke-muted fill-none" strokeWidth="6" />
            <motion.circle 
              cx="64" cy="64" r="40" 
              className={`fill-none ${colors.stroke} transition-all duration-1000 ease-out`}
              strokeWidth="6" 
              strokeDasharray={circumference} 
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${colors.text}`}>{score}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Score</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colors.text}`} />
          <h3 className="font-semibold text-foreground tracking-wide">{label}</h3>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden font-sans">
      <div className="absolute inset-0 bg-mesh-gradient opacity-20 pointer-events-none fixed"></div>
      
      <header className="bg-background/60 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40 p-4">
        <div className="container mx-auto flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="rounded-full hover:bg-muted/50">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <div>
              <h1 className="font-bold text-lg text-foreground capitalize flex items-center gap-2">
                {sessionData?.type?.replace('_', ' ')} Report
              </h1>
              <p className="text-xs text-muted-foreground font-medium">{new Date(reportData.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleShare} className="hidden sm:flex border-border/50 bg-card/50 hover:bg-muted/50">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="hidden sm:flex border-border/50 bg-card/50 hover:bg-muted/50">
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button variant="hero" size="sm" onClick={() => navigate('/mock-interview', { state: { jobRole: sessionData?.job_role } })}>
              <PlayCircle className="w-4 h-4 mr-2" /> Start Mock Interview
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-6xl relative z-10 space-y-12">
        
        {/* Hero Score Section */}
        <section className="relative">
          <div className={`absolute inset-0 ${overallScoreColor.bg} blur-3xl rounded-[3rem] opacity-30`}></div>
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-6 sm:p-10 md:p-16 flex flex-col items-center justify-center text-center relative">
              <div className="grid md:grid-cols-2 gap-12 items-center w-full">
                
                <div className="flex flex-col items-center md:items-start text-left order-2 md:order-1">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-semibold tracking-wide uppercase">Performance Analysis</span>
                  </div>
                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-foreground leading-tight">
                    Your Interview Results are In
                  </h2>
                  <p className="text-sm sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                    {reportData.summary}
                  </p>
                </div>

                <div className="flex items-center justify-center order-1 md:order-2">
                  <div className="relative w-48 h-48 sm:w-64 sm:h-64">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 256 256">
                      <circle cx="128" cy="128" r="110" className="stroke-muted/30 fill-none" strokeWidth="16" />
                      <motion.circle 
                        cx="128" cy="128" r="110" 
                        className={`fill-none ${overallScoreColor.stroke} transition-all duration-1500 ease-out`}
                        strokeWidth="16" 
                        strokeDasharray={2 * Math.PI * 110} 
                        initial={{ strokeDashoffset: 2 * Math.PI * 110 }}
                        animate={{ strokeDashoffset: (2 * Math.PI * 110) - ((reportData.overall_score || 0) / 100) * (2 * Math.PI * 110) }}
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0px 0px 12px rgba(var(--primary-rgb), 0.5))' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-5xl sm:text-7xl font-black ${overallScoreColor.text} tracking-tighter`}>{reportData.overall_score || 0}</span>
                      <span className="text-sm text-muted-foreground uppercase tracking-widest font-bold mt-2">Overall Score</span>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </section>
        
        {/* McKinsey Readiness Assessment */}
        {sessionData?.type === 'mckinsey_de' && recommendations.mckinsey_readiness && (
          <section className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            <Card className="bg-gradient-to-br from-orange-500/10 via-card to-card border border-orange-500/20 rounded-[2.5rem] shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
              <CardHeader className="p-8 md:p-10 pb-6 border-b border-border/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-2xl md:text-3xl flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner">
                      <Target className="text-orange-500 h-7 w-7" />
                    </div>
                    McKinsey Readiness Assessment
                  </CardTitle>
                  <div className="w-fit px-4 py-2 rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20">
                    QuantumBlack Standard
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 md:p-10">
                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Identified Gaps
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {recommendations.mckinsey_readiness.gaps?.map((gap: string, i: number) => (
                          <span key={i} className="px-4 py-2 rounded-xl bg-orange-500/5 border border-orange-500/10 text-foreground/90 text-sm font-medium">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Personalized Study Plan
                      </h4>
                      <p className="text-foreground/90 leading-relaxed text-sm bg-background/40 p-5 rounded-2xl border border-border/50 shadow-inner">
                        {recommendations.mckinsey_readiness.study_plan}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Recommended Study Path
                    </h4>
                    <div className="space-y-4">
                      {recommendations.mckinsey_readiness.resources?.map((resource: string, i: number) => (
                        <div key={i} className="flex gap-4 p-5 rounded-2xl bg-background/60 border border-border/50 hover:border-orange-500/30 transition-all group shadow-sm">
                          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                            <CheckCircle2 className="h-4 w-4 text-orange-500" />
                          </div>
                          <span className="text-foreground/90 text-sm font-medium group-hover:text-foreground transition-colors pt-1.5">{resource}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Breakdown Scores */}
        <section>
          <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Zap className="w-6 h-6 text-primary" /> Skill Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <CircularScore score={reportData.technical_score || 0} label="Technical Depth" icon={Code} />
            <CircularScore score={reportData.communication_score || 0} label="Communication" icon={MessageSquare} />
            <CircularScore score={reportData.behavior_score || 0} label="Behavioral" icon={Users} />
          </div>
        </section>

        {/* Per-Answer Coaching */}
        {answerCoaching.length > 0 && (
          <section>
            <h3 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
              <Target className="w-6 h-6 text-primary" /> Answer-by-Answer Coaching
            </h3>
            <div className="space-y-4">
              {answerCoaching.map((item, idx) => {
                const scoreColor = item.score >= 8 ? 'bg-success/20 text-success border-success/30' 
                  : item.score >= 5 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
                  : 'bg-destructive/20 text-destructive border-destructive/30';
                const depthColor = item.depth === 'strong' ? 'bg-success/10 text-success' 
                  : item.depth === 'adequate' ? 'bg-yellow-500/10 text-yellow-400' 
                  : 'bg-destructive/10 text-destructive';
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-card/50 border border-border/50 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Question {idx + 1}</p>
                        <p className="text-sm text-foreground/90 font-medium leading-relaxed line-clamp-2">{item.question}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`${scoreColor} border font-black text-sm px-3 py-1`}>
                          {item.score}/10
                        </Badge>
                        <Badge className={`${depthColor} font-semibold text-xs capitalize`}>
                          {item.depth}
                        </Badge>
                        {item.used_star_format && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs">
                            ★ STAR
                          </Badge>
                        )}
                      </div>
                    </div>

                    {item.answer && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 bg-background/40 p-3 rounded-xl border border-border/30">
                        {item.answer}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs">
                      {item.filler_word_count > 0 && (
                        <span className="text-yellow-400 font-medium">
                          ⚠ {item.filler_word_count} filler word{item.filler_word_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {item.missing_points && item.missing_points.length > 0 && (
                        <span className="text-muted-foreground">
                          Missing: {item.missing_points.join(', ')}
                        </span>
                      )}
                    </div>

                    {item.coaching_tip && (
                      <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex gap-2">
                        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground/80 font-medium">{item.coaching_tip}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}


        {/* Detailed Feedback */}
        <section className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card/50 border border-border/50 rounded-[2rem] shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-2xl -mr-16 -mt-16" />
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="text-success h-5 w-5" />
                </div>
                Key Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {recommendations.strengths?.map((str: string, i: number) => (
                  <motion.li 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="flex gap-4 p-4 rounded-xl bg-success/5 border border-success/10 hover:border-success/30 transition-colors"
                  >
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <span className="text-foreground/90 text-sm leading-relaxed">{str}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border border-border/50 rounded-[2rem] shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl -mr-16 -mt-16" />
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle className="text-yellow-500 h-5 w-5" />
                </div>
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {recommendations.improvements?.map((imp: string, i: number) => (
                  <motion.li 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="flex gap-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10 hover:border-yellow-500/30 transition-colors"
                  >
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                    <span className="text-foreground/90 text-sm leading-relaxed">{imp}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Action Plan */}
        <section>
          <Card className="bg-card/50 border border-border/50 rounded-[2rem] shadow-lg">
            <CardHeader className="pb-6 border-b border-border/50">
               <CardTitle className="text-2xl flex items-center gap-3">
                 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                   <TrendingUp className="text-primary h-6 w-6" />
                 </div>
                 Recommended Action Plan
               </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
               <ul className="space-y-6">
                 {recommendations.nextSteps?.map((step: string, i: number) => (
                   <li key={i} className="flex gap-5 items-start group">
                     <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex flex-col items-center justify-center font-black shrink-0 shadow-sm group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                       {i+1}
                     </div>
                     <div className="pt-2">
                       <p className="text-foreground/90 text-base leading-relaxed">{step}</p>
                     </div>
                   </li>
                 ))}
               </ul>
            </CardContent>
          </Card>
        </section>

      </main>
      
      {/* Spacer for print downlaods */}
      <div className="h-24"></div>
    </div>
  );
};

export default Report;