import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-muted">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">C</span>
          </div>
          <span className="text-xl font-bold text-foreground">Confera</span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">Features</a>
          <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-smooth">How it Works</a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-smooth">Pricing</a>
        </nav>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={signOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
              <Button variant="hero" className="gradient-accent text-accent-foreground font-semibold hover:shadow-glow transition-all duration-300" onClick={() => navigate('/auth')}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;