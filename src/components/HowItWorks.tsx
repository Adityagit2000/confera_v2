import { FileText, Cpu, Mic, LineChart } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      step: "01",
      title: "Upload Your Resume",
      description: "Our AI parser analyzes your resume structure, content, and ATS compatibility, providing instant feedback and optimization suggestions.",
      highlight: "AI Resume Intelligence",
      icon: <FileText className="w-6 h-6 text-primary" />
    },
    {
      step: "02", 
      title: "Choose Interview Type",
      description: "Select from technical coding, system design, behavioral, or HR interviews. Our system adapts questions based on your experience level.",
      highlight: "Adaptive Questions",
      icon: <Cpu className="w-6 h-6 text-secondary" />
    },
    {
      step: "03",
      title: "Practice with AI",
      description: "Engage in realistic voice-driven interviews with our AI assistant that provides real-time feedback and guidance.",
      highlight: "Live AI Coaching",
      icon: <Mic className="w-6 h-6 text-primary" />
    },
    {
      step: "04",
      title: "Get Detailed Analytics",
      description: "Receive comprehensive performance reports covering technical accuracy, communication skills, and behavioral responses.",
      highlight: "Performance Insights",
      icon: <LineChart className="w-6 h-6 text-secondary" />
    }
  ];

  return (
    <section id="how-it-works" className="py-32 px-6 relative">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight">
            How Confera{" "}
            <span className="text-gradient">
              Works
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our streamlined process takes you from resume analysis to interview mastery 
            in just a few simple steps.
          </p>
        </div>
        
        <div className="relative">
          {/* Vertical joining line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-secondary/50 to-transparent -translate-x-1/2 hidden md:block"></div>
          
          <div className="space-y-12 md:space-y-24">
            {steps.map((step, index) => {
              const isEven = index % 2 === 0;
              const highlightColor = isEven ? 'primary' : 'secondary';
              const hoverBorder = isEven ? 'hover:border-primary/50' : 'hover:border-secondary/50';
              return (
                <div key={index} className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  {/* Mobile: Single card for all steps */}
                  <div className="w-full md:hidden">
                    <div className={`glass-card p-6 rounded-2xl ${hoverBorder} transition-colors`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-full glass-card border-2 border-${highlightColor}/50 flex items-center justify-center shadow-glow shrink-0`}>
                          <span className={`font-bold text-sm bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary`}>
                            {step.step}
                          </span>
                        </div>
                        <div className={`inline-block px-3 py-1 bg-${highlightColor}/10 text-${highlightColor} border border-${highlightColor}/20 text-xs font-medium rounded-full`}>
                          {step.highlight}
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-3">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Desktop: Left Side (Content on evens, Empty on odds) */}
                  <div className={`hidden md:block w-full md:w-1/2 ${isEven ? 'md:pr-16 md:text-right' : ''}`}>
                    {isEven && (
                      <div className="glass-card p-8 rounded-2xl hover:border-primary/50 transition-colors">
                        <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-medium rounded-full mb-4">
                          {step.highlight}
                        </div>
                        <h3 className="text-2xl font-semibold text-foreground mb-4">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Center Node (Desktop only) */}
                  <div className="w-16 h-16 rounded-full glass-card border-2 border-primary/50 items-center justify-center shadow-glow z-10 hidden md:flex shrink-0">
                    <div className="absolute inset-0 bg-background/50 rounded-full backdrop-blur-md"></div>
                    <div className="relative z-10 font-bold bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary">
                      {step.step}
                    </div>
                  </div>

                  {/* Desktop: Right Side (Content on odds, Empty on evens) */}
                  <div className={`hidden md:block w-full md:w-1/2 md:pl-16 ${!isEven ? 'md:text-left' : ''}`}>
                    {!isEven && (
                      <div className="glass-card p-8 rounded-2xl hover:border-secondary/50 transition-colors">
                        <div className="inline-block px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 text-xs font-medium rounded-full mb-4">
                          {step.highlight}
                        </div>
                        <h3 className="text-2xl font-semibold text-foreground mb-4">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;