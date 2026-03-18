import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  BookOpen, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Resource {
  title: string;
  url: string;
}

interface LearningPathItem {
  id: string;
  title: string;
  description: string;
  resources: Resource[];
  is_completed: boolean;
  source_type: string;
}

interface LearningPathProps {
  sourceId: string;
  sourceType: 'resume_analysis' | 'mock_interview';
}

export const LearningPath = ({ sourceId, sourceType }: LearningPathProps) => {
  const [items, setItems] = useState<LearningPathItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (sourceId) {
      fetchLearningPath();
    }
  }, [sourceId]);

  const fetchLearningPath = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('learning_paths')
        .select('*')
        .eq('source_id', sourceId)
        .eq('source_type', sourceType)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setItems((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching learning path:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('learning_paths')
        .update({ is_completed: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_completed: !currentStatus } : item
      ));

      if (!currentStatus) {
        toast({
          title: "Great job!",
          description: "One more step towards your career goal.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const completedCount = items.filter(i => i.is_completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
              <Zap className="text-primary h-6 w-6" />
            </div>
            Your Personalized Learning Path
          </h3>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
            We've analyzed your performance and curated a step-by-step roadmap to bridge your skill gaps.
          </p>
        </div>
        
        <div className="bg-card/40 backdrop-blur-md border border-border/50 p-6 rounded-2xl shadow-sm min-w-[200px]">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
            <span className="text-2xl font-black text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <Card 
            key={item.id} 
            className={`group transition-all duration-300 border-border/50 overflow-hidden ${
              item.is_completed ? 'bg-success/5 border-success/20 opacity-80' : 'bg-card/50 hover:border-primary/30'
            }`}
          >
            <div className="flex items-stretch">
              <div 
                className={`w-14 flex items-center justify-center cursor-pointer transition-colors ${
                  item.is_completed ? 'bg-success/10 text-success' : 'hover:bg-primary/5 text-muted-foreground'
                }`}
                onClick={() => toggleComplete(item.id, item.is_completed)}
              >
                {item.is_completed ? (
                  <CheckCircle2 className="w-6 h-6 border-none" />
                ) : (
                  <Circle className="w-6 h-6 group-hover:text-primary transition-colors" />
                )}
              </div>
              
              <div className="flex-1 p-6">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <h4 className={`text-lg font-bold transition-all ${item.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {item.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">
                      {item.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="rounded-full shrink-0"
                    >
                      {expandedId === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === item.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 mt-6 border-t border-border/50">
                        <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-primary uppercase tracking-widest">
                          <BookOpen className="w-4 h-4" /> Recommended Resources
                        </div>
                        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {item.resources?.map((resource, i) => (
                            <a 
                              key={i} 
                              href={resource.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-start gap-3 p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-background/80 transition-all group/link shadow-sm"
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                                <ExternalLink className="w-4 h-4 text-primary" />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-foreground line-clamp-1 group-hover/link:text-primary transition-colors">
                                  {resource.title}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                  {new URL(resource.url).hostname}
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
