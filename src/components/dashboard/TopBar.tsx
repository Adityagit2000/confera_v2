import { Search, Bell, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

interface TopBarProps {
  onMenuClick?: () => void;
}

const TopBar = ({ onMenuClick }: TopBarProps) => {
  const { user } = useAuth();
  const { profile } = useSubscription();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <header className="h-20 border-b border-[#2A2A2A] bg-black/50 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-[#A1A1AA] hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="hidden md:flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">
            {getGreeting()}, <span className="text-primary capitalize">{profile?.name?.split(' ')[0] || user?.email?.split('@')[0]}</span>
          </h1>
          <span className="text-[#52525B]">👋</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="hidden lg:flex relative w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B] group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search interviews..." 
            className="h-10 bg-white/[0.04] border-[#2A2A2A] pl-10 text-sm focus:border-primary transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-[#A1A1AA] hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-glow" />
        </button>

        {/* User Avatar */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/[0.04] flex items-center justify-center text-primary font-bold shadow-lg">
          {user?.email?.[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
