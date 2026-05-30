import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subInfo?: string;
  trend?: 'up' | 'down' | 'neutral' | null;
  color?: 'primary' | 'secondary' | 'accent' | 'success';
}

const StatsCard = ({ label, value, icon: Icon, subInfo, trend, color = 'primary' }: StatsCardProps) => {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-indigo-400 bg-indigo-400/10',
    accent: 'text-violet-400 bg-violet-400/10',
    success: 'text-emerald-400 bg-emerald-400/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-[#141414] border border-[#2A2A2A] rounded-3xl p-6 relative overflow-hidden group hover:border-[#444]"
    >
      {/* Background Glow */}
      <div className={cn(
        "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity",
        color === 'primary' ? 'bg-primary' : color === 'secondary' ? 'bg-indigo-400' : 'bg-violet-400'
      )} />

      <div className="flex items-start justify-between relative z-10">
        <div className={cn("p-4 rounded-2xl transition-colors", colorMap[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={cn(
            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'
          )}>
            {trend === 'up' ? '↑ Increasing' : '↓ Decreasing'}
          </div>
        )}
      </div>

      <div className="mt-6 relative z-10">
        <div className="text-4xl font-display font-black text-white">{value}</div>
        <p className="text-sm font-medium text-[#52525B] mt-1">{label}</p>
        
        {subInfo && (
          <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
            <p className="text-xs text-[#A1A1AA] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              {subInfo}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StatsCard;
