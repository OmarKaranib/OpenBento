import { useState } from 'react';
import { X, Crown, Check, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTHLY_PRICE_ID = 'price_1SwkV2PKTwXMfvTHKCHfRDud';
const YEARLY_PRICE_ID = 'price_1SwkV3PKTwXMfvTH085lq6tA';

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
        window.location.href = data.url;
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

  return (
    <div 
      className="fixed inset-0 z-[10002] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-[28rem] mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="pricing-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white z-10"
          data-testid="button-close-pricing"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">OpenBento Pro</h2>
          </div>
          
          <p className="text-center text-slate-400 mb-8">
            Unlock premium features and enhance your dashboard experience
          </p>

          <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-slate-700 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
              data-testid="button-monthly-plan"
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all relative ${
                billingPeriod === 'yearly'
                  ? 'bg-slate-700 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
              data-testid="button-yearly-plan"
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-cyan-500 text-xs font-bold px-2 py-0.5 rounded-full text-white">
                Up to 20% off
              </span>
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-xl p-6 mb-6 border border-slate-700/50">
            <div className="flex items-baseline justify-center gap-2 mb-4">
              <span className="text-5xl font-bold text-white">
                ${billingPeriod === 'monthly' ? '8' : '80'}
              </span>
              <span className="text-slate-400">
                /{billingPeriod === 'monthly' ? 'mo' : 'year'}
              </span>
            </div>
            
            {billingPeriod === 'yearly' && (
              <p className="text-center text-emerald-400 text-sm mb-4">
                Save $16 per year
              </p>
            )}

            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-300">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Unlimited widgets</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Custom backgrounds & themes</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Cross-device sync</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Early access to new features</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleContinue}
            disabled={checkoutMutation.isPending}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-bold rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            data-testid="button-continue-pro"
          >
            {checkoutMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="w-5 h-5" />
                Continue with Pro
              </>
            )}
          </button>

          <p className="text-center text-slate-500 text-xs mt-4">
            Cancel anytime. Secure checkout powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
