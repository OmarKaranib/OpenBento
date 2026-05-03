import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchDashboard, type DashboardSnapshot } from '../lib/api';
import {
  DEFAULT_SETTINGS,
  type DashboardPage,
  type Settings,
  type ThemePreference,
} from '../types';
import { paletteFor, type Palette, type ThemeMode } from '../lib/colors';

const SETTINGS_KEY = 'openbento.mobile.settings.v1';

interface AppState {
  // auth
  session: Session | null;
  authReady: boolean;
  signOut: () => Promise<void>;

  // dashboard
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectedPage: DashboardPage | null;

  // settings
  settings: Settings;
  setPageId: (id: string | null) => void;
  setRefreshMinutes: (n: number) => void;
  setThemePref: (p: ThemePreference) => void;

  // theme
  mode: ThemeMode;
  palette: Palette;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const systemScheme = useColorScheme();

  // Load persisted settings.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>;
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        /* ignore — fall back to defaults */
      }
    })();
  }, []);

  const persistSettings = useCallback((next: Settings) => {
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Wire Supabase auth state.
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured() || !session) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await fetchDashboard();
      setSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initial fetch + on session change.
  useEffect(() => {
    if (session) refresh();
    else setSnapshot(null);
  }, [session, refresh]);

  // Foreground refresh loop driven by settings.refreshMinutes.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!session) return;
    const ms = Math.max(1, settings.refreshMinutes) * 60_000;
    intervalRef.current = setInterval(() => {
      refresh();
    }, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session, settings.refreshMinutes, refresh]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSnapshot(null);
  }, []);

  // Derive selected page from settings + snapshot.
  const selectedPage: DashboardPage | null = useMemo(() => {
    if (!snapshot) return null;
    const wantedId = settings.pageId;
    if (wantedId) {
      const found = snapshot.pages.find((p) => p.id === wantedId);
      if (found) return found;
    }
    return (
      snapshot.pages.find((p) => p.id === snapshot.activePageId) ??
      snapshot.pages.find((p) => p.isDefault) ??
      snapshot.pages[0] ??
      null
    );
  }, [snapshot, settings.pageId]);

  // Resolve theme. "Auto" means follow the device system scheme — that
  // matches the Settings copy ("Auto (match system)"). Explicit dark/light
  // overrides win. We intentionally don't fall back to the dashboard row's
  // isDarkMode here so the user's mobile preference is respected.
  const mode: ThemeMode = useMemo(() => {
    if (settings.themePref === 'dark') return 'dark';
    if (settings.themePref === 'light') return 'light';
    return systemScheme === 'light' ? 'light' : 'dark';
  }, [settings.themePref, systemScheme]);

  const palette = useMemo(() => paletteFor(mode), [mode]);

  const value: AppState = {
    session,
    authReady,
    signOut,
    snapshot,
    loading,
    error,
    refresh,
    selectedPage,
    settings,
    setPageId: (id) => persistSettings({ ...settings, pageId: id }),
    setRefreshMinutes: (n) => persistSettings({ ...settings, refreshMinutes: n }),
    setThemePref: (p) => persistSettings({ ...settings, themePref: p }),
    mode,
    palette,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
