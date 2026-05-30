import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ChevronRight, 
  ChevronLeft, 
  Target, 
  Briefcase, 
  User, 
  Calendar as CalendarIcon, 
  CheckCircle2
} from 'lucide-react';
import ResumeUpload from '@/components/ResumeUpload';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const STEPS = [
  { id: 1, title: 'Primary Goal' },
  { id: 2, title: 'Target Role' },
  { id: 3, title: 'Experience' },
  { id: 4, title: 'Timeline' },
  { id: 5, title: 'Resume' },
];

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    goal: '',
    role: '',
    company: '',
    experience: '',
    interviewDate: '',
    resumeAnalyzed: false
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    } else {
      if (!user) return;
      setIsSubmitting(true);
      try {
        const targetDate = formData.interviewDate ? new Date(formData.interviewDate).toISOString() : null;
        const { error } = await supabase
          .from('profiles')
          .update({ 
             target_interview_date: targetDate,
             // Could also save other onboarding fields here if there were columns for them
          })
          .eq('id', user.id);
          
        if (error) throw error;

        toast({
          title: "Simulation Initialized",
          description: "Your neural profile has been synchronized. Welcome to Confera.",
        });
        navigate('/dashboard');
      } catch (err: any) {
        toast({ title: "Error saving profile", description: err.message, variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: return !!formData.goal;
      case 2: return !!formData.role;
      case 3: return !!formData.experience;
      case 4: return !!formData.interviewDate;
      case 5: return true;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-primary/30 overflow-hidden">
      {/* Neural Progress Bar */}
      <div className="w-full border-b border-white/[0.04] bg-black/40 backdrop-blur-3xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-10 sm:py-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-glow">
              <span className="text-black font-black text-xl">C</span>
            </div>
            <span className="text-lg sm:text-2xl font-display font-black text-white tracking-tighter italic">Confera.</span>
          </Link>
          
          <div className="flex items-center gap-3">
            {STEPS.map((step) => (
              <div 
                key={step.id}
                className={cn(
                  "h-[2px] w-8 sm:w-16 md:w-24 rounded-full transition-all duration-700 relative overflow-hidden",
                  step.id <= currentStep ? "bg-primary/40" : "bg-white/[0.04]"
                )}
              >
                {step.id <= currentStep && (
                  <motion.div 
                    layoutId="progress"
                    className="absolute inset-0 bg-primary shadow-glow-sm"
                  />
                )}
              </div>
            ))}
          </div>
          
          <div className="text-[10px] font-black text-[#52525B] uppercase tracking-[0.4em]">
            PHASE {currentStep}/05
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[200px] pointer-events-none" />

        <div className="w-full max-w-4xl relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -10 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-12"
            >
              <div className="text-center space-y-6">
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-display font-black tracking-tighter italic">
                  {currentStep === 1 && <span className="flex items-center justify-center gap-4">Define the <span className='text-primary NOT-italic'>Objective.</span></span>}
                  {currentStep === 2 && <span className="flex items-center justify-center gap-4">Target <span className='text-primary NOT-italic'>Protocol.</span></span>}
                  {currentStep === 3 && <span className="flex items-center justify-center gap-4">Technical <span className='text-primary NOT-italic'>Seniority.</span></span>}
                  {currentStep === 4 && <span className="flex items-center justify-center gap-4">Deployment <span className='text-primary NOT-italic'>Sync.</span></span>}
                  {currentStep === 5 && <span className="flex items-center justify-center gap-4">Neural <span className='text-primary NOT-italic'>Sync.</span></span>}
                </h1>
                <p className="text-[#A1A1AA] text-sm sm:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                  {currentStep === 1 && "Incorporate your primary ambition into the neural engine."}
                  {currentStep === 2 && "Select the professional trajectory for adaptive scaling."}
                  {currentStep === 3 && "Calibrate the complexity index for advanced simulation."}
                  {currentStep === 4 && "Synchronize with your real-world evaluation schedule."}
                  {currentStep === 5 && "Optional: Incorporate your technical dossier for precision tuning."}
                </p>
              </div>

              <div className="bg-[#111] border border-white/[0.04] shadow-2xl p-5 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-10">
                  {currentStep === 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {[
                        { id: 'job', label: 'Land Elite Role', icon: Target },
                        { id: 'skills', label: 'Skill Optimization', icon: Briefcase },
                        { id: 'specific', label: 'Specific Interview', icon: CheckCircle2 },
                        { id: 'general', label: 'Neural Evolution', icon: User },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => updateFormData('goal', item.id)}
                          className={cn(
                            "p-5 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border transition-all duration-500 flex flex-col gap-4 sm:gap-6 group relative overflow-hidden",
                            formData.goal === item.id 
                              ? "border-primary bg-primary/10 shadow-glow" 
                              : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]"
                          )}
                        >
                          <div className={cn(
                            "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-500",
                            formData.goal === item.id ? "bg-primary text-black shadow-glow-sm" : "bg-white/[0.04] text-[#52525B] group-hover:text-primary"
                          )}>
                            <item.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                          </div>
                          <span className={cn(
                            "font-black text-base sm:text-xl font-display tracking-tight transition-colors duration-500",
                            formData.goal === item.id ? "text-white" : "text-[#52525B] group-hover:text-white"
                          )}>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#52525B] ml-4">Target Trajectory</Label>
                        <Input 
                          placeholder="e.g. Senior Logic Architect"
                          value={formData.role}
                          onChange={(e) => updateFormData('role', e.target.value)}
                          className="h-14 sm:h-20 bg-white/[0.02] border-white/[0.04] text-base sm:text-xl rounded-xl sm:rounded-[1.5rem] px-4 sm:px-8 font-black focus:border-primary/50 transition-all placeholder:text-[#2A2A2A]"
                        />
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#52525B] ml-4">Authorized Entity (Optional)</Label>
                        <Input 
                          placeholder="e.g. Google, Goldman Sachs, OpenAI"
                          value={formData.company}
                          onChange={(e) => updateFormData('company', e.target.value)}
                          className="h-14 sm:h-20 bg-white/[0.02] border-white/[0.04] text-base sm:text-xl rounded-xl sm:rounded-[1.5rem] px-4 sm:px-8 font-black focus:border-primary/50 transition-all placeholder:text-[#2A2A2A]"
                        />
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="grid grid-cols-1 gap-6">
                      {[
                        { id: 'student', label: 'Junior / Academic' },
                        { id: 'entry', label: 'Professional (0-2Y)' },
                        { id: 'mid', label: 'Architect (3-5Y)' },
                        { id: 'senior', label: 'Principal (5Y+)' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => updateFormData('experience', item.id)}
                          className={cn(
                            "p-5 sm:p-8 rounded-xl sm:rounded-[1.5rem] border transition-all duration-500 flex items-center justify-between group",
                            formData.experience === item.id 
                              ? "border-primary bg-primary/10 shadow-glow" 
                              : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]"
                          )}
                        >
                          <span className={cn(
                            "font-black text-base sm:text-xl tracking-tight transition-colors duration-500",
                            formData.experience === item.id ? "text-white" : "text-[#52525B] group-hover:text-white"
                          )}>
                            {item.label}
                          </span>
                          {formData.experience === item.id && <div className="w-4 h-4 rounded-full bg-primary shadow-glow-sm" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-[#52525B] ml-4">Deployment Date</Label>
                        <div className="relative">
                          <Input 
                            type="date"
                            value={formData.interviewDate}
                            onChange={(e) => updateFormData('interviewDate', e.target.value)}
                            className="h-14 sm:h-20 bg-white/[0.02] border-white/[0.04] text-base sm:text-xl rounded-xl sm:rounded-[1.5rem] px-4 sm:px-8 font-black focus:border-primary/50 transition-all appearance-none"
                          />
                          <CalendarIcon className="absolute right-8 top-1/2 -translate-y-1/2 text-primary w-8 h-8 pointer-events-none opacity-40" />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-[#A1A1AA] italic bg-white/[0.02] p-6 rounded-2xl border border-white/[0.04]">
                        System note: Timeline synchronization enhances the adaptive learning delta.
                      </p>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="p-2">
                      <ResumeUpload onAnalysisComplete={() => updateFormData('resumeAnalyzed', true)} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-8 pt-8">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="h-12 sm:h-20 px-4 sm:px-12 text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-[#52525B] hover:text-white hover:bg-white/[0.02] transition-all disabled:opacity-0"
                >
                  <ChevronLeft className="mr-3 w-5 h-5" /> Previous Phase
                </Button>
                
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid() || isSubmitting}
                  className="h-12 sm:h-20 px-6 sm:px-16 rounded-full bg-primary text-black hover:bg-primary/90 text-xs sm:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-glow flex-1 md:flex-none active:scale-95 transition-all disabled:opacity-20"
                >
                  {isSubmitting ? "Initializing..." : (currentStep === 5 ? "Initialize Core" : "Next Protocol")} <ChevronRight className="ml-3 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
