import { Button } from "@/components/ui/button";
import { Mic, Shield, Star, Users, FileText } from "lucide-react";

import { motion } from "framer-motion";

interface HeroProps {
  onStartFreeInterview?: () => void;
  onWatchDemo?: () => void;
}

const Hero = ({ onStartFreeInterview, onWatchDemo }: HeroProps) => {
  return (
    <section className="relative pt-32 pb-16 px-6 overflow-hidden">
      {/* Animated Mesh Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[120px] animate-mesh" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-secondary/20 blur-[120px] animate-mesh" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] rounded-full bg-accent/20 blur-[100px] animate-mesh" style={{ animationDelay: '4s' }} />
      </div>

      <div className="container relative z-10 mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-sm font-medium">Confera AI 2.0 is live</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold text-foreground leading-tight tracking-tight">
                Master Your <br />
                <span className="text-gradient">
                  AI Mock Interview
                </span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
                The ultimate platform for EY Interview Prep, Consulting, and FAANG roles. Elevate your career with real-time feedback and our ATS Resume Optimizer 2026.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary-glow text-primary-foreground font-semibold px-8 py-6 text-lg shadow-glow transition-all duration-300 rounded-full"
                onClick={onStartFreeInterview}
              >
                <Mic className="mr-2 h-5 w-5" />
                Start Mock Interview
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-border hover:bg-card hover:text-foreground glass-card px-8 py-6 text-lg transition-smooth rounded-full group"
                onClick={onWatchDemo}
              >
                <FileText className="mr-2 h-5 w-5 group-hover:text-primary transition-colors" />
                Analyze Resume
              </Button>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative lg:ml-auto w-full max-w-md animate-float"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-2xl blur-2xl"></div>
            
            {/* Floating Card UI Mockup */}
            <div className="relative glass-card rounded-2xl p-6 border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white font-bold text-lg">AI</span>
                  </div>
                  <div>
                    <h3 className="text-foreground font-semibold">Alex</h3>
                    <p className="text-sm text-muted-foreground leading-none">Senior Engineer AI</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-medium border border-success/30 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
                  Active Session
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="glass-panel p-4 rounded-xl">
                  <p className="text-sm text-foreground">
                    "That's a great overview of your experience. Can you elaborate on how you handled the database migration in your last role without downtime?"
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <div className="bg-primary/20 border border-primary/30 p-4 rounded-xl rounded-tr-none max-w-[85%]">
                    <p className="text-sm text-foreground">
                      "Absolutely. We used a blue-green deployment strategy combined with logical replication to ensure zero downtime..."
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center pb-2">
                <div className="flex items-center gap-4 glass-panel px-6 py-3 rounded-full">
                  <div className="w-3 h-3 rounded-full bg-destructive animate-pulse"></div>
                  <span className="text-sm font-medium text-muted-foreground mr-2">04:12</span>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/40 transition-colors">
                    <Mic className="text-primary h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-20 glass-panel rounded-2xl p-8 max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-border/50 text-center">
            <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
              <Users className="h-6 w-6 text-primary mb-2" />
              <div className="text-3xl font-bold tracking-tight text-foreground">10k+</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">Interviews Practiced</div>
            </div>
            <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
              <Shield className="h-6 w-6 text-success mb-2" />
              <div className="text-3xl font-bold tracking-tight text-foreground">95%</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">Offer Success Rate</div>
            </div>
            <div className="flex flex-col items-center justify-center pt-4 md:pt-0">
              <Star className="h-6 w-6 text-warning mb-2" />
              <div className="text-3xl font-bold tracking-tight text-foreground">4.9/5</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">User Rating</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;