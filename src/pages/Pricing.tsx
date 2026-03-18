import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Zap, Crown, Star, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

const Pricing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePayment = async (billingCycle: 'monthly' | 'yearly') => {
    if (!user) {
      toast({ title: "Identification required", description: "Please sign in to upgrade your plan." });
      navigate('/auth');
      return;
    }

    setLoading(billingCycle);
    try {
      // Create order via edge function
      console.log('Calling create-order with:', { plan: 'pro', billingCycle, userId: user.id });
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-order', {
        body: { plan: 'pro', billingCycle, userId: user.id }
      });

      if (orderError) {
        console.error('Order error details:', orderError);
        console.error('Order error message:', orderError.message);
        throw orderError;
      }

      console.log('Order data received:', orderData);

      // Load Razorpay script
      const loadScript = () => {
        return new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const res = await loadScript();
      if (!res) {
        throw new Error('Razorpay SDK failed to load. Check your internet connection.');
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Confera',
        description: `Pro Plan - ${billingCycle === 'monthly' ? '₹499/month' : '₹3999/year'}`,
        order_id: orderData.orderId,
        prefill: {
          email: user.email,
          name: user.user_metadata?.name || ''
        },
        theme: { color: '#00d4ff' },
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.id,
                plan: 'pro',
                billingCycle,
                amount: orderData.amount
              }
            });

            if (verifyError) throw verifyError;

            if (verifyData.success) {
              toast({ 
                title: "Payment successful!", 
                description: "Welcome to Confera Pro! Your account has been upgraded.",
              });
              navigate('/dashboard');
            }
          } catch (err: any) {
            toast({ 
              title: "Verification failed", 
              description: err.message || "Something went wrong during verification.", 
              variant: "destructive" 
            });
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(null);
          }
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Full payment error:', error);
      toast({ 
        title: "Payment Failed", 
        description: error.message || "Unknown error occurred",
        variant: "destructive" 
      });
      setLoading(null);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: '₹0',
      description: 'Perfect for getting started',
      features: [
        '2 mock interviews per month',
        '1 resume analysis per month',
        'Basic feedback report',
        'No credit card required'
      ],
      notIncluded: [
        'Unlimited interviews',
        'Detailed McKinsey score',
        'Priority AI responses',
        'Download PDF reports'
      ],
      buttonText: 'Current Plan',
      buttonVariant: 'outline' as const,
      disabled: true
    },
    {
      name: 'Pro Monthly',
      price: '₹499',
      interval: '/month',
      description: 'For serious candidates',
      features: [
        'Unlimited mock interviews',
        'Unlimited resume analysis',
        'Detailed McKinsey readiness score',
        'All 6 interview types',
        'Priority AI responses',
        'Download PDF reports'
      ],
      buttonText: 'Upgrade to Pro',
      buttonVariant: 'default' as const,
      highlight: false,
      billingCycle: 'monthly' as const
    },
    {
      name: 'Pro Yearly',
      price: '₹3999',
      interval: '/year',
      badge: 'Best Value (Save 33%)',
      description: 'Long-term career success',
      features: [
        'All Pro Monthly features',
        'Priority 24/7 support',
        'Early access to new features',
        'Best value for job seekers'
      ],
      buttonText: 'Get Pro Yearly',
      buttonVariant: 'default' as const,
      highlight: true,
      billingCycle: 'yearly' as const
    }
  ];

  return (
    <div className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight"
          >
            Upgrade Your <span className="text-gradient">Career Path</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Choose the plan that fits your preparation needs. Master your interviews with AI-powered feedback.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (index + 1) }}
            >
              <Card className={`relative h-full flex flex-col overflow-hidden border-border/50 group transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm ${plan.highlight ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'bg-card'}`}>
                {plan.badge && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                      {plan.badge}
                    </div>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    {plan.name === 'Free' ? <Zap className="w-5 h-5 text-muted-foreground" /> : plan.highlight ? <Crown className="w-5 h-5 text-primary" /> : <Star className="w-5 h-5 text-secondary" />}
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.interval}</span>
                  </div>
                  <CardDescription className="mt-4">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5 rounded-full bg-success/10 p-0.5">
                          <Check className="w-3.5 h-3.5 text-success" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded?.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground opacity-60">
                        <div className="mt-0.5 rounded-full bg-destructive/10 p-0.5">
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full font-bold h-12 ${plan.highlight ? 'bg-primary hover:bg-primary-glow shadow-glow' : ''}`} 
                    variant={plan.buttonVariant}
                    disabled={plan.disabled || (loading !== null)}
                    onClick={() => plan.billingCycle && handlePayment(plan.billingCycle)}
                  >
                    {loading === plan.billingCycle ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      <>
                        {plan.buttonText}
                        {!plan.disabled && <ArrowRight className="w-4 h-4 ml-2" />}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-12">Compare Plans</h2>
          <div className="glass-card rounded-2xl border border-border/50 overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left py-6 px-8 font-semibold">Features</th>
                  <th className="text-center py-6 px-4 font-semibold">Free</th>
                  <th className="text-center py-6 px-4 font-semibold text-primary">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  { name: 'Mock Interviews', free: '2 / month', pro: 'Unlimited' },
                  { name: 'Resume Analysis', free: '1 / month', pro: 'Unlimited' },
                  { name: 'McKinsey Readiness Score', free: <X className="w-5 h-5 mx-auto text-destructive/40" />, pro: <Check className="w-5 h-5 mx-auto text-success" /> },
                  { name: 'Advanced AI Career Advice', free: <X className="w-5 h-5 mx-auto text-destructive/40" />, pro: <Check className="w-5 h-5 mx-auto text-success" /> },
                  { name: 'PDF Reports Download', free: <X className="w-5 h-5 mx-auto text-destructive/40" />, pro: <Check className="w-5 h-5 mx-auto text-success" /> },
                  { name: 'Priority AI Processing', free: <X className="w-5 h-5 mx-auto text-destructive/40" />, pro: <Check className="w-5 h-5 mx-auto text-success" /> },
                  { name: 'All Interview Types (6+)', free: 'Basic Types', pro: 'Full Catalog' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                    <td className="py-5 px-8 text-sm font-medium">{row.name}</td>
                    <td className="py-5 px-4 text-center text-sm text-muted-foreground">{row.free}</td>
                    <td className="py-5 px-4 text-center text-sm font-semibold text-primary">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-20 text-center text-muted-foreground">
          <p>Questions? Contact our support at <span className="text-primary cursor-pointer hover:underline">support@confera.ai</span></p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
