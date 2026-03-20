import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  Briefcase, 
  Search, 
  ChevronRight,
  GraduationCap,
  Sparkles,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JOB_ROLES } from '@/constants/jobRoles';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InterviewSelectionModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [interviewType, setInterviewType] = useState('Technical & Core Skills');
  const [searchTerm, setSearchTerm] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRoles = JOB_ROLES.filter(role =>
    role.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10); // Limit to top 10 for better UI

  const handleSelectRole = (role: string) => {
    setJobRole(role);
    setSearchTerm(role);
    setIsDropdownOpen(false);
  };

  const startInterview = async () => {
    if (!user) return;
    
    // Validate role
    const exactMatch = JOB_ROLES.find(r => r.toLowerCase() === searchTerm.trim().toLowerCase());
    const finalRole = exactMatch || jobRole || searchTerm.trim();
    
    // Strict validation check
    if (!finalRole || !interviewType) {
      toast({
        title: "Selection Required",
        description: "Please select both a Job Role and Interview Type",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        user_id: user.id,
        interview_type: interviewType,
        job_role: finalRole
      };

      console.log("Submitting payload:", payload);
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert(payload)
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { error: startError } = await supabase.functions.invoke('start-interview', {
        body: { sessionId: sessionData.id, job_role: finalRole }
      });

      if (startError) throw startError;

      toast({ title: "Interview Started", description: "Your mock interview session is ready!" });
      onOpenChange(false);
      window.location.href = `/interview/${sessionData.id}`;
    } catch (error: any) {
      console.error('Error starting interview:', error);
      toast({ title: "Error", description: error.message || "Failed to start interview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border/50 p-0 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-mesh-gradient opacity-5 pointer-events-none" />
        
        <div className="bg-gradient-to-r from-background to-card px-8 py-6 border-b border-border/50 relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary inline-block">
              Custom Interview Setup
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Configure your session details below. Our AI handles the rest.
          </DialogDescription>
        </div>

        <div className="p-8 relative z-10">
          <div className="space-y-8">
            {/* Job Role Section */}
            <div className="space-y-3 relative" ref={dropdownRef}>
              <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                <Target className="w-4 h-4" /> Target Job Role
              </Label>
              <div className="relative">
                <div className={`flex items-center bg-background/50 border ${isDropdownOpen ? 'border-primary ring-2 ring-primary/10' : 'border-border/50'} rounded-xl px-4 h-14 transition-all duration-200 shadow-sm`}>
                  <Briefcase className="w-5 h-5 text-muted-foreground mr-3" />
                  <input
                    type="text"
                    placeholder="e.g. Senior Frontend Engineer"
                    className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground/50 h-full"
                    value={searchTerm}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                  />
                  <Search className="w-5 h-5 text-muted-foreground/50 ml-2" />
                </div>

                <AnimatePresence>
                  {isDropdownOpen && filteredRoles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 w-full mt-2 bg-card border border-border/50 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar backdrop-blur-xl"
                    >
                      {filteredRoles.map((role) => (
                        <div
                          key={role}
                          className="px-4 py-3 hover:bg-primary/10 cursor-pointer text-sm text-foreground transition-colors flex items-center gap-3 border-b border-border/10 last:border-0"
                          onClick={() => handleSelectRole(role)}
                        >
                          <Target className="w-3 h-3 text-primary/50" />
                          {role}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="text-xs text-muted-foreground ml-1">Choose from 200+ standardized roles for precise AI persona matching.</p>
            </div>

            {/* Interview Type Section */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                <GraduationCap className="w-4 h-4" /> Interview Focus Type
              </Label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger className="h-14 border-border/50 bg-background/50 rounded-xl hover:border-primary/50 transition-all text-base">
                  <SelectValue placeholder="Select interview type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50 rounded-xl shadow-2xl">
                  <SelectItem value="Technical & Core Skills" className="py-3 focus:bg-primary/10 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-bold">Technical & Core Skills</span>
                      <span className="text-[10px] text-muted-foreground">Hard skills, language depth, and problem-solving</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Behavioral & HR Fit" className="py-3 focus:bg-primary/10 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-bold">Behavioral & HR Fit</span>
                      <span className="text-[10px] text-muted-foreground">Leadership, teamwork, and cultural alignment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="Scenario / Case Study" className="py-3 focus:bg-primary/10 cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-bold">Scenario / Case Study</span>
                      <span className="text-[10px] text-muted-foreground">Strategic thinking, case analysis, and architecture</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 pb-2">
              <Button 
                onClick={startInterview} 
                disabled={loading} 
                variant="premium" 
                size="lg" 
                className="w-full h-16 text-lg font-bold shadow-glow hover:scale-[1.01] transition-all rounded-xl relative overflow-hidden group"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Preparing Session...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Begin Mock Interview
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
