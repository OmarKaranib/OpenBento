import { useState } from 'react';
import { X, Crown, Check, X as XIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MONTHLY_PRICE_ID = 'price_1SwkV2PKTwXMfvTHKCHfRDud';
export const YEARLY_PRICE_ID = 'price_1SwkV3PKTwXMfvTH085lq6tA';

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest('POST', '/api/stripe/create-checkout-session', {
        priceId,
        billingPeriod,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.assign(data.url);
      }
    },
    onError: (error) => {
      console.error('Checkout error:', error);
    }
  });

  const handleContinue = () => {
    const priceId = billingPeriod === 'monthly' ? MONTHLY_PRICE_ID : YEARLY_PRICE_ID;
    checkoutMutation.mutate(priceId);
  };

  if (!isOpen) return null;

  const price = billingPeriod === 'monthly' ? '$8' : '$80';
  const period = billingPeriod === 'monthly' ? '/mo' : '/year';

  return (
    <div 
      className="fixed inset-0 z-[10002] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-[48rem] mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="pricing-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-12 h-12 flex items-center justify-center rounded-xl bg-slate-700 border-2 border-slate-500 text-white hover:bg-slate-600 hover:border-slate-400 transition-all duration-200 shadow-lg"
          data-testid="button-close-pricing"
        >
          <X className="w-7 h-7" />
        </button>

        <div className="p-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
          </div>
          
          <p className="text-center text-slate-400 mb-6">
            Compare features and pick the best option for you
          </p>

          <div className="flex justify-center mb-8">
            <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
              <Button
                variant={billingPeriod === 'monthly' ? 'secondary' : 'ghost'}
                onClick={() => setBillingPeriod('monthly')}
                data-testid="button-monthly-plan"
              >
                Monthly
              </Button>
              <Button
                variant={billingPeriod === 'yearly' ? 'secondary' : 'ghost'}
                onClick={() => setBillingPeriod('yearly')}
                className="gap-2"
                data-testid="button-yearly-plan"
              >
                Yearly
                <span className="bg-cyan-500 text-xs font-bold px-2 py-0.5 rounded-full text-white">
                  Up to 20% off
                </span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-300 mb-2">Free</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-slate-400">$0</span>
                  <span className="text-slate-500">/forever</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-400">
                  <Check className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <span>Up to 6 streams</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <Check className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <span>Ads included</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <XIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>Save Layout</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <XIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>Early Access</span>
                </div>
              </div>

              <Button
                variant="secondary"
                className="w-full mt-6"
                disabled
              >
                Current Plan
              </Button>
            </div>

            <div className="relative bg-slate-800 rounded-xl p-6 border-2 border-amber-500/50 ring-2 ring-amber-500/20">
              <div className="absolute -top-3 right-4 bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">
                RECOMMENDED
              </div>
              
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xl font-bold text-white">Pro</h3>
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">{price}</span>
                  <span className="text-slate-400">{period}</span>
                </div>
                {billingPeriod === 'yearly' && (
                  <p className="text-emerald-400 text-sm mt-2">Save $16 per year</p>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Unlimited streams</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>No ads</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Save Layout</span>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Early Access</span>
                </div>
              </div>

              <Button
                onClick={handleContinue}
                disabled={checkoutMutation.isPending}
                className="w-full mt-6 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold"
                data-testid="button-continue-pro"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Continue with Pro
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-center text-slate-500 text-xs">
            Cancel anytime. Secure checkout powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
