import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, TrendingUp, AlertCircle, Loader2, CheckCircle2, XCircle, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Setup pdf.js worker from local node_modules via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ResumeUploadProps {
  onAnalysisComplete?: (data: any) => void;
}

const ResumeUpload = ({ onAnalysisComplete }: ResumeUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [isDragging, setIsDragging] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `Maximum file size is 10MB. Your file is ${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB.`,
        variant: "destructive",
      });
      return;
    }
    
    setFile(selectedFile);
    setAnalysisResult(null);
    toast({
      title: "File Selected",
      description: `${selectedFile.name} ready for analysis.`,
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  }, []);

  const analyzeResume = async () => {
    if (!file || !user) return;

    setAnalyzing(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}_resume.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);
        
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      
      const { data: resumeRecord, error: resumeError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_url: filePath,
          original_filename: file.name,
          file_size: file.size,
          file_type: file.type
        })
        .select()
        .single();
        
      if (resumeError) throw new Error(`Database error: ${resumeError.message}`);
      
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('analyze-resume', {
        body: { 
          jobRole: targetRole,
          resumePath: filePath, // Explicitly pass the path
          resumeId: resumeRecord.id
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (error) {
        // Detect 403 paywall response from edge function
        let errorBody: any = null;
        try {
          if (error.context && typeof error.context.json === 'function') {
            errorBody = await error.context.json();
          }
        } catch (_) { /* context may not be parseable */ }

        if (errorBody?.error === 'Resume analysis limit reached' || error.message?.includes('limit reached')) {
          setShowUpgradePrompt(true);
          toast({
            title: "Free Limit Reached",
            description: "You've used all your free resume analyses. Upgrade to Pro for unlimited access.",
            variant: "destructive",
          });
          return;
        }

        throw new Error(errorBody?.error || errorBody?.details || error.message || 'Analysis failed');
      }

      setAnalysisResult(data);
      onAnalysisComplete?.(data);

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze resume",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success bg-success/10 border-success/20";
    if (score >= 60) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    return "text-destructive bg-destructive/10 border-destructive/20";
  };

  const getScoreStrokeUrl = (score: number) => {
    if (score >= 80) return "stroke-success";
    if (score >= 60) return "stroke-yellow-500";
    return "stroke-destructive";
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div 
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
                isDragging 
                  ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(0,212,255,0.2)] scale-[1.02]' 
                  : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 bg-card/50'
              }`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
              
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center relative shadow-glow">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              
              <h3 className="text-xl font-bold mb-2 text-foreground">
                {isDragging ? 'Drop your resume here' : 'Select or drop your resume'}
              </h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
                Upload your resume in PDF format to get instant AI-powered feedback and ATS compatibility scoring.
              </p>
              
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="resume-upload"
              />
              <Button 
                variant="hero" 
                size="lg"
                disabled={uploading}
                onClick={() => document.getElementById('resume-upload')?.click()}
                className="w-48 shadow-lg"
              >
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : 'Browse Files'}
              </Button>
            </div>
            
            <div className="space-y-3 px-2">
              <Label htmlFor="role-select" className="text-sm font-medium text-foreground">Target Role for Analysis</Label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger className="h-12 border-border/50 bg-card/50">
                  <SelectValue placeholder="Select target role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                  <SelectItem value="Data Scientist">Data Scientist</SelectItem>
                  <SelectItem value="Product Manager">Product Manager</SelectItem>
                  <SelectItem value="DevOps Engineer">DevOps Engineer</SelectItem>
                  <SelectItem value="Frontend Developer">Frontend Developer</SelectItem>
                  <SelectItem value="Backend Developer">Backend Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        ) : analyzing ? (
          <motion.div 
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 px-6 flex flex-col items-center justify-center space-y-8"
          >
            <div className="relative w-32 h-40 bg-card border border-border/50 rounded-lg overflow-hidden shadow-2xl">
              {/* Document Mockup */}
              <div className="absolute top-4 left-4 right-4 h-2 bg-muted rounded-full opacity-50"></div>
              <div className="absolute top-8 left-4 right-8 h-2 bg-muted rounded-full opacity-50"></div>
              <div className="absolute top-12 left-4 right-4 h-2 bg-muted rounded-full opacity-50"></div>
              <div className="absolute top-16 left-4 right-12 h-2 bg-muted rounded-full opacity-50"></div>
              
              {/* Scanning Laser */}
              <motion.div 
                className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_rgba(0,212,255,1)]"
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, ease: "linear", repeat: Infinity }}
              />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                Analyzing with Confera AI...
              </h3>
              <p className="text-muted-foreground animate-pulse">Extracting skills, parsing structure, calculating ATS score</p>
            </div>
          </motion.div>
        ) : analysisResult ? (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{file.name}</h4>
                  <p className="text-xs text-muted-foreground">Analyzed as {targetRole}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setAnalysisResult(null); }}>
                Analyze Another
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 border border-border/50 bg-card rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10" />
                <h4 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">ATS Score</h4>
                
                {/* Circular Progress Indicator */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" className="stroke-muted fill-none" strokeWidth="8" />
                    <motion.circle 
                      cx="64" cy="64" r="56" 
                      className={`fill-none ${getScoreStrokeUrl(analysisResult.ats_score)} transition-all duration-1000 ease-out`}
                      strokeWidth="8" 
                      strokeDasharray="351.85" 
                      initial={{ strokeDashoffset: 351.85 }}
                      animate={{ strokeDashoffset: 351.85 - (351.85 * analysisResult.ats_score) / 100 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-foreground">{analysisResult.ats_score}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-border/50 bg-card rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full blur-xl -mr-8 -mt-8" />
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <h4 className="font-semibold text-foreground">Matched Skills</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysisResult.matched_skills?.slice(0, 5).map((skill: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-xs font-medium bg-success/10 text-success border border-success/20">
                        {skill}
                      </span>
                    ))}
                    {(analysisResult.matched_skills?.length || 0) > 5 && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                        +{analysisResult.matched_skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="border border-border/50 bg-card rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full blur-xl -mr-8 -mt-8" />
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <h4 className="font-semibold text-foreground">Missing Skills</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {analysisResult.missing_skills?.slice(0, 5).map((skill: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                        {skill}
                      </span>
                    ))}
                    {(!analysisResult.missing_skills || analysisResult.missing_skills.length === 0) && (
                      <span className="text-sm text-muted-foreground">None identified!</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {analysisResult.suggestions?.length > 0 && (
              <div className="border border-border/50 bg-card rounded-2xl p-6 shadow-sm">
                <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" /> Key Recommendations
                </h4>
                <ul className="space-y-4">
                  {analysisResult.suggestions.map((item: string, index: number) => (
                    <li key={index} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold shrink-0 text-xs">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ) : showUpgradePrompt ? (
          <motion.div
            key="upgrade"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-5"
          >
            <div className="relative overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/10 rounded-2xl p-6 text-center shadow-lg">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none" />
              
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shadow-lg">
                <Crown className="w-8 h-8 text-amber-500" />
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-2">Free Analyses Used Up</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6 leading-relaxed">
                You've used all your free resume analyses. Upgrade to Pro for unlimited access.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => navigate('/pricing')}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-5 px-8 rounded-xl shadow-lg transition-all duration-300 hover:shadow-amber-500/25 hover:scale-[1.02]"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setFile(null); setShowUpgradePrompt(false); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Go Back
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between p-4 bg-muted/40 border border-border/50 rounded-xl">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center relative shadow-glow">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">{file.name}</h4>
                  <p className="text-sm text-muted-foreground">Target Role: {targetRole}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                Remove
              </Button>
            </div>

            <Button 
              onClick={analyzeResume} 
              disabled={analyzing}
              className="w-full bg-primary hover:bg-primary-glow text-primary-foreground font-semibold py-6 text-lg rounded-xl shadow-glow"
            >
              {analyzing ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                'Start AI Analysis'
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResumeUpload;