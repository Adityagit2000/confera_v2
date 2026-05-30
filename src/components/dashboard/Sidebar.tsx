import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Mic, 
  FolderClock, 
  BarChart3, 
  CreditCard, 
  Settings, 
  LogOut,
  HelpCircle,
  LayoutDashboard,
  ClipboardList,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Sidebar = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Resume Analysis', icon: FileText, path: '/ats' },
    { label: 'Mock Interview', icon: Mic, path: '/mock-interview' },
    { label: 'Practice Tests', icon: GraduationCap, path: '/practice-tests' },
    { label: 'Past Sessions', icon: FolderClock, path: '/sessions' }, // Placeholder path
    { label: 'Analytics', icon: BarChart3, path: '/analytics' }, // Placeholder path
    { label: 'Pricing', icon: CreditCard, path: '/pricing' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#0A0A0A] border-r border-[#2A2A2A] flex flex-col z-50 overflow-hidden">
      {/* Brand */}
      <div className="p-8">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-2xl font-display font-bold text-white tracking-tight">Confera</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        <p className="px-4 text-[10px] font-mono uppercase tracking-widest text-[#52525B] mb-4">
          Main Menu
        </p>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
              isActive(item.path) 
                ? "bg-primary/10 text-primary" 
                : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-colors",
              isActive(item.path) ? "text-primary" : "text-[#52525B] group-hover:text-[#A1A1AA]"
            )} />
            <span className="font-bold">{item.label}</span>
            {isActive(item.path) && (
              <motion.div 
                layoutId="active-pill"
                className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-glow" 
              />
            )}
          </Link>
        ))}
      </nav>

      {/* Footer / User Area */}
      <div className="p-6 mt-auto border-t border-[#2A2A2A] space-y-4 bg-black/20 backdrop-blur-md">
        <Link 
          to="/settings"
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-[#A1A1AA] hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5 text-[#52525B]" />
          <span className="text-sm font-medium">Settings</span>
        </Link>
        <Link 
          to="/help"
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-[#A1A1AA] hover:text-white transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-[#52525B]" />
          <span className="text-sm font-medium">Support</span>
        </Link>

        <div className="pt-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-[#52525B] truncate">
                Free Plan
              </p>
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 text-[#52525B] hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
    </aside>
  );
};

import { motion } from 'framer-motion';
export default Sidebar;
