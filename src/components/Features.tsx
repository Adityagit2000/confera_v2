import { Card } from "@/components/ui/card";

const Features = () => {
  const features = [
    {
      icon: "🧠",
      title: "AI Resume Intelligence",
      description: "Advanced parsing and analysis of your resume with ATS scoring, skill gap identification, and improvement suggestions."
    },
    {
      icon: "🎯",
      title: "Adaptive Mock Interviews",
      description: "Dynamic question generation that adapts to your performance, covering technical, behavioral, and domain-specific topics."
    },
    {
      icon: "🗣️",
      title: "Speech & Communication Analysis",
      description: "Real-time analysis of clarity, confidence, pace, and filler words with detailed verbal feedback scores."
    },
    {
      icon: "📊",
      title: "Performance Analytics",
      description: "Comprehensive scoring across resume quality, technical skills, communication, and behavioral responses."
    },
    {
      icon: "🚀",
      title: "Career Path Recommendations",
      description: "Personalized skill development roadmap and career progression suggestions based on your profile."
    },
    {
      icon: "🤖",
      title: "AI Interview Assistant",
      description: "Vapi-powered voice interviews with different interviewer personalities and real-time guidance."
    }
  ];

  return (
    <section id="features" className="py-24 px-6">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Powered by Advanced{" "}
            <span className="gradient-hero bg-clip-text text-transparent">
              AI Technology
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our comprehensive platform combines cutting-edge AI models with real interview scenarios 
            to give you the most realistic practice experience.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="p-8 hover:shadow-card transition-all duration-300 hover:-translate-y-2 border-muted/50 bg-card/50 backdrop-blur-sm"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
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