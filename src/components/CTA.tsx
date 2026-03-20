import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface CTAProps {
  onGetStarted?: () => void;
}

const CTA = ({ onGetStarted }: CTAProps) => {
  const features = [
    "Unlimited AI Mock Interviews",
    "Advanced Resume ATS Analysis",
    "Detailed Speech & Comm Feedback",
    "Custom Interview Scenarios",
    "Priority Email Support"
  ];

  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="container mx-auto max-w-lg text-center relative z-10">
        <div className="mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Ready to <span className="text-gradient">Accelerate?</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of successful candidates who have mastered their interview skills.
          </p>
        </div>

        <div className="relative glass-card rounded-3xl p-8 border border-primary/30 shadow-glow transform hover:-translate-y-2 transition-transform duration-300">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold tracking-wider uppercase py-1 px-4 rounded-full shadow-lg">
              Most Popular
            </span>
          </div>

          <div className="mb-8 mt-4">
            <h3 className="text-2xl font-semibold text-foreground mb-2">Pro Access</h3>
            <div className="flex items-center justify-center gap-1">
              <span className="text-5xl font-bold text-foreground">₹799</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>

          <ul className="space-y-4 mb-8 text-left">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            size="lg" 
            className="w-full bg-primary hover:bg-primary-glow text-primary-foreground font-semibold py-6 text-lg rounded-xl shadow-lg transition-all"
            onClick={onGetStarted}
          >
            Start Free Practice Session
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;