import { useState, useEffect } from 'react';
import { onAuthChange, signOutUser, getSession, isSupabaseConfigured, type User, type Session } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
}

export function useAuth() {
  const configured = isSupabaseConfigured();
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: configured,
    isAuthenticated: false,
    isConfigured: configured,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!configured) {
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        isConfigured: false,
      });
      return;
    }

    getSession().then(({ user, session }) => {
      setAuthState({
        user,
        session,
        isLoading: false,
        isAuthenticated: !!user,
        isConfigured: true,
      });
    });

    const unsubscribe = onAuthChange((user, session) => {
      setAuthState({
        user,
        session,
        isLoading: false,
        isAuthenticated: !!user,
        isConfigured: true,
      });
    });

    return () => unsubscribe();
  }, [configured]);

  const logout = async () => {
    if (!configured) return;
    setIsLoggingOut(true);
    try {
      await signOutUser();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    user: authState.user,
    session: authState.session,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    isConfigured: authState.isConfigured,
    logout,
    isLoggingOut,
  };
}

export type { User, Session };
