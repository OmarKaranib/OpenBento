// OpenBento Custom Login Page
// Uses Firebase Auth with branded OpenBento styling

import { useState } from 'react';
import { signInWithGoogle } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await signInWithGoogle();
      if (user) {
        onLoginSuccess?.();
      } else {
        setError('Login was cancelled or failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Starry background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-[0.2rem] h-[0.2rem] bg-white rounded-full opacity-60 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[40rem] mx-[2rem]">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-[2rem] p-[4rem] shadow-2xl shadow-cyan-500/10">
          {/* Logo and Branding */}
          <div className="text-center mb-[3rem]">
            <h1 
              className="text-[4rem] font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent mb-[1rem]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              OpenBento
            </h1>
            <p className="text-slate-400 text-[1.4rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Your personalized mission control dashboard
            </p>
          </div>

          {/* Decorative gradient line */}
          <div className="h-[0.2rem] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full mb-[3rem]" />

          {/* Login Section */}
          <div className="space-y-[2rem]">
            <div className="text-center">
              <h2 
                className="text-[2rem] font-semibold text-slate-200 mb-[1rem]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Welcome Back
              </h2>
              <p className="text-slate-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                Sign in to access your dashboard
              </p>
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-[1rem] px-[2rem] py-[1.4rem] bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-[1.2rem] transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              style={{ fontFamily: 'Inter, sans-serif' }}
              data-testid="button-google-login"
            >
              {isLoading ? (
                <Loader2 className="w-[2rem] h-[2rem] animate-spin" />
              ) : (
                <>
                  {/* Google Logo */}
                  <svg className="w-[2rem] h-[2rem]" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-[1.4rem]">Continue with Google</span>
                </>
              )}
            </button>

            {/* Error Message */}
            {error && (
              <div className="p-[1rem] bg-red-500/20 border border-red-500/50 rounded-[0.8rem] text-center">
                <p className="text-red-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-[3rem] text-center">
            <p className="text-slate-500 text-[1.1rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
              By signing in, you agree to our Terms of Service
            </p>
          </div>
        </div>

        {/* Features preview */}
        <div className="mt-[2rem] grid grid-cols-3 gap-[1rem]">
          {['Live Streams', 'News Feeds', 'Custom Layout'].map((feature) => (
            <div 
              key={feature}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/30 rounded-[1rem] p-[1.2rem] text-center"
            >
              <span className="text-slate-400 text-[1.1rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
