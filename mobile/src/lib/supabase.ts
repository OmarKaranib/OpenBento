// Supabase client for the mobile companion. Mirrors
// `client/src/lib/supabase.ts` from the web app but swaps localStorage
// for Expo SecureStore so sessions survive an app cold-start without
// being readable by any other process.

import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Read keys from env (EXPO_PUBLIC_*) first, then fall back to the
// `expo.extra` block in app.json. Both are populated at build/start time
// so neither has to be edited in source for end users.
function readEnv(name: string): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>)[name]
      : undefined;
  if (fromProcess && fromProcess.length > 0) return fromProcess;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const camel = name
    .replace(/^EXPO_PUBLIC_/, '')
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const v = extra[camel];
  return typeof v === 'string' ? v : '';
}

export const SUPABASE_URL = readEnv('EXPO_PUBLIC_SUPABASE_URL').trim();
export const SUPABASE_ANON_KEY = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY').trim();
export const API_BASE_URL = readEnv('EXPO_PUBLIC_API_BASE_URL').trim();

const isConfigured =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 0;

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let supabase: SupabaseClient | null = null;
if (isConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: SecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
