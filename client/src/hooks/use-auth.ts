import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthChange, signOutUser, getSession, isSupabaseConfigured, type User, type Session } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  error: string | null;
}

export function useAuth() {
  const configured = isSupabaseConfigured();
  const retryCount = useRef(0);
  const maxRetries = 3;
  const isMounted = useRef(true);

  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: configured,
    isAuthenticated: false,
    isConfigured: configured,
    error: null,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const safeSetState = useCallback((state: AuthState) => {
    if (isMounted.current) {
      setAuthState(state);
    }
  }, []);

  const initSession = useCallback(async () => {
    if (!configured) {
      safeSetState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        isConfigured: false,
        error: null,
      });
      return;
    }

    try {
      const { user, session } = await getSession();
      retryCount.current = 0;
      safeSetState({
        user,
        session,
        isLoading: false,
        isAuthenticated: !!user,
        isConfigured: true,
        error: null,
      });
    } catch (err) {
      console.error('[Auth] Session fetch failed:', err);
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 8000);
        console.log(`[Auth] Retrying session fetch (${retryCount.current}/${maxRetries}) in ${delay}ms...`);
        setTimeout(() => {
          if (isMounted.current) initSession();
        }, delay);
      } else {
        safeSetState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          isConfigured: true,
          error: 'Failed to load session after multiple attempts',
        });
      }
    }
  }, [configured, safeSetState]);

  useEffect(() => {
    isMounted.current = true;
    initSession();

    let unsubscribe = () => {};
    if (configured) {
      unsubscribe = onAuthChange((user, session) => {
        retryCount.current = 0;
        safeSetState({
          user,
          session,
          isLoading: false,
          isAuthenticated: !!user,
          isConfigured: true,
          error: null,
        });
      });
    }

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [configured, initSession, safeSetState]);

  const logout = async () => {
    if (!configured) return;
    setIsLoggingOut(true);
    try {
      await signOutUser();
    } catch (err) {
      console.error('[Auth] Logout failed:', err);
    } finally {
      if (isMounted.current) {
        setIsLoggingOut(false);
      }
    }
  };

  const refreshSession = useCallback(async () => {
    retryCount.current = 0;
    await initSession();
  }, [initSession]);

  return {
    user: authState.user,
    session: authState.session,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    isConfigured: authState.isConfigured,
    error: authState.error,
    logout,
    isLoggingOut,
    refreshSession,
  };
}

export type { User, Session };
