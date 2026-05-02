import { useState, useEffect } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Mail, Lock, Eye, EyeOff, X, KeyRound } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset' | 'verify';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
  triggerReason?: string;
  defaultMode?: AuthMode;
}

export function LoginModal({ isOpen, onClose, onLoginSuccess, triggerReason, defaultMode = 'login' }: LoginModalProps) {
  const { signIn, signUp, signInWithOAuth, resetPassword, verifyOtp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  if (!isOpen) return null;

  const configured = isSupabaseConfigured();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) {
      setError('Authentication is not configured. Please contact the administrator.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setSuccess('Check your email for a password reset link.');
        setMode('login');
      } else if (mode === 'signup') {
        await signUp(email, password);
        // Don't log in yet - show verification screen
        setMode('verify');
        setPassword(''); // Clear password for security
      } else {
        const data = await signIn(email, password);
        if (data?.user) {
          onLoginSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) {
      setError('Authentication is not configured. Please contact the administrator.');
      return;
    }

    if (otp.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await verifyOtp(email, otp, 'signup');
      if (data?.user) {
        setSuccess('Email verified successfully!');
        // Wait a moment to show success message, then close and trigger login success
        setTimeout(() => {
          onLoginSuccess?.();
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!configured || !email) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await signUp(email, password || 'temp-password');
      setSuccess('Verification code resent! Check your email.');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!configured) {
      setError('Authentication is not configured. Please contact the administrator.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Preserve the previous redirect target to avoid an OAuth flow regression.
      await signInWithOAuth('google', { redirectTo: 'https://openbento.tv/' });
    } catch (err: any) {
      setError(err?.message || 'An error occurred during Google login.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'reset': return 'Reset Password';
      case 'verify': return 'Verify Email';
      default: return 'Sign In';
    }
  };

  const getSubtitle = () => {
    if (mode === 'verify') {
      return `We sent a 6-digit code to ${email}`;
    }
    if (triggerReason) return triggerReason;
    switch (mode) {
      case 'signup': return 'Sign up to sync your dashboard and channel library across devices';
      case 'reset': return 'Enter your email to reset password';
      default: return 'Sign in to sync your dashboard and channel library across devices';
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center pt-[5rem] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      data-testid="login-modal-backdrop"
    >
      <div 
        className="relative w-full max-w-[40rem] mx-[2rem] mb-auto mt-[2rem] bg-white border border-gray-200 rounded-[1.6rem] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-[1.5rem] right-[1.5rem] p-[0.8rem] text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors z-10"
          data-testid="button-close-modal"
        >
          <X className="w-[2rem] h-[2rem]" />
        </button>

        <div className="p-[3rem]">
          <div className="text-center mb-[2.5rem]">
            <div className="flex items-center justify-center gap-[0.8rem] mb-[0.5rem]">
              <img 
                src="/t.png" 
                alt="OpenBento Logo" 
                className="h-[3rem] w-auto object-contain"
                data-testid="img-modal-logo"
              />
              <h1 
                className="text-[2.8rem] font-bold text-gray-900"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                OpenBento
              </h1>
            </div>
            <div className="h-[0.2rem] w-[8rem] mx-auto bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full mb-[1.5rem]" />
            <h2 
              className="text-[1.8rem] font-semibold text-gray-800 mb-[0.5rem]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {getTitle()}
            </h2>
            <p className="text-gray-600 text-[1.3rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
              {getSubtitle()}
            </p>
          </div>

          {!configured && (
            <div className="mb-[2rem] p-[1.5rem] bg-amber-50 border border-amber-200 rounded-[1rem] text-center">
              <p className="text-amber-800 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                Authentication is being configured. Please check back later.
              </p>
            </div>
          )}

          {mode === 'verify' ? (
            // Verification Screen
            <div className="space-y-[1.5rem]">
              <form onSubmit={handleVerifyOtp} className="space-y-[1.2rem]">
                <div className="relative">
                  <KeyRound className="absolute left-[1.2rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={handleOtpChange}
                    placeholder="Enter 6-digit code"
                    required
                    maxLength={6}
                    disabled={!configured}
                    className="w-full pl-[3.5rem] pr-[1.5rem] py-[1.1rem] bg-gray-50 border border-gray-200 rounded-[0.8rem] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-[1.8rem] text-center tracking-widest font-semibold disabled:opacity-50"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                    data-testid="input-otp"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !configured || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-[1rem] px-[2rem] py-[1.2rem] bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-[0.8rem] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  data-testid="button-verify-otp"
                >
                  {isLoading ? (
                    <Loader2 className="w-[1.8rem] h-[1.8rem] animate-spin" />
                  ) : (
                    <span className="text-[1.3rem]">Verify Email</span>
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="w-full text-center text-gray-500 hover:text-cyan-600 text-[1.2rem] transition-colors disabled:opacity-50"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Didn't receive the code? <span className="text-cyan-600 font-medium">Resend</span>
              </button>

              <button
                type="button"
                onClick={() => { 
                  setMode('signup'); 
                  setOtp(''); 
                  setError(null); 
                  setSuccess(null); 
                }}
                className="w-full text-center text-gray-500 hover:text-gray-700 text-[1.2rem] transition-colors"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                ← Back to signup
              </button>

              {error && (
                <div className="p-[1rem] bg-red-50 border border-red-200 rounded-[0.8rem] text-center">
                  <p className="text-red-600 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="p-[1rem] bg-green-50 border border-green-200 rounded-[0.8rem] text-center">
                  <p className="text-green-600 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {success}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Login/Signup/Reset Screen
            <div className="space-y-[1.5rem]">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading || !configured}
                className="w-full flex items-center justify-center gap-[1rem] px-[2rem] py-[1.3rem] bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold rounded-[1rem] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

              <div className="relative flex items-center gap-[1rem]">
                <div className="flex-1 h-[0.1rem] bg-gray-200" />
                <span className="text-gray-400 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>or</span>
                <div className="flex-1 h-[0.1rem] bg-gray-200" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-[1.2rem]">
                <div className="relative">
                  <Mail className="absolute left-[1.2rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    disabled={!configured}
                    className="w-full pl-[3.5rem] pr-[1.5rem] py-[1.1rem] bg-gray-50 border border-gray-200 rounded-[0.8rem] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-[1.3rem] disabled:opacity-50"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                    data-testid="input-email"
                  />
                </div>

                {mode !== 'reset' && (
                  <div className="relative">
                    <Lock className="absolute left-[1.2rem] top-1/2 -translate-y-1/2 w-[1.6rem] h-[1.6rem] text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      minLength={6}
                      disabled={!configured}
                      className="w-full pl-[3.5rem] pr-[3.5rem] py-[1.1rem] bg-gray-50 border border-gray-200 rounded-[0.8rem] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-[1.3rem] disabled:opacity-50"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-[1.2rem] top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-[1.6rem] h-[1.6rem]" />
                      ) : (
                        <Eye className="w-[1.6rem] h-[1.6rem]" />
                      )}
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !configured}
                  className="w-full flex items-center justify-center gap-[1rem] px-[2rem] py-[1.2rem] bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-[0.8rem] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  data-testid="button-email-submit"
                >
                  {isLoading ? (
                    <Loader2 className="w-[1.8rem] h-[1.8rem] animate-spin" />
                  ) : (
                    <span className="text-[1.3rem]">
                      {mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Send Reset Link' : 'Sign In with Email'}
                    </span>
                  )}
                </button>
              </form>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="w-full text-center text-gray-500 hover:text-cyan-600 text-[1.2rem] transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Forgot password?
                </button>
              )}

              {error && (
                <div className="p-[1rem] bg-red-50 border border-red-200 rounded-[0.8rem] text-center">
                  <p className="text-red-600 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="p-[1rem] bg-green-50 border border-green-200 rounded-[0.8rem] text-center">
                  <p className="text-green-600 text-[1.2rem]" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {success}
                  </p>
                </div>
              )}

              <div className="text-center pt-[0.5rem]">
                {mode === 'login' ? (
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                    className="text-gray-500 hover:text-gray-700 text-[1.2rem] transition-colors"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Don't have an account? <span className="text-cyan-600 font-medium">Sign up</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                    className="text-gray-500 hover:text-gray-700 text-[1.2rem] transition-colors"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    Already have an account? <span className="text-cyan-600 font-medium">Sign in</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}