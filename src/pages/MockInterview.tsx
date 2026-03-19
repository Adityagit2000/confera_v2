import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MockInterview = () => {
  const [interviewType, setInterviewType] = useState('dsa');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [jobRole, setJobRole] = useState(() => {
    return location.state?.jobRole || localStorage.getItem('last_target_role') || '';
  });

  const getInterviewTypeForRole = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('product') || r.includes('manager') || r.includes('hr') || r.includes('behavioral')) return 'hr';
    if (r.includes('architect') || r.includes('system') || r.includes('lead')) return 'system_design';
    return 'dsa';
  };

  useEffect(() => {
    if (location.state?.jobRole) {
      setJobRole(location.state.jobRole);
      setInterviewType(getInterviewTypeForRole(location.state.jobRole));
    } else if (!jobRole) {
      const persisted = localStorage.getItem('last_target_role');
      if (persisted) {
        setJobRole(persisted);
        setInterviewType(getInterviewTypeForRole(persisted));
      }
    } else {
      setInterviewType(getInterviewTypeForRole(jobRole));
    }
  }, [location.state]);

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      // Create session in DB
      const { data, error } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          type: interviewType,
          job_role: jobRole || (interviewType === 'dsa' ? 'Software Engineer' : interviewType === 'system_design' ? 'System Architect' : 'HR Professional'),
          status: 'scheduled'
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Call start-interview edge function
      await supabase.functions.invoke('start-interview', {
        body: { sessionId: data.id }
      });
      
      navigate(`/interview/${data.id}`);
      
    } catch (error: any) {
      toast({
        title: "Failed to start",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-xl">
      <Card className="border-t-4 border-t-primary shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Start Mock Interview</CardTitle>
          <CardDescription>
            Select the type of interview you want to practice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStartInterview} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="roleInput">Job Role</Label>
              <input
                id="roleInput"
                type="text"
                placeholder="e.g. Frontend Developer"
                className="w-full bg-background border border-input px-3 py-2 rounded-md text-sm"
                value={jobRole}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[;()"'<>]/g, '').substring(0, 50);
                  setJobRole(sanitized);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeSelect">Interview Type</Label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger id="typeSelect">
                  <SelectValue placeholder="Select interview type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dsa">Data Structures & Algorithms</SelectItem>
                  <SelectItem value="system_design">System Design</SelectItem>
                  <SelectItem value="hr">Behavioral / HR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing Interview...</>
              ) : (
                'Start Interview Now'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MockInterview;
