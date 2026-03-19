import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  UploadCloud, 
  Search, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Mic, 
  Play, 
  Zap,
  Calendar,
  BriefcaseIcon,
  GraduationCap,
  UserIcon,
  Cpu,
  XCircle,
  KeyIcon,
  FileText,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/UpgradeModal';
import { LearningPath } from '@/components/LearningPath';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// Setup pdf.js worker from local node_modules via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface AtsAnalysis {
  ats_score: number;
  parsed_data: {
    contact: { name: string; email: string; phone: string };
    skills: string[];
    experience: { title: string; company: string; duration: string; description: string }[];
    education: { degree: string; school: string; year: string }[];
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  keywords_missing: { keyword: string; importance: number }[];
  dos: string[];
  donts: string[];
  improvement_roadmap: { step: string; impact: string; priority: string }[];
  created_at?: string;
}

const AtsAnalyzer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AtsAnalysis | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [jobRole, setJobRole] = useState(() => {
    return localStorage.getItem('last_target_role') || 'Software Engineer';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isPro, canAnalyzeResume, refetch: refetchSubscription } = useSubscription();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file.",
          variant: "destructive"
        });
        return;
      }
      setFile(selectedFile);
      setAnalysis(null);
    }
  };

  const extractTextFromPDF = async (pdfFile: File): Promise<string> => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const numPages = Math.min(pdf.numPages, 5); 
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        fullText += pageText + '\n\n';
      }
      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Could not read the PDF file.');
    }
  };

  const handleAnalyze = async () => {
    if (!file || !user) return;
    if (!canAnalyzeResume) {
      setShowUpgradeModal(true);
      return;
    }
    
    setLoading(true);
    try {
      toast({ title: "Analyzing...", description: "AI is evaluating your resume for ATS compatibility." });
      
      const text = await extractTextFromPDF(file);
      const { data, error } = await supabase.functions.invoke('ats-analyzer', {
        body: { resumeText: text, userId: user.id, jobRole }
      });

      if (error) throw new Error(error.message || 'Failed to analyze resume.');

      const result = data as AtsAnalysis;
      setAnalysis({ ...result, created_at: new Date().toISOString() });
      setAnalysisId(user.id); // Use userId as source_id for resume-based learning paths
      
      toast({
        title: "Analysis Complete",
        description: `Your resume scored ${result.ats_score}/100.`,
      });
      refetchSubscription();
    } catch (error: any) {
      toast({ title: "Analysis failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getScoreLabel = (score: number) => {
    if (score > 75) return { text: 'Excellent', color: 'text-success' };
    if (score > 50) return { text: 'Good', color: 'text-yellow-500' };
    return { text: 'Needs Work', color: 'text-destructive' };
  };

  const getImportanceBadge = (importance: number) => {
    if (importance >= 8) return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Critical</Badge>;
    if (importance >= 5) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">High</Badge>;
    return <Badge className="bg-muted text-muted-foreground border-border">Medium</Badge>;
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl min-h-screen relative dark">
      <Button
        variant="link"
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-[#64748b] hover:text-white group p-0 h-auto font-medium transition-all duration-200 mb-8"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>Back to Dashboard</span>
      </Button>
      
      {!analysis ? (
        <div className="max-w-4xl mx-auto">
          <header className="mb-10 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-secondary animate-in fade-in slide-in-from-left duration-700">
              ATS Resume Optimizer
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto md:mx-0">
              Upload your resume and get a professional data-driven analysis.
            </p>
          </header>

          <Card className="border-none shadow-2xl glass-card overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-xl flex items-center gap-2">
                <UploadCloud className="text-primary w-5 h-5" /> Resume Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 px-8">
              <div className="space-y-4">
                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Search size={16} /> Target Job Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Software Engineer', 'Product Manager', 'Data Scientist', 'Designer'].map((role) => (
                    <Button
                      key={role}
                      variant={jobRole === role ? 'default' : 'outline'}
                      size="sm"
                      className={`h-10 transition-all ${jobRole === role ? 'shadow-glow' : ''}`}
                      onClick={() => setJobRole(role)}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or type a specific role..."
                  className="w-full bg-background/50 border border-input px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                />
              </div>

              <div 
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
                  file ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" />
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${file ? 'bg-primary text-white shadow-glow' : 'bg-primary/10 text-primary group-hover:bg-primary/20'}`}>
                    <UploadCloud size={32} />
                  </div>
                  {file ? (
                    <div className="space-y-1">
                      <div className="text-lg font-bold text-foreground">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-lg font-bold text-foreground block">Drop your resume here</span>
                      <span className="text-sm text-muted-foreground">PDF only (Max 5MB)</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end p-8 bg-muted/50 border-t border-border/50">
              <Button onClick={handleAnalyze} disabled={!file || loading || !jobRole} variant="premium" size="lg" className="w-full sm:w-auto min-w-[200px] shadow-premium">
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</> : <><Zap className="mr-2 h-5 w-5" /> Analyze Resume</>}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700 pb-20">
          {/* Section 1: Score Overview */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-4 flex flex-col items-center">
              <div className="relative w-64 h-64 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="128" cy="128" r="110" className="stroke-muted fill-none" strokeWidth="12" />
                  <motion.circle 
                    cx="128" cy="128" r="110" 
                    className={`fill-none ${analysis.ats_score > 75 ? 'stroke-success' : analysis.ats_score > 50 ? 'stroke-yellow-500' : 'stroke-destructive'}`}
                    strokeWidth="12" 
                    strokeDasharray="691" 
                    initial={{ strokeDashoffset: 691 }}
                    animate={{ strokeDashoffset: 691 - (691 * analysis.ats_score) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-7xl font-black text-foreground">{analysis.ats_score}</span>
                  <span className={`text-xl font-bold uppercase tracking-widest ${getScoreLabel(analysis.ats_score).color}`}>
                    {getScoreLabel(analysis.ats_score).text}
                  </span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div>
                <h2 className="text-3xl font-bold">Analyzed for <span className="text-primary">{jobRole}</span></h2>
                <p className="text-muted-foreground flex items-center gap-2 mt-2">
                  <Calendar size={16} /> Last analyzed: {new Date(analysis.created_at!).toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Skills Found', val: analysis.parsed_data.skills.length, icon: <CheckCircle className="text-success" /> },
                  { label: 'Missing Keywords', val: analysis.keywords_missing.length, icon: <AlertTriangle className="text-destructive" /> },
                  { 
                    label: 'Exp. Years', 
                    val: analysis.parsed_data.experience.reduce((acc, exp) => {
                      const years = exp.duration.match(/(\d+)\s*(?:yrs|years?)/i)?.[1];
                      return acc + (years ? parseInt(years) : 0);
                    }, 0) || 'N/A', 
                    icon: <BriefcaseIcon className="text-primary" /> 
                  },
                  { label: 'Education', val: analysis.parsed_data.education.length, icon: <GraduationCap className="text-secondary" /> }
                ].map((stat, i) => (
                  <div key={i} className="bg-card border border-border/50 rounded-xl p-4 shadow-sm group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      {stat.icon}
                      <span className="text-xl font-bold">{stat.val}</span>
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2: Resume Summary */}
          <section className="glass-card rounded-3xl p-8 border border-border/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <UserIcon className="text-primary" /> Candidate Summary
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase opacity-70">Full Name</label>
                  <div className="text-lg font-bold">{analysis.parsed_data.contact.name || 'Not found'}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase opacity-70">Email & Phone</label>
                  <div className="text-sm font-medium">{analysis.parsed_data.contact.email || 'N/A'} • {analysis.parsed_data.contact.phone || 'N/A'}</div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase opacity-70">Current Target Role</label>
                  <div className="text-lg font-bold">{jobRole}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Skills Analysis */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Cpu className="text-primary" /> Skills Analysis
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-success/5 border-success/20">
                <CardHeader><CardTitle className="text-lg text-success flex items-center gap-2"><CheckCircle size={18} /> Strong Skills Found</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {analysis.parsed_data.skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-bold border border-success/20">
                      {skill}
                    </span>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-destructive/5 border-destructive/20">
                <CardHeader><CardTitle className="text-lg text-destructive flex items-center gap-2"><XCircle size={18} /> Add these skills</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {analysis.keywords_missing.slice(0, 8).map((k, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20">
                      {k.keyword}
                    </span>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 4: Experience Timeline */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <BriefcaseIcon className="text-primary" /> Experience Timeline
            </h3>
            {analysis.parsed_data.experience.length > 0 ? (
              <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {analysis.parsed_data.experience.map((exp, i) => (
                  <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} key={i} className="relative">
                    <div className="absolute -left-8 top-1.5 w-6 h-6 rounded-full bg-primary border-4 border-background" />
                    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                      <CardHeader className="py-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-bold">{exp.title}</CardTitle>
                            <p className="text-primary font-semibold">{exp.company}</p>
                          </div>
                          <Badge variant="outline" className="bg-muted">{exp.duration}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{exp.description}</p></CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic px-4">No work experience found. Consider adding some to boost your score.</p>
            )}
          </section>

          {/* Section 5: Education */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="text-primary" /> Education
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {analysis.parsed_data.education.map((edu, i) => (
                <Card key={i} className="bg-muted/30 border-border/50">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base font-bold">{edu.degree}</CardTitle>
                    <p className="text-sm text-muted-foreground">{edu.school} • {edu.year}</p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          {/* Section 6: Missing Keywords */}
          <section className="space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <KeyIcon className="text-primary" /> Critical Missing Keywords
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {analysis.keywords_missing.sort((a,b) => b.importance - a.importance).map((k, i) => (
                <motion.div whileHover={{ y: -5 }} key={i}>
                   <Card className="h-full border-border/50 bg-card hover:shadow-xl transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center mb-2">
                        {getImportanceBadge(k.importance)}
                        <span className="text-xs font-bold text-muted-foreground">Score: {k.importance}/10</span>
                      </div>
                      <CardTitle className="text-xl font-black text-foreground">{k.keyword}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">Add this keyword to your skills or experience descriptions to immediately improve relevance.</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Section 7: Actionable Dos and Don'ts */}
          <div className="grid md:grid-cols-2 gap-8 mt-4">
            <section className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-success"><CheckCircle className="h-6 w-6" /> Actionable Dos</h3>
              <ul className="space-y-3">
                {analysis.dos.map((item, idx) => (
                  <li key={idx} className="flex gap-4 p-4 bg-success/5 rounded-2xl border border-success/10 hover:border-success/30 transition-all">
                    <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /> Strict Don'ts</h3>
              <ul className="space-y-3">
                {analysis.donts.map((item, idx) => (
                  <li key={idx} className="flex gap-4 p-4 bg-destructive/5 rounded-2xl border border-destructive/10 hover:border-destructive/30 transition-all">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="font-semibold text-sm leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Section 8: Improvement Roadmap */}
          <section className="space-y-6 pt-10">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h3 className="text-3xl font-black uppercase tracking-tighter">Your Improvement Roadmap</h3>
              <p className="text-muted-foreground">Follow these prioritized steps to maximize your ATS compatibility.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {analysis.improvement_roadmap.map((step, i) => (
                <div key={i} className="relative p-6 rounded-3xl bg-primary/10 border border-primary/20 overflow-hidden group">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
                  <div className="text-4xl font-black text-primary/30 mb-4">0{i+1}</div>
                  <h4 className="text-lg font-bold mb-2">{step.step}</h4>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-success font-bold">{step.impact}</span>
                    <Badge variant="secondary" className="bg-primary/20 text-primary-foreground">{step.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {analysisId && (
            <div className="pt-10">
              <LearningPath sourceId={analysisId} sourceType="resume_analysis" />
            </div>
          )}

          <Card className="bg-primary shadow-glow border-none text-white overflow-hidden relative group p-10 mt-10">
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10 text-center md:text-left">
              <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/30">
                <Mic className="w-12 h-12" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-3xl font-black uppercase">Ready for the real world?</CardTitle>
                <p className="text-white/80 mt-2 font-medium">Your resume is optimized. Let's practice the interview session now!</p>
              </div>
              <Button 
                variant="secondary" size="lg" 
                className="h-16 px-12 text-xl font-black shadow-2xl hover:scale-105 transition-all bg-white text-primary rounded-full"
                onClick={() => navigate('/mock-interview', { state: { jobRole } })}
              >
                Start Interview <Play className="w-5 h-5 ml-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </div>
  );
};

export default AtsAnalyzer;
