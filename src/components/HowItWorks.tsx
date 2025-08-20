import { Card } from "@/components/ui/card";

const HowItWorks = () => {
  const steps = [
    {
      step: "01",
      title: "Upload Your Resume",
      description: "Our AI parser analyzes your resume structure, content, and ATS compatibility, providing instant feedback and optimization suggestions.",
      highlight: "AI Resume Intelligence"
    },
    {
      step: "02", 
      title: "Choose Interview Type",
      description: "Select from technical coding, system design, behavioral, or HR interviews. Our system adapts questions based on your experience level.",
      highlight: "Adaptive Questions"
    },
    {
      step: "03",
      title: "Practice with AI Interviewer",
      description: "Engage in realistic voice-driven interviews with our AI assistant that provides real-time feedback and guidance.",
      highlight: "Live AI Coaching"
    },
    {
      step: "04",
      title: "Get Detailed Analytics",
      description: "Receive comprehensive performance reports covering technical accuracy, communication skills, and behavioral responses.",
      highlight: "Performance Insights"
    }
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
            How Confera{" "}
            <span className="gradient-hero bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our streamlined process takes you from resume analysis to interview mastery 
            in just a few simple steps.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card 
              key={index}
              className="p-8 text-center hover:shadow-card transition-all duration-300 hover:-translate-y-2 border-muted/50 bg-card/50 backdrop-blur-sm relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 gradient-accent"></div>
              <div className="text-6xl font-bold text-primary/20 mb-4">
                {step.step}
              </div>
              <div className="inline-block px-3 py-1 bg-accent/10 text-accent text-sm font-medium rounded-full mb-4">
                {step.highlight}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;