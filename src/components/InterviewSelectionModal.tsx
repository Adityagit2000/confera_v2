import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { 
  Code, 
  Network, 
  Users, 
  BarChart, 
  Briefcase, 
  ClipboardList,
  Database,
  CircuitBoard
} from 'lucide-react';
import { motion } from 'framer-motion';

interface InterviewType {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  colorClass: string;
  bgClass: string;
  isSpecial?: boolean;
}

const interviewTypes: InterviewType[] = [
  {
    id: 'dsa',
    title: 'Data Structures & Algos',
    subtitle: 'Technical Foundation',
    description: 'Arrays, Linked Lists, Trees, Graphs, and Dynamic Programming.',
    icon: Code,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10 border-primary/20 hover:border-primary/50 group-hover:bg-primary/20',
  },
  {
    id: 'system_design',
    title: 'System Design',
    subtitle: 'Architecture & Scaling',
    description: 'High-level architecture, scalability, and distributed systems.',
    icon: Network,
    colorClass: 'text-secondary',
    bgClass: 'bg-secondary/10 border-secondary/20 hover:border-secondary/50 group-hover:bg-secondary/20',
  },
  {
    id: 'hr',
    title: 'HR & Behavioral',
    subtitle: 'Culture & Fit',
    description: 'Leadership, teamwork, past experiences, and scenario handling.',
    icon: Users,
    colorClass: 'text-accent',
    bgClass: 'bg-accent/10 border-accent/20 hover:border-accent/50 group-hover:bg-accent/20',
  },
  {
    id: 'daa',
    title: 'Decision Analytics',
    subtitle: 'ZS Associates',
    description: 'Analytics, case studies, pharma data interpretation and problem solving.',
    icon: BarChart,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50 group-hover:bg-blue-500/20',
  },
  {
    id: 'consulting',
    title: 'Consulting',
    subtitle: 'McKinsey / BCG / Bain',
    description: 'Case studies, market sizing, MECE frameworks and structured problem solving.',
    icon: Briefcase,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50 group-hover:bg-purple-500/20',
  },
  {
    id: 'business_analyst',
    title: 'Business Analyst',
    subtitle: 'Product & Tech',
    description: 'Requirements gathering, stakeholder management, process mapping and business cases.',
    icon: ClipboardList,
    colorClass: 'text-green-500',
    bgClass: 'bg-green-500/10 border-green-500/20 hover:border-green-500/50 group-hover:bg-green-500/20',
  },
  {
    id: 'mckinsey_de',
    title: 'McKinsey Data Engineer',
    subtitle: 'QuantumBlack AI',
    description: 'SQL, Python, PySpark, LLMs, Vector DB, Agentic AI and consulting mindset.',
    icon: Database,
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/50 group-hover:bg-orange-500/20',
    isSpecial: true
  }
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InterviewSelectionModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const startInterview = async (typeId: string) => {
    if (!user) return;
    try {
      setLoadingType(typeId);
      const { data: sessionData, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          type: typeId as any,
          status: 'scheduled'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { data: startData, error: startError } = await supabase.functions.invoke('start-interview', {
        body: { sessionId: sessionData.id }
      });

      if (startError) throw startError;

      toast({ title: "Interview Started", description: "Your mock interview session is ready!" });
      onOpenChange(false);
      window.location.href = `/interview/${sessionData.id}`;
    } catch (error: any) {
      console.error('Error starting interview:', error);
      toast({ title: "Error", description: error.message || "Failed to start interview", variant: "destructive" });
    } finally {
      if (loadingType) setLoadingType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card border-border/50 p-0 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-mesh-gradient opacity-10 pointer-events-none" />
        
        <div className="bg-gradient-to-r from-background to-card px-8 py-6 border-b border-border/50 relative z-10">
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary inline-block">
            Select Mock Interview
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Choose a role-specific interview simulation. Our AI will dynamically adapt to the persona and ask highly relevant questions.
          </DialogDescription>
        </div>

        <div className="p-8 relative z-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {interviewTypes.map((type, idx) => {
              const Icon = type.icon;
              const isLoading = loadingType === type.id;
              
              return (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`group relative flex flex-col rounded-2xl border transition-all duration-300 p-6 bg-card/50 backdrop-blur-sm shadow-md hover:shadow-xl cursor-pointer ${type.bgClass} ${loadingType && !isLoading ? 'opacity-50 pointer-events-none' : ''} ${type.isSpecial ? 'ring-2 ring-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : ''}`}
                  onClick={() => !loadingType && startInterview(type.id)}
                >
                  {type.isSpecial && (
                    <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg z-20">
                      Featured
                    </div>
                  )}
                  {/* Subtle hover glow behind card */}
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-10 -mt-10 opacity-0 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none ${type.colorClass === 'text-primary' ? 'bg-primary' : type.colorClass === 'text-secondary' ? 'bg-secondary' : type.colorClass === 'text-accent' ? 'bg-accent' : type.colorClass.replace('text-', 'bg-')}`} />
                  
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${type.bgClass} border-transparent bg-background/50 backdrop-blur-md transition-colors duration-300`}>
                      <Icon className={`w-6 h-6 ${type.colorClass}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground leading-tight tracking-wide">{type.title}</h3>
                      <p className={`text-xs font-semibold uppercase tracking-wider mt-1 ${type.colorClass}`}>{type.subtitle}</p>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-1">
                    {type.description}
                  </p>
                  
                  <Button 
                    className={`w-full font-semibold border-none transition-all shadow-sm ${type.bgClass} text-foreground group-hover:bg-background/50 hover:brightness-110 relative overflow-hidden`}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                         <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                         Starting...
                      </div>
                    ) : (
                      'Begin Interview'
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
