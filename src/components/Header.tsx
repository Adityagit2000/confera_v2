import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const Header = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-muted">
      <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">C</span>
          </div>
          <span className="text-xl font-bold text-foreground">Confera</span>
        </div>
        
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">Features</a>
          <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-smooth">How it Works</a>
          <button onClick={() => navigate('/pricing')} className="text-muted-foreground hover:text-foreground transition-smooth">Pricing</button>
        </nav>
        
        <div className="flex items-center space-x-2 sm:space-x-6">
          {user ? (
            <>
              <Button variant="link" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="destructive-link" onClick={signOut} className="hidden sm:inline-flex">
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="link" className="text-[#94a3b8] hover:text-white hidden sm:inline-flex" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
              <Button variant="premium" size="pill" onClick={() => navigate('/auth')}>
                Get Started
              </Button>
            </>
          )}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 px-6 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <a href="#features" className="block py-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" className="block py-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
          <button onClick={() => { navigate('/pricing'); setMobileMenuOpen(false); }} className="block py-2 text-muted-foreground hover:text-foreground transition-colors w-full text-left">Pricing</button>
          {user ? (
            <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="block py-2 text-destructive hover:text-destructive/80 transition-colors w-full text-left">Sign Out</button>
          ) : (
            <button onClick={() => { navigate('/auth'); setMobileMenuOpen(false); }} className="block py-2 text-primary hover:text-primary/80 transition-colors w-full text-left">Sign In</button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;