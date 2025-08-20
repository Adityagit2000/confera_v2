import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import CTA from "@/components/CTA";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <footer className="bg-card border-t border-muted py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 gradient-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="text-lg font-semibold text-foreground">Confera</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Confera. Powered by Advanced AI Technology.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
