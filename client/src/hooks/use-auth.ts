import { useState, useEffect } from 'react';
import { supabase as sharedSupabase } from '@/lib/supabase';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// Use the shared singleton Supabase client to avoid the
// "Multiple GoTrueClient instances detected" warning. All auth
// configuration (autoRefreshToken, persistSession) lives in @/lib/supabase.
// If the env vars are missing the shared client is null — guard at call sites.
const supabase = sharedSupabase;

/**
 * Retry wrapper for auth operations with exponential backoff
 * @param operation - Async function to execute
 * @param operationName - Name for logging purposes
 * @returns Promise with operation result
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Auth] ${operationName} - Attempt ${attempt}/${MAX_RETRIES}`);
      const result = await operation();
      
      // Success - log and return
      if (attempt > 1) {
        console.log(`[Auth] ${operationName} succeeded on retry ${attempt}`);
      }
      return result;
      
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.warn(`[Auth] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}):`, errorMessage);
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable) {
        console.error(`[Auth] ${operationName} - Non-retryable error, aborting:`, errorMessage);
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt >= MAX_RETRIES) {
        console.error(`[Auth] ${operationName} - Max retries exceeded`);
        break;
      }
      
      // Wait before retry with exponential backoff
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
      const totalDelay = delay + jitter;
      
      console.log(`[Auth] Retrying ${operationName} in ${Math.round(totalDelay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  // All retries failed
  throw lastError || new Error(`${operationName} failed after ${MAX_RETRIES} attempts`);
}

/**
 * Determine if an error is retryable
 * @param error - Error to check
 * @returns true if error should be retried
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  
  const errorMessage = error.message.toLowerCase();
  
  // Don't retry on client-side validation errors (400, 401, 403, 422)
  const clientErrors = ['400', '401', '403', '422', 'invalid', 'validation'];
  if (clientErrors.some(code => errorMessage.includes(code))) {
    return false;
  }
  
  // Don't retry on user-specific errors
  const userErrors = ['already registered', 'user already exists', 'invalid email', 'invalid password'];
  if (userErrors.some(msg => errorMessage.includes(msg))) {
    return false;
  }
  
  // Retry on network/server errors (500, 502, 503, 504, timeout, network)
  const retryableErrors = ['500', '502', '503', '504', 'timeout', 'network', 'fetch', 'abort'];
  if (retryableErrors.some(msg => errorMessage.includes(msg))) {
    return true;
  }
  
  // Default: retry on unknown errors
  return true;
}

/**
 * Auth hook with retry logic and improved error handling
 */
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If Supabase env vars are missing, the shared client is null. Bail out
    // gracefully so the app still renders for guest users instead of crashing.
    if (!supabase) {
      console.warn('[Auth] Supabase client unavailable (missing env vars); auth disabled.');
      setIsLoading(false);
      return;
    }

    const client = supabase;

    // Get initial session with retry
    const initSession = async () => {
      try {
        const session = await withRetry(
          async () => {
            const { data: { session }, error } = await client.auth.getSession();
            if (error) throw error;
            return session;
          },
          'getSession'
        );
        
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
        setError(null);
        
      } catch (err) {
        console.error('[Auth] Failed to get initial session:', err);
        setError(err as Error);
        setUser(null);
        setIsAuthenticated(false);
        
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] State changed:', event);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
        
        // Clear error on successful auth change
        if (session?.user) {
          setError(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sign up new user with email/password
   */
  const signUp = async (email: string, password: string) => {
    setError(null);
    
    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: {
                email_confirmed: false, // Require email confirmation
              },
            },
          });
          if (error) throw error;
          return data;
        },
        'signUp'
      );
      
      return result;
      
    } catch (err) {
      console.error('[Auth] signUp error:', err);
      setError(err as Error);
      throw err;
    }
  };

  /**
   * Sign in existing user with email/password
   */
  const signIn = async (email: string, password: string) => {
    setError(null);
    
    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          return data;
        },
        'signIn'
      );
      
      return result;
      
    } catch (err) {
      console.error('[Auth] signIn error:', err);
      setError(err as Error);
      throw err;
    }
  };

  /**
   * Sign in with OAuth provider (Google/GitHub)
   */
  const signInWithOAuth = async (provider: 'google' | 'github') => {
    setError(null);
    
    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
              queryParams: {
                access_type: 'offline',
                prompt: 'consent',
              },
            },
          });
          if (error) throw error;
          return data;
        },
        `signInWith${provider}`
      );
      
      return result;
      
    } catch (err) {
      console.error(`[Auth] signInWith${provider} error:`, err);
      setError(err as Error);
      throw err;
    }
  };

  /**
   * Sign out current user
   */
  const logout = async () => {
    setError(null);
    
    try {
      await withRetry(
        async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        },
        'signOut'
      );
      
      // Clear local state
      setUser(null);
      setIsAuthenticated(false);
      
    } catch (err) {
      console.error('[Auth] logout error:', err);
      setError(err as Error);
      // Still clear local state even on error
      setUser(null);
      setIsAuthenticated(false);
      throw err;
    }
  };

  /**
   * Reset password for user
   */
  const resetPassword = async (email: string) => {
    setError(null);
    
    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          });
          if (error) throw error;
          return data;
        },
        'resetPassword'
      );
      
      return result;
      
    } catch (err) {
      console.error('[Auth] resetPassword error:', err);
      setError(err as Error);
      throw err;
    }
  };

  /**
   * Update user password
   */
  const updatePassword = async (newPassword: string) => {
    setError(null);
    
    try {
      const result = await withRetry(
        async () => {
          const { data, error } = await supabase.auth.updateUser({
            password: newPassword,
          });
          if (error) throw error;
          return data;
        },
        'updatePassword'
      );
      
      return result;
      
    } catch (err) {
      console.error('[Auth] updatePassword error:', err);
      setError(err as Error);
      throw err;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    signUp,
    signIn,
    signInWithOAuth,
    logout,
    resetPassword,
    updatePassword,
    supabase,
  };
}
