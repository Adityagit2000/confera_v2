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
  Loader2, 
  UploadCloud, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Mic, 
  Play, 
  Search,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/UpgradeModal';
import { LearningPath } from '@/components/LearningPath';

// Setup pdf.js worker from local node_modules via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface AtsAnalysis {
  ats_score: number;
  strengths: string[];
  weaknesses: string[];
  skills_found: string[];
  missing_skills: string[];
  dos: string[];
  donts: string[];
  suggestions: string[];
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
      const numPages = Math.min(pdf.numPages, 5); // Limit to first 5 pages to save tokens
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Ensure items have the expected structure before accessing str
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
          
        fullText += pageText + '\n\n';
      }
      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Could not read the PDF file. Please ensure it is not corrupted or protected.');
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
      toast({ title: "Extracting text...", description: "Reading your resume." });
      
      const text = await extractTextFromPDF(file);
      
      if (text.trim().length < 50) {
        throw new Error('Could not extract enough text from this PDF. Please try a different format.');
      }

      toast({ title: "Analyzing...", description: "AI is evaluating your resume for ATS compatibility." });

      const { data, error } = await supabase.functions.invoke('ats-analyzer', {
        body: { resumeText: text, userId: user.id, jobRole }
      });

      if (error) {
        console.error('ATS Analyzer Error:', error);
        throw new Error(error.message || 'Failed to analyze resume with AI.');
      }

      const result = data as AtsAnalysis;
      setAnalysis(result);

      // Save to Supabase
      const { data: dbData, error: dbError } = await (supabase as any)
        .from('resume_analysis')
        .insert({
          user_id: user.id,
          resume_url: file.name,
          ats_score: result.ats_score,
          analysis: result
        })
        .select('id')
        .single();
        
      if (dbError) {
        console.error('Failed to save analysis to DB:', dbError);
      } else if (dbData) {
        setAnalysisId(dbData.id);
      }
      
      toast({
        title: "Analysis Complete",
        description: `Your resume scored ${result.ats_score}/100.`,
      });

      refetchSubscription();

    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl min-h-screen relative">
      <BackButton />
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-secondary animate-in fade-in slide-in-from-left duration-700">
          ATS Resume Optimizer
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto md:mx-0">
          Upload your resume and get an instant AI-powered compatibility score, key improvements, and role-specific "Dos and Don'ts".
        </p>
      </header>

      {!analysis ? (
        <Card className="border-none shadow-2xl glass-card overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-xl flex items-center gap-2">
              <UploadCloud className="text-primary w-5 h-5" /> Resume Details
            </CardTitle>
            <CardDescription>Select your target role and upload your PDF resume.</CardDescription>
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
                    onClick={() => {
                      setJobRole(role);
                      localStorage.setItem('last_target_role', role);
                    }}
                  >
                    {role}
                  </Button>
                ))}
              </div>
              <div className="pt-2">
                <input
                  type="text"
                  placeholder="Or type a specific role (e.g. Frontend Engineer)"
                  className="w-full bg-background/50 border border-input px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={jobRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJobRole(val);
                    localStorage.setItem('last_target_role', val);
                  }}
                />
              </div>
            </div>

            <div 
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
                file ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="application/pdf" 
              />
              
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  file ? 'bg-primary text-white shadow-glow' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                }`}>
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
          <CardFooter className="flex justify-end p-8 bg-muted/50 border-t border-border/50 gap-4">
            {file && (
              <Button variant="ghost" onClick={() => setFile(null)}>Cancel</Button>
            )}
            <Button 
              onClick={handleAnalyze} 
              disabled={!file || loading || !jobRole}
              size="lg"
              className="w-full sm:w-auto min-w-[200px] h-14 text-lg font-bold shadow-glow"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
              ) : (
                <><Zap className="mr-2 h-5 w-5" /> Analyze Resume</>
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="md:col-span-1 border-none shadow-2xl glass-card overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/30 transition-all" />
              <CardHeader className="text-center pb-4 pt-10">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">System Score</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center flex-col items-center pb-12">
                <div className="relative">
                  <div className="text-8xl font-black bg-clip-text text-transparent bg-gradient-to-br from-primary via-primary/80 to-secondary [text-shadow:_0_10px_30px_rgba(var(--primary),0.3)]">
                    {analysis.ats_score}
                  </div>
                  <div className="absolute -bottom-2 -right-4 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">HIGH-RES</div>
                </div>
                <p className="text-muted-foreground mt-4 font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" /> Quality Verified
                </p>
                <div className="mt-8 w-full max-w-[200px] h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1500 ease-out" 
                    style={{ width: `${analysis.ats_score}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
               <Card className="border-l-8 border-l-success shadow-lg hover:translate-y-[-4px] transition-transform">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" /> Strengths Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.strengths?.map((item, idx) => (
                      <li key={idx} className="text-sm font-medium text-foreground/90 border-b border-muted/30 pb-1">{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-l-8 border-l-warning shadow-lg hover:translate-y-[-4px] transition-transform">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-5 w-5" /> Gaps Identified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.weaknesses?.map((item, idx) => (
                      <li key={idx} className="text-sm font-medium text-foreground/90 border-b border-muted/30 pb-1">{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2 bg-muted/20 border-border/50">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText size={16} /> Technical Stack & Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pb-6">
                  {analysis.skills_found?.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-xl bg-background border border-border/50 text-xs font-bold text-foreground hover:border-primary/50 cursor-default transition-colors">
                      {skill}
                    </span>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-4">
            <Card className="border-none shadow-2xl bg-gradient-to-br from-card to-success/5 border-l-[12px] border-l-success">
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-black flex items-center gap-3 text-success">
                  <CheckCircle className="h-8 w-8" /> Actionable Dos
                </CardTitle>
                <CardDescription className="text-base mt-2">Personalized recommendations for {jobRole}</CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <ul className="space-y-4">
                  {analysis.dos?.map((item, idx) => (
                    <li key={idx} className="flex gap-4 p-4 bg-background/80 rounded-2xl border border-success/10 hover:border-success/30 transition-all shadow-sm">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-success text-white flex items-center justify-center font-black text-sm shadow-lg">
                        {idx + 1}
                      </div>
                      <span className="font-bold text-foreground/90 leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-none shadow-2xl bg-gradient-to-br from-card to-destructive/5 border-l-[12px] border-l-destructive">
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-black flex items-center gap-3 text-destructive">
                  <AlertTriangle className="h-8 w-8" /> Strict Don'ts
                </CardTitle>
                <CardDescription className="text-base mt-2">Critical issues and common pitfalls to avoid</CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <ul className="space-y-4">
                  {analysis.donts?.map((item, idx) => (
                    <li key={idx} className="flex gap-4 p-4 bg-background/80 rounded-2xl border border-destructive/10 hover:border-destructive/30 transition-all shadow-sm">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-destructive text-white flex items-center justify-center font-black text-sm shadow-lg">
                        !
                      </div>
                      <span className="font-bold text-foreground/90 leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {analysisId && (
            <div className="pt-4">
              <LearningPath sourceId={analysisId} sourceType="resume_analysis" />
            </div>
          )}

          <Card className="bg-primary shadow-[0_20px_60px_-15px_rgba(var(--primary),0.5)] border-none text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -mr-40 -mt-40 group-hover:bg-white/20 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-black/10 rounded-full blur-[80px] -ml-30 -mb-30" />
            
            <CardHeader className="p-10 relative z-10">
              <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/30 animate-pulse-slow">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl md:text-4xl font-black uppercase tracking-tighter">Ready for the real world?</CardTitle>
                  <CardDescription className="text-white/80 text-lg mt-3 font-medium max-w-xl">
                    Your resume has high potential for the <span className="bg-white/20 px-2 py-0.5 rounded text-white font-black underline decoration-2">{jobRole}</span> role. Let's see how you handle the live interview!
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardFooter className="flex flex-col sm:flex-row justify-between p-10 mt-2 bg-black/10 relative z-10 gap-6">
               <Button 
                variant="ghost" 
                className="text-white hover:bg-white/10 h-14 px-8 text-lg font-bold order-2 sm:order-1" 
                onClick={() => { setAnalysis(null); setFile(null) }}
               >
                 Re-upload Resume
               </Button>
               <Button 
                variant="secondary"
                size="lg"
                className="h-16 px-12 text-xl font-black shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all order-1 sm:order-2 bg-white text-primary group"
                onClick={() => navigate('/mock-interview', { state: { jobRole } })}
               >
                 Start Live Session <Play className="w-5 h-5 ml-4 fill-primary group-hover:translate-x-1 transition-transform" />
               </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      
      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        description="You've used your free resume analysis this month. Upgrade to Pro for unlimited analysis."
      />
    </div>
  );
};

export default AtsAnalyzer;
