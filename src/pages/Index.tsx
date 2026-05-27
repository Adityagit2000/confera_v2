import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mic, BrainCircuit, Smartphone, FileText, 
  CheckCircle2, ChevronRight, Play, Upload, MessageSquare, 
  Target, BarChart3, Clock, Lock, LineChart
} from "lucide-react";

import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { InterviewSelectionModal } from "@/components/InterviewSelectionModal";
import ResumeUpload from "@/components/ResumeUpload";

// Animation Variants
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function Index() {
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleStartMockInterview = () => {
    if (!user) navigate('/auth');
    else setShowInterviewModal(true);
  };

  const handleAnalyzeResume = () => {
    if (!user) navigate('/auth');
    else setShowResumeModal(true);
  };

  const handleResumeAnalysisComplete = (data: any) => {
    setShowResumeModal(false);
    toast({
      title: "Resume Analysis Complete",
      description: `ATS Score: ${data.ats_score}% - Ready for interview!`,
    });
    setTimeout(() => { setShowInterviewModal(true); }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-primary/30 font-sans overflow-x-hidden">
      <Header />
      
      <main>
        {/* 1. HERO SECTION */}
        <section className="relative pt-40 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
          {/* Subtle glowing orb in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] pointer-events-none opacity-50" />
          
          <div className="container mx-auto max-w-7xl relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
              
              {/* Text Column */}
              <motion.div 
                initial="hidden" animate="visible" variants={staggerContainer}
                className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-8"
              >
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white/80">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Confera AI 2.0 is Live
                </motion.div>
                
                <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
                  Ace your placements with AI <span className="text-gradient">that actually listens</span>
                </motion.h1>
                
                <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/60 max-w-xl leading-relaxed">
                  Practice with an AI interviewer that remembers your weak spots and gets harder every session. Used by students preparing for Deloitte, McKinsey, TCS, Infosys and more.
                </motion.p>
                
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <Button 
                    size="lg" 
                    onClick={handleStartMockInterview}
                    className="h-14 px-8 bg-primary hover:bg-primary-glow text-primary-foreground font-semibold text-lg shadow-glow transition-all rounded-full"
                  >
                    Start Free — 5 interviews
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handleAnalyzeResume}
                    className="h-14 px-8 border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-lg rounded-full backdrop-blur-sm transition-all group"
                  >
                    <Play className="mr-2 w-5 h-5 group-hover:text-primary transition-colors" />
                    Watch Demo
                  </Button>
                </motion.div>
              </motion.div>

              {/* Mockup Column */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}
                className="relative lg:ml-auto w-full max-w-lg mx-auto"
              >
                {/* Linear-style Mockup */}
                <div className="relative rounded-2xl border border-white/10 bg-[#131316]/80 backdrop-blur-xl shadow-2xl overflow-hidden p-6">
                  {/* Mockup Header */}
                  <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <span className="font-bold text-white">AI</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold">McKinsey DE Track</div>
                        <div className="text-xs text-white/50">Senior Interviewer</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </div>
                  </div>
                  
                  {/* Chat flow mockup */}
                  <div className="space-y-6">
                    <div className="flex gap-4 w-[90%]">
                      <div className="bg-white/5 border border-white/5 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed text-white/90">
                        "Your resume mentions you optimized a data pipeline. Can you explain the specific bottlenecks you faced and how you resolved them?"
                      </div>
                    </div>
                    <div className="flex gap-4 w-[90%] ml-auto justify-end">
                      <div className="bg-primary/20 border border-primary/20 p-4 rounded-2xl rounded-tr-none text-sm leading-relaxed text-white/90">
                        "Yes, the main bottleneck was the transformation step in pandas which was memory-bound. I migrated it to PySpark..."
                      </div>
                    </div>
                  </div>
                  
                  {/* Voice Waveform Mockup */}
                  <div className="mt-8 flex justify-center pb-2">
                    <div className="flex items-center gap-4 bg-black/40 border border-white/5 px-6 py-3 rounded-full w-full max-w-xs justify-center">
                       {Array.from({ length: 12 }).map((_, i) => (
                         <div key={i} className="w-1 rounded-full bg-primary" style={{ height: `${Math.max(4, Math.random() * 24)}px`, opacity: 0.8 }} />
                       ))}
                       <div className="ml-2 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                         <Mic className="text-primary w-4 h-4" />
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 2. SOCIAL PROOF */}
        <section className="py-10 border-y border-white/5 bg-white/[0.02]">
          <div className="container mx-auto px-6">
            <p className="text-center text-sm font-semibold tracking-widest uppercase text-white/40 mb-6">
              Join 10,000+ students already preparing from
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              {['MAIT', 'DTU', 'VIT', 'MANIPAL', 'IIT DELHI', 'BITS'].map((college, i) => (
                <div key={i} className="px-5 py-2 rounded-full border border-white/10 bg-white/5 font-bold text-lg tracking-wider">
                  {college}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. FEATURES */}
        <section className="py-32 px-6 relative" id="features">
          <div className="container mx-auto max-w-7xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Designed to help you <span className="text-gradient">clear rounds</span></h2>
              <p className="text-lg text-white/50 max-w-2xl mx-auto">
                Stop practicing with static question banks. Experience the dynamic, adaptive pressure of a real technical interview.
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: <BrainCircuit />, title: "AI That Remembers", desc: "Our RAG architecture recalls your past answers, identifies your weak spots, and grills you exactly where you struggle." },
                { icon: <Smartphone />, title: "Works on Any Device", desc: "Built with a resilient WebRTC voice engine that works flawlessly across desktop, Android, and iOS browsers." },
                { icon: <FileText />, title: "7-Day Prep Plans", desc: "After every session, the AI generates a highly personalized, actionable 7-day study roadmap based on your performance." }
              ].map((f, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-[#131316] border border-white/5 p-8 rounded-3xl hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/70 group-hover:text-primary group-hover:border-primary/50 transition-all mb-6">
                    {f.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-white/50 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. HOW IT WORKS */}
        <section className="py-32 px-6 bg-[#131316]/50 border-y border-white/5" id="how-it-works">
          <div className="container mx-auto max-w-5xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">How it works</h2>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-12 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              {[
                { icon: <Upload />, step: "Step 1", title: "Upload Resume", desc: "The AI parses your ATS score and uses your resume as the context for the interview." },
                { icon: <Mic />, step: "Step 2", title: "Voice Interview", desc: "Speak directly to the AI. It asks follow-ups based on your real-time responses." },
                { icon: <LineChart />, step: "Step 3", title: "Get Feedback", desc: "Receive detailed scores on technical depth, communication, and a study plan." }
              ].map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="w-24 h-24 bg-[#0a0a0f] border-2 border-white/10 rounded-full flex items-center justify-center text-primary z-10 mb-6 shadow-2xl">
                    {step.icon}
                  </div>
                  <div className="text-primary font-bold text-sm tracking-widest uppercase mb-2">{step.step}</div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-white/50">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. INTERVIEW TRACKS */}
        <section className="py-32 px-6">
          <div className="container mx-auto max-w-7xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="mb-16"
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Specialized <span className="text-gradient">Tracks</span></h2>
              <p className="text-lg text-white/50 max-w-2xl">
                Select the exact persona you are interviewing for. Our AI adopts the specific evaluating criteria of these top-tier roles.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "McKinsey DE", "Deloitte T&T", "ZS DAA", "TCS Ninja", 
                "Infosys SP", "HR/Behavioral", "DSA & Algorithms", "System Design"
              ].map((track, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="bg-[#131316] border border-white/5 p-6 rounded-2xl hover:border-primary/30 transition-colors flex flex-col items-center justify-center text-center group cursor-default"
                >
                  <Target className="w-8 h-8 text-white/20 group-hover:text-primary mb-4 transition-colors" />
                  <span className="font-semibold text-white/80 group-hover:text-white transition-colors">{track}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. PRICING */}
        <section className="py-32 px-6 bg-[#131316]/50 border-y border-white/5">
          <div className="container mx-auto max-w-5xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple, transparent pricing</h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Tier */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
                className="bg-[#0a0a0f] border border-white/10 p-10 rounded-3xl flex flex-col"
              >
                <div className="text-xl font-semibold mb-2">Free</div>
                <div className="text-4xl font-bold mb-6">₹0<span className="text-lg text-white/40 font-normal">/month</span></div>
                <p className="text-white/50 mb-8 h-12">Perfect for trying out the platform and getting initial feedback.</p>
                <ul className="space-y-4 mb-10 flex-1">
                  {["5 AI Interviews per month", "Standard General Track", "Basic feedback report", "Resume Parsing"].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="w-5 h-5 text-white/30" /> {f}
                    </li>
                  ))}
                </ul>
                <Button onClick={handleStartMockInterview} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 h-12 rounded-xl">Get Started</Button>
              </motion.div>

              {/* Pro Tier */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
                className="bg-primary/5 border border-primary/20 p-10 rounded-3xl flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-bl-xl uppercase tracking-wider">Most Popular</div>
                <div className="text-xl font-semibold mb-2 text-primary">Pro</div>
                <div className="text-4xl font-bold mb-6">₹799<span className="text-lg text-white/40 font-normal">/month</span></div>
                <p className="text-white/50 mb-8 h-12">For serious candidates aiming for top-tier placements.</p>
                <ul className="space-y-4 mb-10 flex-1">
                  {["Unlimited AI Interviews", "All 8 Specialized Tracks", "Priority feedback & 7-day plans", "RAG Weak-spot Memory", "Advanced Analytics"].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/90">
                      <CheckCircle2 className="w-5 h-5 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button onClick={() => navigate('/pricing')} className="w-full bg-primary hover:bg-primary-glow text-primary-foreground h-12 rounded-xl shadow-glow">Upgrade to Pro</Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 7. FAQ */}
        <section className="py-32 px-6">
          <div className="container mx-auto max-w-3xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Frequently Asked Questions</h2>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
              <Accordion type="single" collapsible className="w-full space-y-4">
                {[
                  { q: "Is the Free plan actually free?", a: "Yes. You get 5 complete mock interviews every single month without entering a credit card." },
                  { q: "How does the AI remember my weak spots?", a: "We use RAG (Retrieval-Augmented Generation). During an interview, the AI searches your historical answers, identifies recurring mistakes (like weak communication or missing technical depth), and explicitly targets those areas in new questions." },
                  { q: "Does it work on my phone?", a: "Absolutely. Our voice engine is built on WebRTC and is fully compatible with Safari on iOS and Chrome on Android." },
                  { q: "Can I cancel my Pro subscription anytime?", a: "Yes, you can cancel your subscription from the dashboard at any time. You will retain Pro access until the end of your billing cycle." },
                  { q: "Who are the specialized tracks for?", a: "The specialized tracks (e.g., McKinsey, Deloitte) alter the AI's persona, strictness, and questioning style to mirror the exact criteria those companies use during their actual hiring rounds." }
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`item-${i}`} className="bg-[#131316] border border-white/5 rounded-xl px-6">
                    <AccordionTrigger className="text-left font-semibold py-4 hover:no-underline hover:text-primary transition-colors">{faq.q}</AccordionTrigger>
                    <AccordionContent className="text-white/60 leading-relaxed pb-6">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>
      </main>

      {/* 8. FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-[#0a0a0f]">
        <div className="container mx-auto px-6 text-center md:text-left grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="flex items-center justify-center md:justify-start space-x-2 mb-4 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-xl font-bold text-white">Confera</span>
            </div>
            <p className="text-white/40 text-sm">
              The world's most advanced AI interview preparation platform.
            </p>
          </div>
          <div className="md:text-right text-sm text-white/40">
            <p>© 2026 Confera. Powered by Advanced AI Technology.</p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <InterviewSelectionModal 
        open={showInterviewModal} 
        onOpenChange={setShowInterviewModal} 
      />

      <Dialog open={showResumeModal} onOpenChange={setShowResumeModal}>
        <DialogContent className="max-w-2xl bg-[#131316] border border-white/10 p-0 overflow-hidden text-white">
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b border-white/5">
            <DialogTitle className="text-xl inline-block">Upload Resume</DialogTitle>
            <DialogDescription className="mt-1 text-white/50">
              Upload for instant ATS compatibility scoring and intelligent skill extraction.
            </DialogDescription>
          </div>
          <div className="p-6">
            <ResumeUpload onAnalysisComplete={handleResumeAnalysisComplete} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
