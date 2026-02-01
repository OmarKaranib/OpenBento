// Firebase Authentication Hook for OpenBento Dashboard
import { useState, useEffect } from 'react';
import { auth, onAuthChange, signOutUser, type User } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Subscribe to auth state changes - Firebase handles persistence automatically
    const unsubscribe = onAuthChange((user) => {
      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: !!user,
      });
    });

    // Cleanup subscription on unmount
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
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    logout,
    isLoggingOut,
  };
}

// Export User type for use in components
export type { User };
