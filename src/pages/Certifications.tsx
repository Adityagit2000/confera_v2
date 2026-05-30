import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Award, Clock, FileText, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const CERTIFICATION_TRACKS = [
  {
    id: 'data-engineering',
    title: 'Data Engineering & Analytics',
    description: 'Validates expertise in SQL, PySpark, Python Data Pipelines, and scalable data processing.',
    duration: 30,
    questions: 20,
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-500'
  },
  {
    id: 'gen-ai',
    title: 'Generative AI & Machine Learning Engineering',
    description: 'Validates expertise in LLMs, RAG architectures, Core ML concepts, and MLOps best practices.',
    duration: 30,
    questions: 20,
    color: 'from-purple-500/20 to-fuchsia-500/20',
    iconColor: 'text-purple-500'
  },
  {
    id: 'advanced-fullstack',
    title: 'Advanced Full-Stack & System Design',
    description: 'Validates expertise in Scalable Architectures, React, Node.js, and API Integration patterns.',
    duration: 30,
    questions: 20,
    color: 'from-orange-500/20 to-red-500/20',
    iconColor: 'text-orange-500'
  }
];

const Certifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTrackId, setStartingTrackId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchCertificates = async () => {
      try {
        const { data, error } = await supabase
          .from('certificates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setCertificates(data || []);
      } catch (err: any) {
        console.error("Error fetching certificates:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCertificates();
  }, [user]);

  const handleStartCertification = async (track: typeof CERTIFICATION_TRACKS[0]) => {
    if (!user) return;
    setStartingTrackId(track.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-assessment', {
        body: { jobRole: track.title }
      });

      if (error) throw new Error(error.message);
      if (!data?.assessmentId) throw new Error("Failed to retrieve assessment ID");

      toast({
        title: "Assessment Ready",
        description: `Starting ${track.title} certification exam.`,
      });
      
      navigate(`/assessment-room/${data.assessmentId}`);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('upgrade') || msg.toLowerCase().includes('tier')) {
        toast({
          title: "Limit Reached",
          description: "You've used all your free assessments. Please upgrade to Pro.",
          variant: "destructive"
        });
        navigate('/pricing');
      } else {
        toast({
          title: "Generation Failed",
          description: msg || "Failed to start certification.",
          variant: "destructive"
        });
      }
      setStartingTrackId(null);
    }
  };

  if (startingTrackId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3 text-center">AI is assembling your certification exam...</h2>
        <p className="text-muted-foreground text-center">This may take a few seconds to generate original questions.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:px-6 relative">
      <div className="absolute top-6 left-6 z-10">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
      
      <div className="max-w-6xl mx-auto space-y-12 mt-12">
        <div className="text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 shadow-inner"
          >
            <Award className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl font-bold text-foreground mb-4"
          >
            Confera Certifications
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Validate your expertise with our rigorous, AI-generated technical assessments. Pass with a 70% or higher to earn your verifiable certificate.
          </motion.p>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Available Tracks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CERTIFICATION_TRACKS.map((track, i) => (
              <motion.div 
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
              >
                <Card className="h-full flex flex-col glass-card border-border/50 shadow-lg hover:shadow-primary/20 transition-all duration-300 overflow-hidden relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${track.color} opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none z-0`} />
                  <CardHeader className="relative z-10">
                    <CardTitle className="text-xl">{track.title}</CardTitle>
                    <CardDescription className="text-sm pt-2">{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end relative z-10">
                    <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground mb-6">
                      <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5" /> {track.duration} mins</span>
                      <span className="flex items-center"><FileText className="w-4 h-4 mr-1.5" /> {track.questions} Questions</span>
                    </div>
                    
                    <Button 
                      className="w-full bg-card hover:bg-primary hover:text-primary-foreground border border-border/50 group-hover:border-primary/50 transition-colors"
                      disabled={startingTrackId !== null}
                      onClick={() => handleStartCertification(track)}
                    >
                      {startingTrackId === track.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Preparing Environment...
                        </>
                      ) : (
                        <>
                          Start Certification <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Earned Certificates Section */}
        <div className="space-y-6 pt-12 border-t border-border/50">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-yellow-500" /> Earned Certificates
          </h2>
          
          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : certificates.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((cert) => (
                <Card 
                  key={cert.id} 
                  className="glass-card border-border/50 shadow-lg relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-emerald-500 hover:shadow-emerald-500/20"
                  onClick={() => navigate(`/certificate/${cert.certificate_hash}`)}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
                  <CardHeader>
                    <CardTitle className="text-lg text-emerald-400">Certified Professional</CardTitle>
                    <CardDescription className="font-bold text-foreground text-base pt-1">
                      {cert.job_role}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Issued: {new Date(cert.created_at).toLocaleDateString()}</p>
                      <p className="font-mono mt-2 break-all text-emerald-500/80">ID: {cert.certificate_hash}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-muted/20 border border-border/50 rounded-2xl">
              <Award className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No certificates yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Complete a certification track and score 70% or higher to earn your first verifiable certificate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Certifications;
