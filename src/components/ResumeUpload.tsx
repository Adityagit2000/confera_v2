import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, TrendingUp, AlertCircle } from 'lucide-react';

interface ResumeUploadProps {
  onAnalysisComplete?: (data: any) => void;
}

const ResumeUpload = ({ onAnalysisComplete }: ResumeUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Create resume record first
      const { data: resume, error: resumeError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_url: `mock_${file.name}_${Date.now()}`, // Mock URL
        })
        .select()
        .single();

      if (resumeError) throw resumeError;

      setResumeData(resume);
      toast({
        title: "Upload Successful",
        description: "Resume uploaded successfully. Ready for analysis!",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed", 
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const analyzeResume = async () => {
    if (!resumeData?.id) return;

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-resume', {
        body: {
          resumeId: resumeData.id,
          targetRole
        }
      });

      if (error) throw error;

      toast({
        title: "Analysis Complete",
        description: `ATS Score: ${data.ats_score}%`,
      });

      onAnalysisComplete?.(data);
      
      // Refresh resume data
      const { data: updatedResume } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeData.id)
        .single();
      
      if (updatedResume) {
        setResumeData(updatedResume);
      }
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

  const resetUpload = () => {
    setResumeData(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Resume Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!resumeData ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Upload Your Resume</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  PDF, DOC, or DOCX files up to 10MB
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="resume-upload"
                />
                <Button 
                  variant="outline" 
                  disabled={uploading}
                  onClick={() => document.getElementById('resume-upload')?.click()}
                >
                  {uploading ? 'Uploading...' : 'Choose File'}
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role-select">Target Role</Label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger>
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div>
                    <h4 className="font-medium">Resume Uploaded</h4>
                    <p className="text-sm text-muted-foreground">
                      Ready for analysis as {targetRole}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetUpload}>
                  Upload New
                </Button>
              </div>

              {!resumeData.ats_score ? (
                <Button 
                  onClick={analyzeResume} 
                  disabled={analyzing}
                  className="w-full"
                  variant="hero"
                >
                  {analyzing ? 'Analyzing Resume...' : 'Analyze Resume'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <TrendingUp className="w-8 h-8 text-primary" />
                          <div>
                            <h4 className="font-semibold text-lg">{resumeData.ats_score}%</h4>
                            <p className="text-sm text-muted-foreground">ATS Score</p>
                          </div>
                        </div>
                        <Progress value={resumeData.ats_score} className="mt-3" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <AlertCircle className="w-8 h-8 text-warning" />
                          <div>
                            <h4 className="font-semibold text-lg">
                              {resumeData.keywords_missing?.length || 0}
                            </h4>
                            <p className="text-sm text-muted-foreground">Missing Keywords</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {resumeData.keywords_missing?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Missing Keywords</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {resumeData.keywords_missing.slice(0, 8).map((item: any, index: number) => (
                            <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                              <span>{item.keyword}</span>
                              <span className="text-warning font-medium">High</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <Button 
                    onClick={analyzeResume} 
                    disabled={analyzing}
                    variant="outline"
                    className="w-full"
                  >
                    Re-analyze Resume
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumeUpload;