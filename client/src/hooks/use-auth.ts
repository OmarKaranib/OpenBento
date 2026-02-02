import { useState, useEffect } from 'react';
import { supabase, onAuthChange, signOutUser, getSession, type User, type Session } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    getSession().then(({ user, session }) => {
      setAuthState({
        user,
        session,
        isLoading: false,
        isAuthenticated: !!user,
      });
    });

    const unsubscribe = onAuthChange((user, session) => {
      setAuthState({
        user,
        session,
        isLoading: false,
        isAuthenticated: !!user,
      });
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
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
    logout,
    isLoggingOut,
  };
}

export type { User, Session };
