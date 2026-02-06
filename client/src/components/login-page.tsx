import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } from '@/lib/supabase';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

export function LoginPage({ onLoginSuccess }: LoginPageProps = {}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setSuccess('Check your email for a password reset link.');
          setMode('login');
        }
      } else if (mode === 'signup') {
        const { user, error } = await signUpWithEmail(email, password);
        if (error) {
          setError(error.message);
        } else if (user) {
          setSuccess('Check your email to confirm your account.');
        }
      } else {
        const { user, error } = await signInWithEmail(email, password);
        if (error) {
          setError(error.message);
        } else if (user) {
          onLoginSuccess?.();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google login.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'reset': return 'Reset Password';
      default: return 'Welcome Back';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signup': return 'Sign up to save your dashboard';
      case 'reset': return 'Enter your email to reset password';
      default: return 'Sign in to access your dashboard';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
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

      <div className="relative z-10 w-full max-w-[40rem] mx-[2rem]">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-[2rem] p-[4rem] shadow-2xl shadow-cyan-500/10">
          <div className="text-center mb-[3rem]">
            <div className="flex items-center justify-center gap-[1rem] mb-[1rem]">
              <img 
                src="/t.png" 
                alt="OpenBento Logo" 
                className="h-[4rem] w-auto object-contain"
                data-testid="img-login-logo"
              />
              <h1 
                className="text-[4rem] font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                OpenBento
              </h1>
            </div>
            <p className="text-slate-400 text-[1.4rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Your personalized mission control dashboard
            </p>
          </div>

          <div className="h-[0.2rem] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full mb-[3rem]" />

          <div className="space-y-[2rem]">
            <div className="text-center">
              <h2 
                className="text-[2rem] font-semibold text-slate-200 mb-[1rem]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {getTitle()}
              </h2>
              <p className="text-slate-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                {getSubtitle()}
              </p>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-[1.5rem]">
              <div className="relative">
                <Mail className="absolute left-[1.2rem] top-1/2 -translate-y-1/2 w-[1.8rem] h-[1.8rem] text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full pl-[4rem] pr-[1.5rem] py-[1.2rem] bg-slate-700/50 border border-slate-600/50 rounded-[1rem] text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-[1.4rem]"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  data-testid="input-email"
                />
              </div>

              {mode !== 'reset' && (
                <div className="relative">
                  <Lock className="absolute left-[1.2rem] top-1/2 -translate-y-1/2 w-[1.8rem] h-[1.8rem] text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full pl-[4rem] pr-[4rem] py-[1.2rem] bg-slate-700/50 border border-slate-600/50 rounded-[1rem] text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-[1.4rem]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-[1.2rem] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-[1.8rem] h-[1.8rem]" />
                    ) : (
                      <Eye className="w-[1.8rem] h-[1.8rem]" />
                    )}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-[1rem] px-[2rem] py-[1.4rem] bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-[1.2rem] transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                style={{ fontFamily: 'Inter, sans-serif' }}
                data-testid="button-email-submit"
              >
                {isLoading ? (
                  <Loader2 className="w-[2rem] h-[2rem] animate-spin" />
                ) : (
                  <span className="text-[1.4rem]">
                    {mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Send Reset Link' : 'Sign In'}
                  </span>
                )}
              </button>
            </form>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="w-full text-center text-slate-400 hover:text-cyan-400 text-[1.2rem] transition-colors"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Forgot password?
              </button>
            )}

            <div className="relative flex items-center gap-[1rem]">
              <div className="flex-1 h-[0.1rem] bg-slate-600" />
              <span className="text-slate-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>or</span>
              <div className="flex-1 h-[0.1rem] bg-slate-600" />
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-[1rem] px-[2rem] py-[1.4rem] bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-[1.2rem] transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              style={{ fontFamily: 'Inter, sans-serif' }}
              data-testid="button-google-login"
            >
              <svg className="w-[2rem] h-[2rem]" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-[1.4rem]">Continue with Google</span>
            </button>

            {error && (
              <div className="p-[1rem] bg-red-500/20 border border-red-500/50 rounded-[0.8rem] text-center">
                <p className="text-red-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div className="p-[1rem] bg-green-500/20 border border-green-500/50 rounded-[0.8rem] text-center">
                <p className="text-green-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {success}
                </p>
              </div>
            )}

            <div className="text-center">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                  className="text-slate-400 hover:text-cyan-400 text-[1.3rem] transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Don't have an account? <span className="text-cyan-400">Sign up</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                  className="text-slate-400 hover:text-cyan-400 text-[1.3rem] transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Already have an account? <span className="text-cyan-400">Sign in</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-[3rem] text-center">
            <p className="text-slate-500 text-[1.1rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
              By signing in, you agree to our Terms of Service
            </p>
          </div>
        </div>

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
