import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Copy, Gift, Users, IndianRupee, ExternalLink, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReferralStats {
  referralCode: string | null;
  totalEarningsPaise: number;
  successfulReferrals: number;
  pendingReferrals: number;
}

export function ReferralSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats>({
    referralCode: null,
    totalEarningsPaise: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
  });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchReferralStats();
  }, [user?.id]);

  const fetchReferralStats = async () => {
    if (!user?.id) return;
    try {
      // Get referral code from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      // Get referral counts
      const { data: referrals } = await supabase
        .from('referrals')
        .select('id, status')
        .eq('referrer_id', user.id);

      const successfulReferrals = referrals?.filter(r => r.status === 'converted').length || 0;
      const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;

      // Get total earnings
      const { data: earnings } = await supabase
        .from('referral_earnings')
        .select('amount_paise')
        .eq('user_id', user.id);

      const totalEarningsPaise = earnings?.reduce((sum, e) => sum + (e.amount_paise || 0), 0) || 0;

      setStats({
        referralCode: profile?.referral_code || null,
        totalEarningsPaise,
        successfulReferrals,
        pendingReferrals,
      });
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = stats.referralCode
    ? `https://conferav2.vercel.app?ref=${stats.referralCode}`
    : null;

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Referral link copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the link manually.', variant: 'destructive' });
    }
  };

  const handleRequestPayout = () => {
    const earningsRupees = (stats.totalEarningsPaise / 100).toFixed(2);
    const subject = encodeURIComponent(`Confera Referral Payout Request — ₹${earningsRupees}`);
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to request a payout for my referral earnings.\n\nReferral Code: ${stats.referralCode}\nTotal Earnings: ₹${earningsRupees}\nSuccessful Referrals: ${stats.successfulReferrals}\nUser Email: ${user?.email}\n\nThanks!`
    );
    window.open(`mailto:aditya06.jha@gmail.com?subject=${subject}&body=${body}`, '_blank');
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-border/50 bg-card/30 animate-pulse h-48" />
    );
  }

  if (!stats.referralCode) {
    return null; // Code not generated yet — skip rendering
  }

  const earningsRupees = (stats.totalEarningsPaise / 100).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/10">
            <Gift className="w-5 h-5 text-green-400" />
          </div>
          Referral Program
        </h3>
      </div>

      <div className="glass-card rounded-2xl border border-border/50 bg-card/30 overflow-hidden">
        {/* Referral Link Section */}
        <div className="p-6 border-b border-border/30">
          <p className="text-sm text-muted-foreground mb-3">
            Share your link — when someone signs up and goes Pro, you earn <span className="text-green-400 font-bold">10% cash</span> from their payment.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted/30 rounded-lg px-4 py-3 text-sm font-mono text-foreground/80 truncate border border-border/30">
              {referralLink}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0 h-11 px-4 border-border/30 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Your code: <span className="font-mono font-bold text-primary">{stats.referralCode}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 divide-x divide-border/30">
          <div className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <IndianRupee className="w-4 h-4 text-green-400" />
              <span className="text-2xl font-extrabold text-foreground">₹{earningsRupees}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Total Earnings</p>
          </div>
          <div className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-2xl font-extrabold text-foreground">{stats.successfulReferrals}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Converted</p>
          </div>
          <div className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-4 h-4 text-yellow-400" />
              <span className="text-2xl font-extrabold text-foreground">{stats.pendingReferrals}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Pending</p>
          </div>
        </div>

        {/* Payout Button */}
        {stats.totalEarningsPaise > 0 && (
          <div className="p-4 border-t border-border/30 bg-muted/10">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPayout}
              className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/50 transition-all"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Request Payout — ₹{earningsRupees}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
