import { Button } from "@/components/ui/button";

interface CTAProps {
  onGetStarted?: () => void;
}

const CTA = ({ onGetStarted }: CTAProps) => {
  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-4xl text-center">
        <div className="space-y-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Ready to{" "}
            <span className="gradient-hero bg-clip-text ">
              Ace Your Next Interview?
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of successful candidates who have mastered their interview skills 
            with our AI-powered platform. Start your journey today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
            <Button 
              size="lg" 
              variant="hero"
              className="px-12 py-6 text-lg animate-pulse-glow"
              onClick={onGetStarted}
            >
              Start Free Practice Session
            </Button>
            <div className="text-sm text-muted-foreground">
              ✓ No credit card required  •  ✓ Instant access
            </div>
          </div>
          
          <div className="grid sm:grid-cols-3 gap-8 pt-12 border-t border-muted">
            <div className="text-center">
              <div className="text-3xl font-bold text-success mb-2">Free</div>
              <div className="text-muted-foreground">Basic Practice Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-2">24/7</div>
              <div className="text-muted-foreground">AI Interview Assistant</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">∞</div>
              <div className="text-muted-foreground">Unlimited Feedback</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;