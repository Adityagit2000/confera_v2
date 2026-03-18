import { Card } from "@/components/ui/card";
import { BrainCircuit, Target, MessageSquare, BarChart3, Compass, Bot } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <BrainCircuit className="w-8 h-8" />,
      title: "AI Resume Intelligence",
      description: "Advanced parsing and analysis with our ATS Resume Optimizer 2026. Skill gap identification and improvement suggestions."
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Focused Interview Prep",
      description: "Specialized tracks for Consulting Interview Prep, Big4 Interview Prep, Big3 Interview Prep, and FAANG Interview Prep."
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Speech & Comm Analysis",
      description: "Real-time analysis of clarity, confidence, pace, and filler words with detailed verbal feedback scores."
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Performance Analytics",
      description: "Comprehensive scoring across resume quality, technical skills, communication, and behavioral responses."
    },
    {
      icon: <Compass className="w-8 h-8" />,
      title: "Career Recommendations",
      description: "Personalized skill development roadmap and career progression suggestions based on your profile."
    },
    {
      icon: <Bot className="w-8 h-8" />,
      title: "AI Interview Assistant",
      description: "Vapi-powered voice interviews with different interviewer personalities and real-time guidance."
    }
  ];

  return (
    <section id="features" className="py-24 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight">
            Powered by Advanced{" "}
            <span className="text-gradient">
              AI Technology
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our comprehensive platform combines cutting-edge AI models with real interview scenarios 
            to give you the most realistic practice experience.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group p-8 glass-card transition-all duration-300 hover:-translate-y-2 cursor-default relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="text-muted-foreground group-hover:text-primary transition-colors duration-300 mb-6 group-hover:drop-shadow-[0_0_15px_rgba(0,212,255,0.6)]">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground/80 leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;