import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Briefcase, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JOB_ROLES } from '@/constants/jobRoles';

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
  
  const [searchTerm, setSearchTerm] = useState(jobRole);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getInterviewTypeForRole = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('product') || r.includes('manager') || r.includes('hr') || r.includes('behavioral')) return 'hr';
    if (r.includes('architect') || r.includes('system') || r.includes('lead')) return 'system_design';
    return 'dsa';
  };

  useEffect(() => {
    if (location.state?.jobRole) {
      setJobRole(location.state.jobRole);
      setSearchTerm(location.state.jobRole);
      setInterviewType(getInterviewTypeForRole(location.state.jobRole));
    } else if (!jobRole) {
      const persisted = localStorage.getItem('last_target_role');
      if (persisted) {
        setJobRole(persisted);
        setSearchTerm(persisted);
        setInterviewType(getInterviewTypeForRole(persisted));
      }
    } else {
      setInterviewType(getInterviewTypeForRole(jobRole));
    }
  }, [location.state]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRoles = JOB_ROLES.filter(role =>
    role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Ensure the final jobRole is updated if user typed something but didn't select
    // Check for exact case-insensitive match in JOB_ROLES
    const exactMatch = JOB_ROLES.find(r => r.toLowerCase() === searchTerm.trim().toLowerCase());
    const finalRole = exactMatch || jobRole || searchTerm.trim();

    setLoading(true);
    try {
      // Create session in DB
      const { data, error } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          type: interviewType,
          job_role: finalRole || (interviewType === 'dsa' ? 'Software Engineer' : interviewType === 'system_design' ? 'System Architect' : 'HR Professional'),
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

  const handleSelectRole = (role: string) => {
    setJobRole(role);
    setSearchTerm(role);
    setIsOpen(false);
    setInterviewType(getInterviewTypeForRole(role));
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
            <div className="space-y-2 relative" ref={dropdownRef}>
              <Label htmlFor="roleInput">Job Role</Label>
              <div className="relative">
                <input
                  id="roleInput"
                  type="text"
                  placeholder="e.g. Frontend Developer"
                  className="w-full bg-background border border-input px-3 py-2 rounded-md text-sm pr-10"
                  value={searchTerm}
                  onFocus={() => setIsOpen(true)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchTerm(value);
                    setIsOpen(true);
                  }}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>

              {isOpen && filteredRoles.length > 0 && (
                <div className="absolute z-50 w-full max-h-60 overflow-y-auto bg-gray-900 border border-gray-700 rounded-md shadow-lg mt-1">
                  {filteredRoles.map((role) => (
                    <div
                      key={role}
                      className="px-4 py-2 hover:bg-gray-800 cursor-pointer text-sm text-gray-200 transition-colors"
                      onClick={() => handleSelectRole(role)}
                    >
                      {role}
                    </div>
                  ))}
                </div>
              )}
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

