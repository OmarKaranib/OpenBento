import { useState, useEffect } from 'react';
import { Crown, Check, Shield, CreditCard, Loader2, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { MONTHLY_PRICE_ID, YEARLY_PRICE_ID } from '@/components/pricing-modal';

export default function Checkout() {
  const [, setLocation] = useLocation();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan') as 'monthly' | 'yearly' | null;
    
    if (planParam && ['monthly', 'yearly'].includes(planParam)) {
      setPlan(planParam);
    }
  }, []);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe/create-checkout-session', {
        priceId: plan === 'monthly' ? MONTHLY_PRICE_ID : YEARLY_PRICE_ID,
        billingPeriod: plan,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      console.error('Checkout error:', error);
    }
  });

  const handleCheckout = () => {
    checkoutMutation.mutate();
  };

  const price = plan === 'monthly' ? '$8' : '$80';
  const period = plan === 'monthly' ? '/month' : '/year';
  const billedText = plan === 'monthly' ? 'Billed monthly' : 'Billed annually';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[900px] grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="order-2 lg:order-1">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-8 text-slate-400"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
            <h2 className="text-xl font-bold text-white mb-6">Order Summary</h2>
            
            <div className="flex items-center justify-between py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-slate-900" />
                </div>
                <div>
                  <p className="text-white font-medium">OpenBento Pro</p>
                  <p className="text-slate-400 text-sm">{billedText}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{price}</p>
                <p className="text-slate-400 text-sm">{period}</p>
              </div>
            </div>

            <div className="py-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between text-slate-300">
                <span>Subtotal</span>
                <span>{price}</span>
              </div>
              {plan === 'yearly' && (
                <div className="flex items-center justify-between text-emerald-400 mt-2">
                  <span>You save</span>
                  <span>$16/year</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-4 text-lg">
              <span className="text-white font-bold">Total</span>
              <span className="text-white font-bold">{price}{period}</span>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={checkoutMutation.isPending}
              className="w-full mt-6 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold"
              data-testid="button-checkout-stripe"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Redirecting to Stripe...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Continue to Payment
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-sm">
              <Shield className="w-4 h-4" />
              <span>Secured by Stripe</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-6 text-slate-500 text-xs">
            <button className="hover:text-slate-300 transition-colors">Terms of Service</button>
            <button className="hover:text-slate-300 transition-colors">Privacy Policy</button>
            <button className="hover:text-slate-300 transition-colors">Refund Policy</button>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl p-8 border-2 border-amber-500/30 ring-2 ring-amber-500/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Crown className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">OpenBento Pro</h1>
                <p className="text-slate-400">Premium Dashboard Experience</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="relative flex-1">
                <Button
                  variant={plan === 'monthly' ? 'secondary' : 'outline'}
                  onClick={() => setPlan('monthly')}
                  className="w-full flex flex-col h-auto py-3"
                  data-testid="checkout-monthly-toggle"
                >
                  <span className="text-lg font-bold">$8/mo</span>
                  <span className="text-xs text-slate-400">Monthly billing</span>
                </Button>
              </div>
              <div className="relative flex-1">
                <Button
                  variant={plan === 'yearly' ? 'secondary' : 'outline'}
                  onClick={() => setPlan('yearly')}
                  className="w-full flex flex-col h-auto py-3"
                  data-testid="checkout-yearly-toggle"
                >
                  <span className="text-lg font-bold">$80/yr</span>
                  <span className="text-xs text-slate-400">Annual billing</span>
                </Button>
                <span className="absolute -top-2 -right-2 bg-cyan-500 text-xs font-bold px-2 py-0.5 rounded-full text-white pointer-events-none">
                  Save 17%
                </span>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              What's Included
            </h3>
            
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Unlimited Streams</p>
                  <p className="text-slate-400 text-sm">No limits on your dashboard widgets</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Ad-Free Experience</p>
                  <p className="text-slate-400 text-sm">Clean dashboard without interruptions</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Save Layout</p>
                  <p className="text-slate-400 text-sm">Keep your layouts synced across devices</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Early Access</p>
                  <p className="text-slate-400 text-sm">Be the first to try new features</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Priority Support</p>
                  <p className="text-slate-400 text-sm">Get help when you need it</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
