import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  feature?: string;
}

export const UpgradeModal = ({ 
  open, 
  onOpenChange, 
  title = "Upgrade to Pro", 
  description = "You've reached your free limit for this month. Upgrade to Pro for unlimited access and premium features.",
  feature = "Unlimited access"
}: UpgradeModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50 p-0 overflow-hidden">
        <div className="relative h-32 bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 flex items-center justify-center overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-30">
            <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-primary blur-2xl animate-pulse" />
            <div className="absolute bottom-4 right-4 w-16 h-16 rounded-full bg-secondary blur-2xl animate-pulse" />
          </div>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow relative z-10"
          >
            <Crown className="w-8 h-8 text-white" />
          </motion.div>
        </div>
        <div className="p-6 text-center">
          <DialogTitle className="text-2xl font-bold mb-2">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-base mb-6">
            {description}
          </DialogDescription>
          
          <div className="bg-muted/30 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pro Plan Includes:</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Unlimited Interviews</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>200+ Job Roles</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Technical & Behavioral</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Priority AI</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="p-6 pt-0 sm:justify-center flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1">
            Maybe later
          </Button>
          <Button onClick={() => navigate('/pricing')} className="sm:flex-1 bg-primary hover:bg-primary-glow font-bold shadow-glow">
            Get Pro - ₹799/mo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
