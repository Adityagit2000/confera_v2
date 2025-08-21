import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-interview.jpg";

interface HeroProps {
  onStartFreeInterview?: () => void;
}

const Hero = ({ onStartFreeInterview }: HeroProps) => {
  return (
    <section className="pt-24 pb-16 px-6">
      <div className="container mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Ace Your Interviews with{" "}
                <span className="gradient-hero bg-clip-text text-transparent">
                  AI Intelligence
                </span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Transform your interview preparation with our AI-powered platform. 
                Get personalized feedback on your resume, practice with adaptive mock 
                interviews, and master technical and behavioral questions.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="gradient-accent text-accent-foreground font-semibold px-8 py-6 text-lg hover:shadow-glow transition-all duration-300 animate-pulse-glow"
                onClick={onStartFreeInterview}
              >
                Start Free Interview
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-6 text-lg transition-smooth"
              >
                Watch Demo
              </Button>
            </div>
            
            <div className="flex items-center gap-8 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">10k+</div>
                <div className="text-sm text-muted-foreground">Interviews Practiced</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">95%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">4.9/5</div>
                <div className="text-sm text-muted-foreground">User Rating</div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 gradient-primary rounded-2xl blur-3xl opacity-20 animate-float"></div>
            <img 
              src={heroImage} 
              alt="AI-powered interview preparation platform" 
              className="relative rounded-2xl shadow-elegant w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;