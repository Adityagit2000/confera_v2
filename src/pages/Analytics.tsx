import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BarChart3, Zap, FolderClock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Analytics() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [skillMemory, setSkillMemory] = useState<any>(null);
  
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, page]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch total count
      const { count } = await supabase
        .from('interview_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('status', 'completed');
        
      setTotalSessions(count || 0);

      // Fetch paginated sessions
      const { data: sessionData } = await supabase
        .from('interview_sessions')
        .select('id, type, job_role, created_at, feedback_reports(overall_score)')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      setSessions(sessionData || []);

      // Fetch skill memory
      if (page === 1) {
        const { data: skills } = await supabase
          .from('user_skill_memory')
          .select('*')
          .eq('user_id', user?.id)
          .maybeSingle();
          
        setSkillMemory(skills);
      }
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalSessions / ITEMS_PER_PAGE);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-background pl-0 md:pl-72"
    >
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 mt-16 md:mt-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Performance Analytics</h1>
          <p className="text-muted-foreground">Track your progress and review past sessions.</p>
        </div>

        {/* Skill Spider / Progress bars */}
        {skillMemory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-card/40 border-border/50">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Core Competencies</h3>
              <div className="space-y-4">
                {[
                  { label: 'Communication', value: skillMemory.communication, color: 'bg-primary' },
                  { label: 'Technical Depth', value: skillMemory.technical_depth, color: 'bg-secondary' },
                  { label: 'Problem Solving', value: skillMemory.problem_solving, color: 'bg-accent' },
                  { label: 'Domain Knowledge', value: skillMemory.domain_knowledge, color: 'bg-emerald-500' }
                ].map(skill => (
                  <div key={skill.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{skill.label}</span>
                      <span className="font-bold">{Math.round(skill.value || 0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${skill.color}`} style={{ width: `${skill.value || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-card/40 border-border/50">
               <h3 className="font-semibold text-lg mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-orange-500" /> Focus Areas</h3>
               <div className="flex flex-wrap gap-2">
                 {skillMemory.weak_areas && skillMemory.weak_areas.length > 0 ? (
                   skillMemory.weak_areas.map((area: string, i: number) => (
                     <div key={i} className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 text-sm border border-orange-500/20">
                       {area}
                     </div>
                   ))
                 ) : (
                   <p className="text-muted-foreground text-sm">No weak areas identified yet. Complete more interviews!</p>
                 )}
               </div>
            </Card>
          </div>
        )}

        {/* Paginated Sessions Table */}
        <Card className="p-6 bg-card/40 border-border/50">
          <h3 className="font-semibold text-lg mb-6 flex items-center gap-2"><FolderClock className="w-5 h-5 text-primary" /> Past Sessions</h3>
          
          <div className="space-y-3">
            {sessions.map(session => (
               <div key={session.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => window.location.href = `/report/${session.id}`}>
                 <div>
                   <div className="font-medium capitalize text-white">{session.type?.replace(/_/g, ' ')}</div>
                   <div className="text-sm text-muted-foreground">{new Date(session.created_at).toLocaleDateString()}</div>
                 </div>
                 <div className="font-bold text-lg text-primary">
                    {Array.isArray(session.feedback_reports) && session.feedback_reports.length > 0 
                      ? `${session.feedback_reports[0].overall_score}%`
                      : 'N/A'}
                 </div>
               </div>
            ))}
            
            {sessions.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">No completed sessions found.</div>
            )}
            
            {loading && (
              <div className="text-center py-8 text-muted-foreground animate-pulse">Loading sessions...</div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </Card>
      </main>
    </motion.div>
  );
}
