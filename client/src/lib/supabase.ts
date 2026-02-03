import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
const supabaseAnonKey = typeof rawKey === 'string' ? rawKey.trim() : '';

const isConfigured = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('${');

if (!isConfigured) {
  console.warn('Supabase credentials not configured. Auth features will be disabled. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

let supabase: SupabaseClient | null = null;

if (isConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
  if (!supabase) {
    return { user: null, error: { name: 'ConfigError', message: 'Supabase not configured' } as AuthError };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data?.user ?? null, error };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
  if (!supabase) {
    return { user: null, error: { name: 'ConfigError', message: 'Supabase not configured' } as AuthError };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { user: data?.user ?? null, error };
}

export async function signInWithGoogle(): Promise<{ error: AuthError | null }> {
  if (!supabase) {
    return { error: { name: 'ConfigError', message: 'Supabase not configured' } as AuthError };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { error };
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(callback: (user: User | null, session: Session | null) => void): () => void {
  if (!supabase) {
    return () => {};
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null, session);
  });
  return () => subscription.unsubscribe();
}

export async function getSession(): Promise<{ user: User | null; session: Session | null }> {
  if (!supabase) {
    return { user: null, session: null };
  }
  const { data: { session } } = await supabase.auth.getSession();
  return { user: session?.user ?? null, session };
}

export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  if (!supabase) {
    return { error: { name: 'ConfigError', message: 'Supabase not configured' } as AuthError };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return { error };
}

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export type { User, Session, AuthError };
