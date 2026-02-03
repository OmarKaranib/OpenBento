import { useState, useEffect } from 'react';
import { Monitor, Mail, Smartphone } from 'lucide-react';

const MOBILE_BREAKPOINT = 1024;

export function MobileGuard({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      localStorage.setItem('openBentoMobileNotify', email);
      setSubmitted(true);
    }
  };

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <Monitor className="w-24 h-24 text-cyan-400" />
            <Smartphone className="w-10 h-10 text-slate-500 absolute -bottom-2 -right-2" />
            <div className="absolute inset-0 bg-cyan-400/20 blur-3xl rounded-full" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-white">
            Desktop Experience Only
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            OpenBento is optimized for Desktop. Please sign up here to get notified when our mobile version launches.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                required
                data-testid="input-mobile-email"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-cyan-500/25"
              data-testid="button-mobile-notify"
            >
              Notify Me When Ready
            </button>
          </form>
        ) : (
          <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-6">
            <p className="text-emerald-400 font-medium">
              Thanks! We'll notify you at {email} when mobile is ready.
            </p>
          </div>
        )}

        <p className="text-sm text-slate-500">
          For the best experience, please visit OpenBento on a desktop or laptop computer.
        </p>
      </div>
    </div>
  );
}
