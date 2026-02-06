import { X, Crown, Sparkles, Image, LayoutGrid, UserPlus } from 'lucide-react';

interface UpgradePopupProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: 'blocks' | 'background';
  isAuthenticated?: boolean;
  openLoginModal?: (reason?: string) => void;
}

export function UpgradePopup({ isOpen, onClose, feature = 'blocks', isAuthenticated, openLoginModal }: UpgradePopupProps) {
  if (!isOpen) return null;

  const isAnonymous = !isAuthenticated;

  const featureMessage = feature === 'blocks' 
    ? (isAnonymous ? 'Sign up to unlock more blocks and save your dashboard.' : 'Upgrade to OpenBento Pro for unlimited blocks.')
    : (isAnonymous ? 'Sign up to unlock custom background images.' : 'Upgrade to OpenBento Pro to unlock custom background images.');

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="upgrade-popup-overlay"
    >
      <div 
        className="relative w-full max-w-[40rem] mx-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 shadow-2xl shadow-amber-500/10"
        style={{ borderRadius: '1.2rem' }}
        onClick={(e) => e.stopPropagation()}
        data-testid="upgrade-popup-content"
      >
        <button 
          onClick={onClose}
          className="absolute top-[1rem] right-[1rem] p-[0.6rem] text-slate-400 hover:text-white transition-colors"
          data-testid="upgrade-popup-close"
        >
          <X className="w-[2rem] h-[2rem]" />
        </button>

        <div className="p-[3rem] text-center">
          <div className="mx-auto w-[6rem] h-[6rem] bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-[2rem]" style={{ borderRadius: '1.2rem' }}>
            <Crown className="w-[3.2rem] h-[3.2rem] text-slate-900" />
          </div>
          
          <h2 className="text-[2.4rem] font-bold text-white mb-[1rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
            OpenBento Pro
          </h2>
          
          <p className="text-[1.4rem] text-slate-300 mb-[2.5rem]">
            {featureMessage}
          </p>

          <div className="grid grid-cols-2 gap-[1.5rem] mb-[3rem]">
            <div className="p-[1.5rem] bg-slate-800/50 border border-slate-700/50" style={{ borderRadius: '1rem' }}>
              <LayoutGrid className="w-[2.4rem] h-[2.4rem] text-amber-400 mx-auto mb-[0.8rem]" />
              <p className="text-[1.2rem] font-semibold text-white">Unlimited Blocks</p>
              <p className="text-[1rem] text-slate-400">Build your perfect dashboard</p>
            </div>
            <div className="p-[1.5rem] bg-slate-800/50 border border-slate-700/50" style={{ borderRadius: '1rem' }}>
              <Image className="w-[2.4rem] h-[2.4rem] text-amber-400 mx-auto mb-[0.8rem]" />
              <p className="text-[1.2rem] font-semibold text-white">Custom Backgrounds</p>
              <p className="text-[1rem] text-slate-400">Upload your own images</p>
            </div>
          </div>

          <div className="flex gap-[1rem] justify-center">
            <button
              onClick={onClose}
              className="px-[2rem] py-[1rem] text-[1.2rem] font-semibold text-slate-300 hover:text-white transition-colors"
              data-testid="upgrade-popup-cancel"
            >
              Maybe Later
            </button>
            {isAnonymous ? (
              <button
                onClick={() => {
                  onClose();
                  openLoginModal?.('Sign up to unlock more blocks and save your dashboard.');
                }}
                className="flex items-center gap-[0.8rem] px-[2.5rem] py-[1.2rem] bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-[1.3rem] transition-all shadow-lg shadow-cyan-500/30"
                style={{ borderRadius: '0.8rem' }}
                data-testid="upgrade-popup-signup"
              >
                <UserPlus className="w-[1.6rem] h-[1.6rem]" />
                Sign up to unlock more
              </button>
            ) : (
              <a 
                href="/api/login"
                className="flex items-center gap-[0.8rem] px-[2.5rem] py-[1.2rem] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-bold text-[1.3rem] transition-all shadow-lg shadow-amber-500/30"
                style={{ borderRadius: '0.8rem' }}
                data-testid="upgrade-popup-upgrade"
              >
                <Sparkles className="w-[1.6rem] h-[1.6rem]" />
                Upgrade to Pro
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
